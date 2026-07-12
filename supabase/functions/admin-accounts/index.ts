// 管理員帳號管理（僅 owner 可呼叫）
// actions: create | update_role | reset_password | delete
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

  try {
    // 驗證呼叫者
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) return json({ error: '未登入' }, 401);

    const { data: caller } = await admin.from('admin_users').select('role').eq('user_id', user.id).maybeSingle();
    if (!caller || caller.role !== 'owner') return json({ error: '僅 owner 可管理帳號' }, 403);

    const { action, email, password, role, user_id } = await req.json();

    const countOwners = async () => {
      const { count } = await admin.from('admin_users').select('*', { count: 'exact', head: true }).eq('role', 'owner');
      return count ?? 0;
    };

    if (action === 'create') {
      if (!email || !password) return json({ error: '缺少 email 或密碼' }, 400);
      if (password.length < 8) return json({ error: '密碼至少 8 碼' }, 400);
      if (!['owner', 'editor'].includes(role)) return json({ error: '角色不正確' }, 400);
      const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      const { error: insertErr } = await admin.from('admin_users').insert({ user_id: created.user.id, email, role });
      if (insertErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: insertErr.message }, 400);
      }
      return json({ ok: true });
    }

    if (action === 'update_role') {
      if (!user_id || !['owner', 'editor'].includes(role)) return json({ error: '參數不正確' }, 400);
      const { data: target } = await admin.from('admin_users').select('role').eq('user_id', user_id).maybeSingle();
      if (!target) return json({ error: '找不到帳號' }, 404);
      if (target.role === 'owner' && role !== 'owner' && (await countOwners()) <= 1) {
        return json({ error: '至少需保留一位 owner' }, 400);
      }
      const { error } = await admin.from('admin_users').update({ role }).eq('user_id', user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'reset_password') {
      if (!user_id || !password) return json({ error: '參數不正確' }, 400);
      if (password.length < 8) return json({ error: '密碼至少 8 碼' }, 400);
      const { error } = await admin.auth.admin.updateUserById(user_id, { password });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    if (action === 'delete') {
      if (!user_id) return json({ error: '參數不正確' }, 400);
      if (user_id === user.id) return json({ error: '不能刪除自己的帳號' }, 400);
      const { data: target } = await admin.from('admin_users').select('role').eq('user_id', user_id).maybeSingle();
      if (!target) return json({ error: '找不到帳號' }, 404);
      if (target.role === 'owner' && (await countOwners()) <= 1) {
        return json({ error: '至少需保留一位 owner' }, 400);
      }
      // 刪 auth user；admin_users 由 FK ON DELETE CASCADE 帶掉
      const { error } = await admin.auth.admin.deleteUser(user_id);
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: '未知的 action' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : '伺服器錯誤' }, 500);
  }
});
