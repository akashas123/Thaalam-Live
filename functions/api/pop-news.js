export async function onRequestGet() {
  const sources = [
    'https://news.google.com/rss/search?q=pop%20music&hl=en-US&gl=US&ceid=US:en',
    'https://www.bing.com/news/search?q=pop%20music&format=rss',
  ];
  for (const source of sources) {
    try {
      const response = await fetch(source, { headers: { 'User-Agent': 'ThaalamRadio/1.0' } });
      if (!response.ok) continue;
      const headers = new Headers(response.headers);
      headers.set('Access-Control-Allow-Origin', '*');
      headers.set('Content-Type', 'application/rss+xml; charset=utf-8');
      return new Response(response.body, { status: 200, headers });
    } catch {}
  }
  return new Response('<?xml version="1.0"?><rss version="2.0"><channel><title>Thaalam News</title></channel></rss>', {
    status: 200,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
