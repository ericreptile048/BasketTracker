// Service worker : l'app marche sans réseau (tout est gardé dans le téléphone),
// mais quand il y a du réseau elle prend toujours la dernière version (réseau d'abord, cache si pas de réseau ou trop lent).
const CACHE = 'basket-v5';
const FILES = ['./', './index.html', './css/app.css', './js/data.js', './js/ui.js', './js/home.js', './js/seance.js', './js/progres.js', './js/reglages.js', './js/app.js',
  './manifest.webmanifest', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  // fichier par fichier : un fichier manquant ne bloque pas l'installation
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(FILES.map(f => c.add(f).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // réseau d'abord, mais pas plus de 2,5 s (au gymnase le réseau est souvent mauvais) : sinon la copie du téléphone
  e.respondWith((async () => {
    const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; });
    try {
      const first = await Promise.race([net, new Promise(r => setTimeout(r, 2500, 'lent'))]);
      if (first !== 'lent') return first;
      return (await caches.match(req, { ignoreSearch: true })) || await net;
    } catch (err) {
      return (await caches.match(req, { ignoreSearch: true })) || (await caches.match('./index.html'));
    }
  })());
});
