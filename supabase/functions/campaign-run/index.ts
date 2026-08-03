// 排程執行器：由 pg_cron 每分鐘呼叫，處理到期的排程群發（LINE / Email）。
// 以 x-cron-secret 驗證來源；用 service role 讀寫。
import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const CRON_SECRET = (Deno.env.get('CRON_SECRET') || '').trim();
const LINE_TOKEN = (Deno.env.get('LINE_MESSAGING_ACCESS_TOKEN') || '').trim();
const RESEND_API_KEY = (Deno.env.get('RESEND_API_KEY') || '').trim();
const RESEND_FROM = (Deno.env.get('RESEND_FROM') || '食在俱樂部 <noreply@foodpowerclub.com>').trim();
const MEMBER_URL = 'https://www.foodpowerclub.com/member';

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json' } });
const chunk = <T>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function memberEmails(member_type: string) {
  let q = admin.from('members').select('email').not('email', 'is', null).eq('marketing_consent', true);
  if (member_type && member_type !== 'all') q = q.eq('member_type', member_type);
  const { data } = await q;
  return Array.from(new Set((data || []).map((r: { email: string }) => (r.email || '').trim()).filter((e: string) => /.+@.+\..+/.test(e))));
}
async function memberLineIds(member_type: string) {
  let q = admin.from('members').select('line_user_id').not('line_user_id', 'is', null).eq('marketing_consent', true);
  if (member_type && member_type !== 'all') q = q.eq('member_type', member_type);
  const { data } = await q;
  return (data || []).map((r: { line_user_id: string }) => r.line_user_id).filter(Boolean) as string[];
}

async function runLine(payload: any, member_type: string) {
  let messages: unknown[];
  if (payload.mode === 'card') {
    const c = payload.card || {};
    const imageUrl = (c.imageUrl || '').toString().trim();
    const template: Record<string, unknown> = {
      type: 'buttons',
      title: (c.title || '').toString().slice(0, 40),
      text: ((c.text || ' ').toString()).slice(0, imageUrl ? 60 : 160),
      actions: [{ type: 'uri', label: (c.buttonLabel || '查看').toString().slice(0, 20), uri: (c.buttonUrl || '').toString() }],
    };
    if (imageUrl) template.thumbnailImageUrl = imageUrl;
    messages = [{ type: 'template', altText: ((c.title || '食在俱樂部通知').toString()).slice(0, 400), template }];
  } else {
    messages = [{ type: 'text', text: (payload.message || '').toString() }];
  }
  const ids = await memberLineIds(member_type);
  let sent = 0, failed = 0;
  for (const batch of chunk(ids, 500)) {
    const res = await fetch('https://api.line.me/v2/bot/message/multicast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${LINE_TOKEN}` },
      body: JSON.stringify({ to: batch, messages }),
    });
    if (res.ok) sent += batch.length; else { failed += batch.length; console.error('multicast fail', res.status, await res.text()); }
  }
  return { sent, failed };
}

async function runEmail(payload: any, member_type: string) {
  const subj = (payload.subject || '').toString();
  const content = (payload.body || '').toString();
  const imageUrl = (payload.image_url || '').toString().trim();
  const footer = `<hr style="border:none;border-top:1px solid #eee;margin:24px 0" /><p style="font-size:12px;color:#999;line-height:1.6">您會收到這封信，是因為您在食在俱樂部同意接收行銷資訊。不想再收到，請至 <a href="${MEMBER_URL}" style="color:#ea580c">會員中心</a> 關閉「接收行銷資訊」。</p>`;
  const imgTag = imageUrl ? `<img src="${imageUrl}" alt="" style="width:100%;max-width:600px;border-radius:10px;margin-bottom:20px;display:block" />` : '';
  const html = `<div style="font-family:-apple-system,'PingFang TC','Microsoft JhengHei',sans-serif;font-size:15px;line-height:1.8;color:#333;max-width:600px;margin:0 auto">${imgTag}<div>${escapeHtml(content).replace(/\n/g, '<br />')}</div>${footer}</div>`;
  const emails = await memberEmails(member_type);
  let sent = 0, failed = 0;
  for (const batch of chunk(emails, 100)) {
    const res = await fetch('https://api.resend.com/emails/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${RESEND_API_KEY}` },
      body: JSON.stringify(batch.map((to) => ({ from: RESEND_FROM, to, subject: subj, html, headers: { 'List-Unsubscribe': `<${MEMBER_URL}>` } }))),
    });
    if (res.ok) sent += batch.length; else { failed += batch.length; console.error('resend fail', res.status, await res.text()); }
  }
  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  if (!CRON_SECRET || req.headers.get('x-cron-secret') !== CRON_SECRET) return json({ error: 'unauthorized' }, 401);

  const { data: due } = await admin.from('message_campaigns')
    .select('*').eq('status', 'scheduled').lte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true }).limit(20);

  let processed = 0;
  for (const c of (due || [])) {
    // 原子認領：只有把 scheduled → sending 成功者才處理
    const { data: claimed } = await admin.from('message_campaigns')
      .update({ status: 'sending' }).eq('id', c.id).eq('status', 'scheduled').select('id');
    if (!claimed || claimed.length === 0) continue;
    try {
      const r = c.channel === 'line' ? await runLine(c.payload, c.member_type) : await runEmail(c.payload, c.member_type);
      await admin.from('message_campaigns').update({
        status: 'sent', sent_count: r.sent, failed_count: r.failed, recipient_count: r.sent + r.failed, sent_at: new Date().toISOString(),
      }).eq('id', c.id);
      processed++;
    } catch (e) {
      console.error('campaign send error', c.id, e);
      await admin.from('message_campaigns').update({ status: 'failed' }).eq('id', c.id);
    }
  }

  return json({ ok: true, processed });
});
