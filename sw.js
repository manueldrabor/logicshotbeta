/* ══════════════════════════════════════
   sw.js — Service Worker LogicShot PWA
══════════════════════════════════════ */
const CACHE_NAME = 'logicshot-v2';
const ASSETS = [
  '/logicshotbeta/',
  '/logicshotbeta/index.html',
  '/logicshotbeta/logicshot.css',
  '/logicshotbeta/logicshot.js',
  '/logicshotbeta/state.js',
  '/logicshotbeta/audio.js',
  '/logicshotbeta/ui.js',
  '/logicshotbeta/formula.js',
  '/logicshotbeta/battle.js',
  '/logicshotbeta/online.js',
  '/logicshotbeta/manifest.json',
  '/logicshotbeta/Smooth_In_Heights_2026v2.mp3',
  'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Syne:wght@700;800&family=Share+Tech+Mono&display=block'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(ASSETS.map(a => cache.add(a).catch(() => {})));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type === 'opaque') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      }).catch(() => cached);
    })
  );
});
