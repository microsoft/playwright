const kSwHtml = `
<script>
  window.registrationPromise = navigator.serviceWorker.register('sw.js');
  window.activationPromise = navigator.serviceWorker.controller ? Promise.resolve() : new Promise(resolve => navigator.serviceWorker.oncontrollerchange = resolve);
  window.fromSW = true;
</script>
`;

self.addEventListener('fetch', event => {
  if (event.request.url.endsWith('sw.html')) {
    const blob = new Blob([kSwHtml], { type: 'text/html' });
    const response = new Response(blob, { status: 200 , statusText: 'OK' });
    event.respondWith(response);
    return;
  }
  if (event.request.url.includes('error')) {
    event.respondWith(Promise.reject(new Error('uh oh')));
    return;
  }
  const slash = event.request.url.lastIndexOf('/');
  const name = event.request.url.substring(slash + 1);
  const blob = new Blob(['responseFromServiceWorker:' + name], { type: name.endsWith('.css') ? 'text/css' : 'application/javascript' });
  const response = new Response(blob, {status: 200 , statusText: 'OK' });
  event.respondWith(response);
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});
