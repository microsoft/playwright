self.intercepted = [];

self.addEventListener('fetch', event => {
  if (event.origin !== 'undefined') // To identyfy event's origin
    return;
  self.intercepted.push(event.request.url)
  event.respondWith(fetch(event.request));
});

self.addEventListener('activate', event => {
  if (event.origin !== 'undefined') // To identyfy event's origin
    return;
  event.waitUntil(clients.claim());
});

fetch('/request-from-within-worker.txt')
