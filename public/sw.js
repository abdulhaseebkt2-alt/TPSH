// TPS Hostel IRP Service Worker
const CACHE_NAME = 'tps-irp-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API requests, Supabase calls, or sensitive student records
  if (url.hostname.includes('supabase.co') || url.pathname.startsWith('/rest/v1') || url.pathname.startsWith('/auth/v1')) {
    return;
  }

  // Stale-while-revalidate for static assets only
  if (event.request.method === 'GET' && (event.request.destination === 'style' || event.request.destination === 'script' || event.request.destination === 'image' || event.request.destination === 'font')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        }).catch(() => cachedResponse);
        return cachedResponse || fetchPromise;
      })
    );
  }
});
