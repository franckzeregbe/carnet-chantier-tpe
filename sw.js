// Service worker : met toute l'application en cache pour fonctionner sans réseau.
const VERSION = 'vn-chantier-v7';
const FICHIERS = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css?v=7',
  'js/app.js?v=7',
  'js/util.js',
  'js/db.js',
  'js/data.js',
  'js/calc.js',
  'js/store.js',
  'js/ui.js',
  'js/reports.js',
  'js/views/accueil.js',
  'js/views/latrines.js',
  'js/views/journal.js',
  'js/views/argent.js',
  'js/views/stock.js',
  'js/views/equipe.js',
  'js/views/plus.js',
  'js/views/profil.js',
  'js/views/reglages.js',
  'fonts/montserrat-latin.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(FICHIERS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Chaque version est un bloc complet : la page et tous ses fichiers viennent du MÊME cache.
// Une mise à jour (nouvelle VERSION) n'est utilisée qu'une fois entièrement téléchargée (addAll atomique),
// donc une coupure de réseau pendant la mise à jour ne peut pas mélanger deux versions.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const enCache = await cache.match(req.mode === 'navigate' ? 'index.html' : req);
      if (enCache) return enCache;
      try {
        return await fetch(req);
      } catch {
        return new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
      }
    }),
  );
});
