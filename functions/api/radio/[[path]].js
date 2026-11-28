export async function onRequestGet({ params, request }) {
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path || '';
  const target = `http://68.233.117.57/api/${path}${new URL(request.url).search}`;
  const response = await fetch(target, { method: 'GET' });
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(response.body, { status: response.status, headers });
}
