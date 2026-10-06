/* ISO·CHANTIER — fonctionnement hors ligne */
const CACHE = 'iso-chantier-v2';
const CORE = ['./', './index.html', './manifest.webmanifest',
  './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-192.png', './icons/maskable-512.png'];
const FONTS = /^https:\/\/fonts\.(googleapis|gstatic)\.com\//;
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE)
    .then((c) => Promise.all(CORE.map((u) => c.add(new Request(u, { cache: 'reload' })).catch(() => {}))))
    .then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const url = new URL(r.url);
  // polices Google : cache d'abord (elles ne changent pas)
  if (FONTS.test(r.url)) {
    e.respondWith(caches.open(CACHE).then((c) => c.match(r).then((hit) => hit || fetch(r).then((res) => {
      if (res && (res.ok || res.type === 'opaque')) c.put(r, res.clone());
      return res;
    }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      // réseau d'abord (mises à jour), abandon après 4 s si le réseau du chantier est trop faible
      const res = await Promise.race([fetch(r), new Promise((_, rej) => setTimeout(() => rej(new Error('lent')), 4000))]);
      if (res && res.ok) cache.put(r, res.clone());
      return res;
    } catch (err) {
      const hit = await cache.match(r, { ignoreSearch: true });
      if (hit) return hit;
      if (r.mode === 'navigate') return (await cache.match('./index.html')) || (await cache.match('./'));
      throw err;
    }
  })());
});
