import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { photo_url } = await req.json();
    if (!photo_url) {
      return new Response(JSON.stringify({ error: 'photo_url is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      });
    }

    const photoResponse = await fetch(photo_url, {
      headers: { 'Referer': 'https://www.foodpowerclub.com/', 'User-Agent': 'Mozilla/5.0' }
    });

    if (!photoResponse.ok) {
      return new Response(JSON.stringify({ error: `fetch failed: ${photoResponse.status}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      });
    }

    const photoBuffer = await photoResponse.arrayBuffer();
    const contentType = photoResponse.headers.get('content-type') || 'image/jpeg';

    if (!contentType.startsWith('image/')) {
      return new Response(JSON.stringify({ error: `not an image: ${contentType}` }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const fileName = `locations/gplace_${Date.now()}.jpg`;
    const { error: uploadError } = await supabaseClient.storage
      .from('images')  // 正確 bucket 名稱（小寫）
      .upload(fileName, photoBuffer, { contentType, upsert: false });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
      });
    }

    const { data: { publicUrl } } = supabaseClient.storage.from('images').getPublicUrl(fileName);

    return new Response(JSON.stringify({ url: publicUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500
    });
  }
});
