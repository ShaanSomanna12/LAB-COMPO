// Minimal Service Worker to satisfy PWA requirements
const CACHE_NAME = 'lab-connect-cache-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Only handle HTTP/HTTPS GET requests. Filter out chrome-extension, websockets, local dev hot-reloads, and other non-GET methods.
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    !url.protocol.startsWith('http') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.includes('webpack-hmr') ||
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1'
  ) {
    return;
  }

  // Pass-through fetch handler required for Chrome install prompts.
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
