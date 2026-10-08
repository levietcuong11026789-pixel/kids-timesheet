// ── SERVICE WORKER — kids-timesheet ─────────────
// ⬆️ MỖI KHI CẬP NHẬT APP, CHỈ CẦN ĐỔI SỐ VERSION NÀY
const APP_VERSION = '3.7.0';
const CACHE_NAME = `kids-v${APP_VERSION}`;

const ASSETS = [
  './',
  './index.html',
  './style.css?v=3.7.0',
  './app.js?v=3.7.0',
  './firebase-config.js',
  './manifest.json',
  './version.json'
];

// Install: cache assets, activate immediately
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activate: delete old caches, claim all clients, and force refresh clients
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: network-first for everything, fallback to cache for offline
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // Always fetch fresh HTML/JS/CSS/JSON when online
  if (e.request.mode === 'navigate' || url.pathname.endsWith('.js') || url.pathname.endsWith('.css') || url.pathname.endsWith('.html') || url.pathname.endsWith('.json')) {
    e.respondWith(
      fetch(e.request, { cache: 'no-store' })
        .then(res => {
          if (res && res.status === 200 && res.type === 'basic') {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(e.request, resClone));
          }
          return res;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

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
