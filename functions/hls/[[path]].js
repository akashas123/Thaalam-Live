export async function onRequest({ params, request }) {
  const path = Array.isArray(params.path) ? params.path.join('/') : params.path || '';
  const target = `http://68.233.117.57/hls/${path}${new URL(request.url).search}`;
  const response = await fetch(target, { method: request.method, redirect: 'follow' });
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Cache-Control', 'no-store');

  const contentType = headers.get('content-type') || '';
  if (path.endsWith('.m3u8') || contentType.includes('mpegurl')) {
    const playlist = await response.text();
    const rewritten = playlist
      .replaceAll('http://68.233.117.57/', '/')
      .replaceAll('https://68.233.117.57/', '/');
    headers.set('Content-Type', 'application/vnd.apple.mpegurl');
    headers.delete('Content-Length');
    return new Response(rewritten, { status: response.status, headers });
  }

  return new Response(response.body, { status: response.status, headers });
}
