// ── GoRouter CORS Proxy (Cloudflare Worker) ──
// This sits between your website and gorouter.app.
// Your browser talks to THIS worker (which allows CORS).
// This worker talks to gorouter.app on the server side (CORS doesn't apply there).
//
// SETUP:
// 1. Go to https://dash.cloudflare.com -> Workers & Pages -> Create -> Worker
// 2. Paste this entire file in, replacing the default code
// 3. Click "Deploy"
// 4. (Recommended) Go to Settings -> Variables -> add a secret named GOROUTER_KEY
//    with your GoRouter API key as the value. This keeps your key off your
//    public website entirely.
// 5. Copy your worker's URL, e.g. https://gorouter-proxy.yourname.workers.dev
// 6. Use that URL (+ /v1/chat/completions) as the "endpoint" in your website.

const UPSTREAM = 'https://gorouter.app';

// If you don't set the GOROUTER_KEY secret, the worker will just pass through
// whatever Authorization header your website sends (less secure, but works
// without extra setup).
const FORCE_SERVER_KEY = false; // set true once you've added the GOROUTER_KEY secret

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }

    const url = new URL(request.url);
    const upstreamUrl = UPSTREAM + url.pathname + url.search;

    const headers = new Headers(request.headers);
    headers.delete('host');
    headers.delete('origin');
    headers.delete('referer');

    if (FORCE_SERVER_KEY && env.GOROUTER_KEY) {
      headers.set('Authorization', 'Bearer ' + env.GOROUTER_KEY);
    }

    const init = {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    };

    try {
      const upstreamRes = await fetch(upstreamUrl, init);

      // Stream the response straight back, just adding CORS headers
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
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
