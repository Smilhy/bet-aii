const CACHE = 'betai-mobile-lite-v56-1'
const SHELL = ['/app/', '/app/manifest.webmanifest', '/app/icon-192.png', '/app/icon-512.png']
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).catch(() => null)))
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('betai-mobile-lite-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())))
self.addEventListener('fetch', event => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== location.origin) return
  if (url.pathname.startsWith('/.netlify/functions/')) return
  if (req.mode === 'navigate' && url.pathname.startsWith('/app')) {
    event.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('/app/', copy)); return res }).catch(() => caches.match('/app/')))
    return
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/app/')) {
    event.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) } return res })))
  }
})
