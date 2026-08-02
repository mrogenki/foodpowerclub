// 後台推播：對「已綁定 LINE 且同意行銷」的會員群發 LINE 文字訊息。
// 僅管理員可呼叫；用 Messaging API multicast（每批上限 500 人）。
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const chunk = <T>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const TOKEN = (Deno.env.get('LINE_MESSAGING_ACCESS_TOKEN') || '').trim();

  try {
    // 僅管理員
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) return json({ error: '未登入或登入已過期' }, 401);
    const { data: adminRow } = await admin.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
    if (!adminRow) return json({ error: '僅管理員可發送' }, 403);

    const { message, member_type, mode, card } = await req.json();
    if (!TOKEN) {
      console.error('LINE_MESSAGING_ACCESS_TOKEN missing');
      return json({ error: '伺服器尚未設定 LINE 推播金鑰' }, 500);
    }

    // 組訊息：純文字 or 圖文卡片（Buttons Template）
    let messages: unknown[];
    if (mode === 'card') {
      const c = card || {};
      const title = (c.title || '').toString().trim();
      const desc = (c.text || '').toString().trim();
      const btnLabel = (c.buttonLabel || '').toString().trim();
      const btnUrl = (c.buttonUrl || '').toString().trim();
      const imageUrl = (c.imageUrl || '').toString().trim();
      if (!title) return json({ error: '卡片標題不可空白' }, 400);
      if (!btnLabel || !btnUrl) return json({ error: '請填寫按鈕文字與連結' }, 400);
      if (!/^https?:\/\//.test(btnUrl)) return json({ error: '按鈕連結需以 http(s):// 開頭' }, 400);
      if (imageUrl && !/^https:\/\//.test(imageUrl)) return json({ error: '圖片網址需為 https' }, 400);
      const template: Record<string, unknown> = {
        type: 'buttons',
        title: title.slice(0, 40),
        text: (desc || ' ').slice(0, imageUrl ? 60 : 160),
        actions: [{ type: 'uri', label: btnLabel.slice(0, 20), uri: btnUrl }],
      };
      if (imageUrl) template.thumbnailImageUrl = imageUrl;
      const altText = ((c.altText || title || '食在俱樂部通知').toString()).slice(0, 400);
      messages = [{ type: 'template', altText, template }];
    } else {
      const text = (message || '').toString().trim();
      if (!text) return json({ error: '訊息內容不可空白' }, 400);
      if (text.length > 5000) return json({ error: '訊息長度上限 5000 字' }, 400);
      messages = [{ type: 'text', text }];
    }

    // 對象：已綁定 LINE + 同意行銷 (+ 身分別)
    let q = admin.from('members')
      .select('line_user_id')
      .not('line_user_id', 'is', null)
      .eq('marketing_consent', true);
    if (member_type && member_type !== 'all') q = q.eq('member_type', member_type);
    const { data: rows, error: qErr } = await q;
    if (qErr) return json({ error: qErr.message }, 400);

    const ids = (rows || []).map((r: { line_user_id: string }) => r.line_user_id).filter(Boolean);
    if (ids.length === 0) return json({ ok: true, sent: 0, failed: 0 });

    let sent = 0, failed = 0;
    const errors: string[] = [];
    for (const batch of chunk(ids, 500)) {
      const res = await fetch('https://api.line.me/v2/bot/message/multicast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
        body: JSON.stringify({ to: batch, messages }),
      });
      if (res.ok) {
        sent += batch.length;
      } else {
        failed += batch.length;
        const t = await res.text();
        console.error('LINE multicast failed', res.status, t);
        if (errors.length < 3) errors.push(`${res.status}: ${t}`);
      }
    }

    return json({ ok: true, sent, failed, errors });
  } catch (e) {
    console.error('line-push error', e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
