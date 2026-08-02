// 綁定會員的 LINE 帳號：用 LINE Login 授權碼換 token → 取 userId → 寫入 members.line_user_id。
// userId 與官方帳號 Messaging 的 userId 一致（同 provider + 連動 OA），日後可用於推播。
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // 每次請求讀取（避免 warm isolate 快取舊值）
  const ID = (Deno.env.get('LINE_LOGIN_CHANNEL_ID') || '').trim();
  const SECRET = (Deno.env.get('LINE_LOGIN_CHANNEL_SECRET') || '').trim();

  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) return json({ error: '未登入或登入已過期，請重新登入' }, 401);

    const { action, code, redirect_uri } = await req.json();

    // 解除綁定
    if (action === 'unbind') {
      const { error } = await admin.from('members').update({ line_user_id: null }).eq('id', user.id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, unbound: true });
    }

    if (!code || !redirect_uri) return json({ error: '缺少 code 或 redirect_uri' }, 400);
    if (!ID || !SECRET) {
      console.error('LINE secrets missing', { hasId: !!ID, hasSecret: !!SECRET });
      return json({ error: '伺服器尚未設定 LINE 金鑰，請稍後再試' }, 500);
    }

    // 用授權碼換 LINE token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri,
        client_id: ID,
        client_secret: SECRET,
      }),
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error('LINE token exchange failed', { status: tokenRes.status, lineError: tokenData });
      return json({ error: 'LINE 授權失敗，請重新綁定' }, 400);
    }

    // 取得 LINE 個人資料（userId 與 Messaging 一致）
    const profRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profRes.json();
    if (!profRes.ok || !profile.userId) {
      console.error('LINE profile failed', profile);
      return json({ error: '無法取得 LINE 個人資料' }, 400);
    }
    const lineUserId: string = profile.userId;

    // 檢查此 LINE 是否已被其他帳號綁定
    const { data: existing } = await admin
      .from('members').select('id').eq('line_user_id', lineUserId).maybeSingle();
    if (existing && existing.id !== user.id) {
      return json({ error: '此 LINE 帳號已綁定其他會員' }, 409);
    }

    // 寫入綁定（service_role 可通過欄位保護觸發器）
    const { error: updErr } = await admin
      .from('members')
      .update({ line_user_id: lineUserId, avatar_url: profile.pictureUrl || undefined })
      .eq('id', user.id);
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ ok: true, display_name: profile.displayName || null });
  } catch (e) {
    console.error('line-bind error', e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
