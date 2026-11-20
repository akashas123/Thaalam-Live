export async function onRequest() {
  const response = await fetch('https://news.google.com/rss/search?q=pop%20music&hl=en-US&gl=US&ceid=US:en');
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Content-Type', 'application/rss+xml; charset=utf-8');
  return new Response(response.body, { status: response.status, headers });
}
