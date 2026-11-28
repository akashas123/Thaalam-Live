export async function onRequest({ params, request }) {
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path || '';
  const target = `http://68.233.117.57/hls/${path}${new URL(request.url).search}`;
  const response = await fetch(target, { method: request.method, headers: request.headers });
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'no-store');
  return new Response(response.body, { status: response.status, headers });
}
