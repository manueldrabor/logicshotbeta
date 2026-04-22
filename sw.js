/* ══════════════════════════════════════
   sw.js — Service Worker LogicShot PWA
══════════════════════════════════════ */
const CACHE_NAME = 'logicshot-v4';
const ASSETS = [
  './',
  './index.html',
  './logicshot.css',
  './logicshot.js',
  './state.js',
  './audio.js',
  './ui.js',
  './formula.js',
  './battle.js',
  './online.js',
  './survival.js',
  './manifest.json',
  './Smooth_In_Heights_2026v2.mp3',
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
  const url = e.request.url;
  /* Ne jamais mettre en cache les appels analytics */
  if (url.includes('google-analytics.com') ||
      url.includes('googletagmanager.com') ||
      url.includes('clarity.ms')) return;
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
