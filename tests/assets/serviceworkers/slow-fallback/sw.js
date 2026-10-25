self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', () => {
  // Hold the request for a while, then let it fall back to the network.
  const start = Date.now();
  while (Date.now() - start < 500) {}
});
