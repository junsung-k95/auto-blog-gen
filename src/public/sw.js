const CACHE = 'abg-v2';
const STATIC = ['/manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Never cache APIs, the SPA shell, or the core CSS/JS — always go to network.
  const NEVER_CACHE = /^\/(api\/|app\.js|style\.css|sw\.js|$)/;
  if (request.url.includes('/api/') || NEVER_CACHE.test(url.pathname) || request.mode === 'navigate') {
    return; // let the browser handle it normally
  }

  // For other static-ish assets, network-first with cache fallback.
  e.respondWith(
    fetch(request).then(res => {
      if (res.ok) caches.open(CACHE).then(c => c.put(request, res.clone()));
      return res;
    }).catch(() => caches.match(request))
  );
});
