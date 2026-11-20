export async function onRequest({ request, params }) {
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path || '';
  const target = `https://radio.thaalam24x7.in/api/${path}${new URL(request.url).search}`;
  const response = await fetch(target, { method: 'GET' });
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  return new Response(response.body, { status: response.status, headers });
}
