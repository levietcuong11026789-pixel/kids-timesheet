// ── SERVICE WORKER — kids-timesheet ─────────────
// ⬆️ MỖI KHI CẬP NHẬT APP, CHỈ CẦN ĐỔI SỐ VERSION NÀY
const APP_VERSION = '3.6.1';
const CACHE_NAME = `kids-v${APP_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './firebase-config.js',
  './manifest.json'
];

// Install: cache assets, activate immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches, claim all clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for everything, fallback to cache for offline
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        if (res && res.status === 200 && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ✅ Lắng nghe lệnh SKIP_WAITING từ app.js
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
