self.intercepted = [];

self.addEventListener('fetch', event => {
  self.intercepted.push(event.request.url)
  event.respondWith(fetch(event.request));
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});

fetch('/request-from-within-worker.txt')
