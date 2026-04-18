// Onko·Pharm Service Worker — Offline-First für die Lern-App
const CACHE_VERSION = 'onko-pharm-v2';
const PRECACHE_URLS = [
  './',
  './onko-lern-app.html',
  './manifest.json',
];

// Install: pre-cache the app shell (do NOT auto-skipWaiting — wait for user consent)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => Promise.resolve());
    })
  );
});

// Listen for messages from the app (e.g. "apply update now")
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate: clean up old caches and take control
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for app shell, network-first for Google Fonts (with cache fallback)
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Google Fonts: network-first, fallback to cache
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Same-origin or app resources: cache-first, fallback to network, fallback to app shell
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        // Cache successful responses for later offline use
        if (res.ok && res.type === 'basic') {
          const resClone = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, resClone));
        }
        return res;
      }).catch(() => {
        // Offline and not in cache: serve app shell as fallback for navigation
        if (req.mode === 'navigate') {
          return caches.match('./onko-lern-app.html');
        }
      });
    })
  );
});
