// 箔 Service Worker — index.html の APP_BUILD を上げたらここも上げる
const CACHE = 'haku-note-b10';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png', './favicon.png'];
const SHARE = 'haku-share'; // 共有で受け取ったPDFの一時置き場
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';
const PDF_FILES = ['build/pdf.min.js', 'build/pdf.worker.min.js', 'cmaps/UniJIS-UCS2-H.bcmap', 'cmaps/UniJIS-UTF16-H.bcmap', 'cmaps/Adobe-Japan1-UCS2.bcmap', 'cmaps/90ms-RKSJ-H.bcmap'].map(p => PDFJS + p);

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(CORE);
    // PDF解析ライブラリは取れたら入れておく（オフライン取り込み用）
    await Promise.all(PDF_FILES.map(u => c.add(u).catch(() => {})));
  }));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE && k !== SHARE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method === 'POST' && url.origin === location.origin && url.pathname.endsWith('/share-target')) {
    // LINEなどの「共有」から届いたPDFを一時保存して、アプリを開き直す
    e.respondWith((async () => {
      try {
        const f = (await req.formData()).get('pdf');
        if (f && typeof f !== 'string') {
          const c = await caches.open(SHARE);
          await c.put('./shared-pdf', new Response(f, { headers: { 'Content-Type': 'application/pdf', 'X-Name': encodeURIComponent(f.name || 'shift.pdf') } }));
        }
      } catch (err) { }
      return Response.redirect('./?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {
    // 自サイト：ネット優先、圏外ならキャッシュ
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const cp = r.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return r;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html'))));
  } else if (url.href.startsWith(PDFJS)) {
    // pdf.js：キャッシュ優先
    e.respondWith(caches.match(req).then(r => r || fetch(req).then(res => {
      if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(c => c.put(req, cp)); }
      return res;
    })));
  }
});
