/* Grid Iron service worker: offline play + quick updates */
const VERSION = 'gridiron-v1.0.0-dev';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'js/data.js', 'js/icons.js', 'js/playbook.js', 'js/stadium.js', 'js/sim.js', 'js/cards.js', 'js/dev.js', 'js/rating.js', 'js/crests.js', 'js/season.js', 'js/league.js', 'js/legacy.js', 'js/audio.js', 'js/anim.js', 'js/ui.js', 'js/ui-franchise.js', 'js/ui-extra.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/favicon.svg',
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isFont = url.host.includes('fonts.googleapis.com') || url.host.includes('fonts.gstatic.com');
  if (url.origin === location.origin) {
    // network first for app files so updates land fast; cache fallback offline
    e.respondWith(fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    }).catch(() => caches.match(req).then((r) => r || caches.match('index.html'))));
  } else if (isFont) {
    e.respondWith(caches.match(req).then((r) => r || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
      return res;
    })));
  }
});
