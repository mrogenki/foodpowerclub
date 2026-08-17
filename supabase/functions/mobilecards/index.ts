// 查詢登入會員在 mobile.cards 的點數與可兌換好禮（票券）。
// 只讀：以「會員自己 DB 內的手機」當 memberinput，向 mobile.cards checkPoints / queryMemberInfo 查詢。
// secretkey 只存在本函式環境，前端永遠拿不到；memberinput 一律取自伺服端，防止查詢他人資料。
import { createClient } from 'npm:@supabase/supabase-js@2';
import { crypto } from 'jsr:@std/crypto';
import { encodeHex } from 'jsr:@std/encoding/hex';

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

// 台灣手機正規化成 E.164（+886…）。mobile.cards memberinput 支援 phone 格式。
// 09xxxxxxxx → +8869xxxxxxx；886/+886 開頭 → 正規化；其餘保留原數字並補 +。
function normalizePhone(raw: string): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('886')) return '+' + digits;
  if (digits.startsWith('0')) return '+886' + digits.slice(1);
  return '+' + digits;
}

async function md5Hex(str: string): Promise<string> {
  const buf = await crypto.subtle.digest('MD5', new TextEncoder().encode(str));
  return encodeHex(new Uint8Array(buf));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // 每次請求讀取（避免 warm isolate 快取舊值）
  const BASE = (Deno.env.get('MOBILECARDS_API_BASE') || 'https://staging-api.mobilecardspro.com').trim().replace(/\/$/, '');
  const VENDOR_ID = (Deno.env.get('MOBILECARDS_VENDOR_ID') || '').trim();
  const SECRET_KEY = (Deno.env.get('MOBILECARDS_SECRET_KEY') || '').trim();
  const SHOP_ID = (Deno.env.get('MOBILECARDS_SHOP_ID') || '').trim();
  const BRANCH_ID = (Deno.env.get('MOBILECARDS_BRANCH_ID') || '').trim();

  try {
    const jwt = (req.headers.get('Authorization') || '').replace('Bearer ', '');
    const { data: { user }, error: userErr } = await admin.auth.getUser(jwt);
    if (userErr || !user) return json({ error: '未登入或登入已過期，請重新登入' }, 401);

    if (!VENDOR_ID || !SECRET_KEY || !SHOP_ID || !BRANCH_ID) {
      console.error('mobile.cards secrets missing', {
        hasVendor: !!VENDOR_ID, hasSecret: !!SECRET_KEY, hasShop: !!SHOP_ID, hasBranch: !!BRANCH_ID,
      });
      return json({ error: '伺服器尚未設定 mobile.cards 金鑰，請稍後再試' }, 500);
    }

    // memberinput 一律取自登入會員自己的 DB 資料，不接受前端傳入
    const { data: m, error: mErr } = await admin
      .from('members').select('phone').eq('id', user.id).maybeSingle();
    if (mErr) return json({ error: mErr.message }, 400);

    const memberinput = normalizePhone(m?.phone || '');
    if (!memberinput) return json({ linked: false, reason: 'no_phone' });

    // 稽核軌跡：手機尚未經簡訊驗證（OTP 為下一期），記錄「誰查了哪支尾碼」以便追查濫用。
    // 只記末 3 碼，避免在 log 留完整 PII。
    console.log('mobilecards lookup', { uid: user.id, phoneTail: memberinput.slice(-3) });

    // apikey = md5(secretkey|shopid|branchid|memberinput|timestamp)，timestamp 為 Unix 秒
    const timestamp = Math.floor(Date.now() / 1000);
    const apikey = await md5Hex([SECRET_KEY, SHOP_ID, BRANCH_ID, memberinput, timestamp].join('|'));
    const baseBody = {
      apikey, vendorid: VENDOR_ID, shopid: SHOP_ID, branchid: BRANCH_ID, memberinput, timestamp, lang: 'zht',
    };

    // 主要查詢：點數 + 等級 + 折扣碼 + 可兌換好禮（票券）
    const cpRes = await fetch(`${BASE}/api/checkPoints`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(baseBody),
    });
    const cp = await cpRes.json().catch(() => ({}));

    if (cp?.result !== 1) {
      // result 100+ 代表查無會員 / API Key 等錯誤；不把細節全丟前端
      console.warn('checkPoints non-success', { code: cp?.result });
      return json({ linked: false, reason: 'not_found', code: cp?.result ?? null, message: cp?.message ?? null });
    }

    const summary: Record<string, unknown> = {
      linked: true,
      memberid: cp.memberid ?? null,
      name: cp.name ?? null,
      points: Number(cp.pts ?? 0),
      membergrade: cp.membergrade ?? null,
      memberdiscountcode: cp.memberdiscountcode ?? null,
      isExternalMemberId: !!cp.isExternalMemberId,
      // 注意：不回傳 giftcode（可核銷券碼）。手機經簡訊 OTP 驗證前，僅顯示好禮名稱與所需點數，
      // 避免有人填別人手機就取得他人可核銷的券碼。核銷/取碼待 OTP 驗證上線後再開放。
      gifts: Array.isArray(cp.giftdata)
        ? cp.giftdata.map((g: any) => ({
            giftid: String(g.giftid ?? ''),
            name: g.name ?? '',
            pts: Number(g.pts ?? 0),
          }))
        : [],
    };

    // 補充：點數效期 / 預付金 / 累積點數（失敗不致命）
    try {
      const qmRes = await fetch(`${BASE}/api/queryMemberInfo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(baseBody),
      });
      const qm = await qmRes.json().catch(() => ({}));
      const info = qm?.result === 1 && Array.isArray(qm.memberinfo) ? qm.memberinfo[0] : null;
      if (info) {
        summary.expirydate = info.expirydate ?? null;
        summary.totalpts = info.totalpts != null ? Number(info.totalpts) : null;
        summary.prepaidname = info.prepaidname ?? null;
        summary.prepaidpts = info.prepaidpts != null ? Number(info.prepaidpts) : null;
      }
    } catch (e) {
      console.warn('queryMemberInfo failed (non-fatal)', String((e as Error).message || e));
    }

    return json(summary);
  } catch (e) {
    console.error('mobilecards error', e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
