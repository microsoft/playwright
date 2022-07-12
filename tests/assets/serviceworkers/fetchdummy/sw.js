self.addEventListener('fetch', event => {
  if (event.request.url.endsWith('.html') || event.request.url.includes('passthrough')) {
    event.respondWith(fetch(event.request));
    return;
  }
  if (event.request.url.includes('error')) {
    event.respondWith(Promise.reject(new Error('uh oh')));
    return;
  }
  const slash = event.request.url.lastIndexOf('/');
  const name = event.request.url.substring(slash + 1);
  const blob = new Blob(["responseFromServiceWorker:" + name], {type : 'text/css'});
  const response = new Response(blob, { "status" : 200 , "statusText" : "OK" });
  event.respondWith(response);
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});
