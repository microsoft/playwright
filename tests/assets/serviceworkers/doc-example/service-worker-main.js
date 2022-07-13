self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open("v1").then(function (cache) {
      // 1. Pre-fetches and caches `./addressbook.json`
      return cache.add("./addressbook.json");
    })
  );
});

// Opt to handle FetchEvent's from the page
self.addEventListener("fetch", (event) => {
  event.respondWith(
    (async () => {
      // 1. Try to first serve directly from caches
      let response = await caches.match(event.request);
      if (response) return response;

      // 2. Re-write request for /foo to /bar
      if (event.request.url.endsWith("foo")) return fetch("./bar");

      // 3. Prevent `tracker.js` from being retrieved, and returns a placeholder response
      if (event.request.url.endsWith("tracker.js"))
        return new Response('conosole.log("no trackers!")', {
          status: 200,
          headers: { "Content-Type": "text/javascript" },
        });

      // 4. Otherwise, fallthrough, perform the fetch and respond
      return fetch(event.request);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
