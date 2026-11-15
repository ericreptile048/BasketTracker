// Service worker : tout le site est gardé dans le téléphone au premier chargement, l'app marche ensuite sans réseau.
// Quand un fichier de l'app change, change CACHE (basket-v3, v4...) pour forcer la mise à jour.
const CACHE = 'basket-v3';
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
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit ||
    fetch(e.request).catch(() => caches.match('./index.html'))));
});
