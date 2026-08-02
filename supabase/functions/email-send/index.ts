// 後台 Email 行銷群發：對「有 Email 且同意行銷」的會員寄信（可分眾）。
// 僅管理員；透過 Resend batch API（每批上限 100 封）。
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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const MEMBER_URL = 'https://www.foodpowerclub.com/member';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  const RESEND_API_KEY = (Deno.env.get('RESEND_API_KEY') || '').trim();
  const RESEND_FROM = (Deno.env.get('RESEND_FROM') || '食在俱樂部 <noreply@foodpowerclub.com>').trim();

  try {
    // 僅管理員
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) return json({ error: '未登入或登入已過期' }, 401);
    const { data: adminRow } = await admin.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
    if (!adminRow) return json({ error: '僅管理員可發送' }, 403);

    const { subject, body, member_type } = await req.json();
    const subj = (subject || '').toString().trim();
    const content = (body || '').toString().trim();
    if (!subj) return json({ error: '主旨不可空白' }, 400);
    if (!content) return json({ error: '內容不可空白' }, 400);
    if (!RESEND_API_KEY) {
      console.error('RESEND_API_KEY missing');
      return json({ error: '伺服器尚未設定 Resend 金鑰' }, 500);
    }

    // 對象：有 Email + 同意行銷 (+ 身分別)
    let q = admin.from('members')
      .select('email')
      .not('email', 'is', null)
      .eq('marketing_consent', true);
    if (member_type && member_type !== 'all') q = q.eq('member_type', member_type);
    const { data: rows, error: qErr } = await q;
    if (qErr) return json({ error: qErr.message }, 400);

    const emails = Array.from(new Set((rows || [])
      .map((r: { email: string }) => (r.email || '').trim())
      .filter((e: string) => /.+@.+\..+/.test(e))));
    if (emails.length === 0) return json({ ok: true, sent: 0, failed: 0 });

    const footer =
      `<hr style="border:none;border-top:1px solid #eee;margin:24px 0" />` +
      `<p style="font-size:12px;color:#999;line-height:1.6">您會收到這封信，是因為您在食在俱樂部同意接收行銷資訊。` +
      `不想再收到，請至 <a href="${MEMBER_URL}" style="color:#ea580c">會員中心</a> 關閉「接收行銷資訊」。</p>`;
    const html =
      `<div style="font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;font-size:15px;line-height:1.8;color:#333;max-width:600px;margin:0 auto">` +
      `<div>${escapeHtml(content).replace(/\n/g, '<br />')}</div>${footer}</div>`;

    let sent = 0, failed = 0;
    const errors: string[] = [];
    for (const batch of chunk(emails, 100)) {
      const payload = batch.map((to) => ({
        from: RESEND_FROM,
        to,
        subject: subj,
        html,
        headers: { 'List-Unsubscribe': `<${MEMBER_URL}>` },
      }));
      const res = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        sent += batch.length;
      } else {
        failed += batch.length;
        const t = await res.text();
        console.error('Resend batch failed', res.status, t);
        if (errors.length < 3) errors.push(`${res.status}: ${t}`);
      }
    }

    return json({ ok: true, sent, failed, errors });
  } catch (e) {
    console.error('email-send error', e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
