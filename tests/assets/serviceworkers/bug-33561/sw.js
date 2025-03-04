// sw.js
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // IMPORTANT: we have to have a "fetch" listener
  // to trigger the issue.
  console.log('Fetching:', event.request.url);
});
