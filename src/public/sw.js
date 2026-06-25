// Self-unregistering kill-switch: a prior version of this SW shipped a buggy
// fetch handler that broke clone() and corrupted static asset responses. This
// version unregisters itself so cached state on visitors' browsers gets cleared
// on next visit. The actual SW registration in app.js has also been removed.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(c => c.navigate(c.url));
  })());
});
