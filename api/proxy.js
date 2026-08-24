// api/proxy.js
//
// This is a Vercel Serverless Function. Once this file sits inside an
// "api/" folder in your Vercel project and you deploy, Vercel automatically
// makes it live at:
//     https://YOUR-SITE.vercel.app/api/proxy
//
// Your website calls THAT url. This function then calls gorouter.app on
// the server side (no CORS restrictions apply server-to-server), and
// streams the response straight back to your browser.
//
// SETUP:
// 1. In your website project folder (the one you deploy to Vercel), create
//    a folder named "api" at the top level (same level as index.html).
// 2. Put this file inside it as: api/proxy.js
// 3. Commit + push / redeploy on Vercel.
// 4. In your site's Setup screen, set "CORS Proxy URL" to:
//        https://YOUR-SITE.vercel.app/api/proxy
//    (use your real Vercel domain)
// 5. Leave everything else (API key, model, endpoint) as normal.

export const config = {
  runtime: 'edge', // needed so we can stream the response back chunk-by-chunk
};

const UPSTREAM = 'https://gorouter.app';

export default async function handler(request) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  // The website sends the REAL target URL (e.g. https://gorouter.app/v1/chat/completions)
  // in this custom header, so we don't have to rely on Vercel forwarding sub-paths.
  const targetHeader = request.headers.get('x-proxy-target');
  const upstreamUrl = targetHeader || (UPSTREAM + '/v1/chat/completions');

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('origin');
  headers.delete('referer');
  headers.delete('connection');
  headers.delete('x-proxy-target');

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    });

    const respHeaders = new Headers(upstreamRes.headers);
    const cors = corsHeaders();
    for (const [k, v] of Object.entries(cors)) respHeaders.set(k, v);

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: respHeaders,
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: 'Proxy fetch failed', detail: String(err) }),
      { status: 502, headers: { ...corsHeaders(), 'Content-Type': 'application/json' } }
    );
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
