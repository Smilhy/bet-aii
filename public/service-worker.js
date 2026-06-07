const BETAI_SW_VERSION = 'betai-pwa-1615-mobile-only';
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
// Network-first/no-cache service worker: daje instalację PWA bez trzymania starych paczek.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
