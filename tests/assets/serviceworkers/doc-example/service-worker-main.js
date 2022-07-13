self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open("v1").then(function (cache) {
      // 1. Pre-fetches and caches `./addressbook.json`
      return cache.add("./addressbook.json");
    })
  );
});

// Opt to handle FetchEvent's from the page
self.addEventListener("fetch", async (event) => {
  // 1. Serves requests directly from the cache
  let response = await caches.match(event.request);
  if (response) return event.respondWith(response);

  // 2. Re-write any requests ending with `.jpg` to `.png` before `fetch`ing them
  if (event.request.url.endsWith(".jpg")) {
    const rewritten = event.request.clone();
    rewritten.url = rewritten.url.replace(".jpg", ".png");
    const response = fetch(rewritten);
    return event.respondWith(response);
  }

  // 3. Prevent `tracker.js` from being retrieved, and returns a placeholder response
  if (event.request.url.endsWith("tracker.js"))
    return event.respondWith(
      new Response('conosole.log("no trackers!")', {
        status: 200,
        headers: { "Content-Type": "text/javascript" },
      })
    );

  // 4. Otherwise, fallthrough, perform the fetch and respond
  event.respondWith(fetch(event.request));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});
