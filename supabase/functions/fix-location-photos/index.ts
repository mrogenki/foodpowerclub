import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_API_KEY = 'AIzaSyAWlPz-WHUjO-Xhg7oExhPUjrmbu05ABKc';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceInfo {
  placeId: string;
  photoRef: string;
}

// 用舊版 Text Search 取得 place_id + photo_reference
async function getPlaceInfo(name: string, address: string): Promise<PlaceInfo | null> {
  const query = encodeURIComponent(`${name} ${address}`);
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&language=zh-TW&key=${GOOGLE_API_KEY}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data.status !== 'OK' || !data.results?.length) return null;
  const place = data.results[0];
  if (!place.photos?.length) return null;
  return {
    placeId: place.place_id,
    photoRef: place.photos[0].photo_reference
  };
}

// 用 place_id + photo_reference 組成新版照片資源路徑，下載圖片
async function downloadPhoto(placeId: string, photoRef: string): Promise<{ buffer: ArrayBuffer; contentType: string } | null> {
  const photoName = `places/${placeId}/photos/${photoRef}`;
  // 方式 1: 新版 Places API media endpoint (skipHttpRedirect=true)
  try {
    const metaUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_API_KEY}&maxWidthPx=800&skipHttpRedirect=true`;
    const metaResp = await fetch(metaUrl);
    if (metaResp.ok) {
      const meta = await metaResp.json();
      if (meta.photoUri) {
        const imgResp = await fetch(meta.photoUri);
        if (imgResp.ok) {
          const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
          if (contentType.startsWith('image/')) {
            return { buffer: await imgResp.arrayBuffer(), contentType };
          }
        }
      }
    }
  } catch (_) { /* fallthrough */ }

  // 方式 2: 新版 Places API 直接 redirect
  try {
    const directUrl = `https://places.googleapis.com/v1/${photoName}/media?key=${GOOGLE_API_KEY}&maxWidthPx=800`;
    const imgResp = await fetch(directUrl, { redirect: 'follow' });
    if (imgResp.ok) {
      const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
      if (contentType.startsWith('image/')) {
        return { buffer: await imgResp.arrayBuffer(), contentType };
      }
    }
  } catch (_) { /* fallthrough */ }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const body = await req.json().catch(() => ({}));

  // debug 模式
  if (body.debug) {
    const info = await getPlaceInfo(body.name, body.address);
    if (!info) return new Response(JSON.stringify({ error: 'not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const photo = await downloadPhoto(info.placeId, info.photoRef);
    return new Response(JSON.stringify({
      placeId: info.placeId,
      photoRef: info.photoRef.substring(0, 20),
      photoName: `places/${info.placeId}/photos/${info.photoRef.substring(0, 20)}`,
      downloaded: !!photo,
      size: photo?.buffer.byteLength
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // 取得所有圖片不是 Supabase Storage 的店家
  const { data: locations, error } = await supabase
    .from('locations')
    .select('id, name, address, image_url')
    .not('image_url', 'ilike', '%supabase%');

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }

  const results: { name: string; status: string }[] = [];

  for (const loc of (locations ?? [])) {
    try {
      const info = await getPlaceInfo(loc.name, loc.address);
      if (!info) { results.push({ name: loc.name, status: 'no_place_found' }); continue; }

      const photo = await downloadPhoto(info.placeId, info.photoRef);
      if (!photo) { results.push({ name: loc.name, status: 'download_failed' }); continue; }

      const fileName = `locations/fix_${loc.id}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('IMAGES')
        .upload(fileName, photo.buffer, { contentType: photo.contentType, upsert: true });

      if (uploadError) { results.push({ name: loc.name, status: 'upload_failed: ' + uploadError.message }); continue; }

      const { data: { publicUrl } } = supabase.storage.from('IMAGES').getPublicUrl(fileName);
      await supabase.from('locations').update({ image_url: publicUrl }).eq('id', loc.id);
      results.push({ name: loc.name, status: 'ok' });

      await new Promise(r => setTimeout(r, 300));
    } catch (err: unknown) {
      results.push({ name: loc.name, status: 'error: ' + (err instanceof Error ? err.message : String(err)) });
    }
  }

  const ok = results.filter(r => r.status === 'ok').length;
  return new Response(JSON.stringify({ total: results.length, ok, failed: results.length - ok, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
