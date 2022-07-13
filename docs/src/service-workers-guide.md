---
id: service-workers-guide
title: "Service Workers Guide"
---

## Disabling Service Workers

[Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) provide a browser-native way to handle requests made with the native [Fetch API (`fetch`)](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API).

If you're using Playwright's [Network-related features](./network.md) like the routing APIs ([`method: BrowserContext.route`], [`method: BrowserContext.routeFromHAR`], [`method: Page.route`], [`method: Page.routeFromHAR`]), or rely heavily on Network Events (e.g. [`event: Page.request`], [`event: BrowserContext.request`], etc.), we recommend disabling Service Workers by setting [`option: Browser.newContext.serviceWorkers`] to `'block'`.

Unless you're testing the Service Worker behavior itself, blocking ensures all requests are routed to your code via Playwright. It also simplifies Network-related APIs within Playwright.

If you need to visibility or routing into all Network events in Firfox or WebKit, currently `'block'`ing Service Workers is required.

## Service Worker Fetch

:::note
The next sections are only currently supported when using Playwright with Chrome/Chromium.
:::

### Accessing Service Workers and Waiting for Activation

You can use [`method: BrowserContext.serviceWorkers`] to list the Service Workers, or specifically watch for it:

```js
const [ serviceWorker ] = await Promise.all([
  context.waitForEvent('serviceworker'),
  page.goto('example-with-a-service-worker.html'),
]);
```

The [`BrowserContext.serviceworker`] event is emitted ***before*** the Service Worker main script has been evaluated, so before calling [ServiceWorker.evaluate] you should wait on its activation:

```js
await expect.poll(() => serviceWorker.evaluate(() => self.registration.active?.state)).toBe('activated');
```

## Network Events and Routing

A Network Request made within a Service Worker (along with the main script request itself) will have:

* [`event: BrowserContext.request`] event emitted
* [`method: BrowserContext.route`] will see the request
* [`method: Request.serviceWorker`] will be set to the [Service Worker] instance, and [`method: Request.frame`] will **throw**
* [`method: Response.fromServiceWorker`] will return `false`

A Network Request made within a page will have:

* [`event: BrowserContext.request`] event emitted
* [`event: Page.request`] event emitted
* [`method: BrowserContext.route`] and [`method: Page.route`] will **not** see the request (if a Service Worker's fetch handler was registered)
* [`method: Request.serviceWorker`] will be set to `null`, and [`method: Request.frame`] will return the [Frame]
* [`method: Response.fromServiceWorker`] will return `true` (if a Service Worker's fetch handler was registered)


Consider the following Service Worker Main Script:

```js
// filename: service-worker-main.js
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
```

And a Page that simply registers the Service Worker:

```html
<!-- filename: index.html -->
<script>
  window.registrationPromise = navigator.serviceWorker.register('./service-worker-main.js');
</script>
```

On the first visit to the page via [`method: Page.goto`], there would be the following events emitted:

| URL | Association |[`event: BrowserContext.request`] | [`event: Page.request`] | Routeable |
| - | - | - | - | - |
| `/index.html` | Frame | Yes | Yes | Yes |
| `/sevice-worker-main.js` | Service Worker | Yes | No | Yes |
| `/addressbook.json` | Service Worker | Yes | No | Yes | 


Once the Service Worker is activated and handling FetchEvents, if the page makes the following requests:

```js
await page.evaluate(() => fetch('./addressbook.json'));
await page.evaluate(() => fetch('./example.jpg'));
await page.evaluate(() => fetch('./tracker.js'));
await page.evaluate(() => fetch('./fallthrough.txt'));
```

The following events would be emitted:

| URL | Association |[`event: BrowserContext.request`] | [`event: Page.request`] | Routeable |
| - | - | - | - | - |
| `/addressbook.json` | Frame |  Yes | Yes | No |
| `/example.jpg` | Frame | Yes | Yes | No |
| `/example.png` | Service Worker | Yes | No | Yes |
| `/tracker.js` | Frame | Yes | Yes | No |
| `/fallthrough.txt` | Frame | Yes | Yes | No |
| `/fallthrough.txt` | Service Worker | Yes | No | Yes |

## Routing Service Worker Requests Only

```js
await context.route('**/data.json', async route => {
  if (route.request().serviceWorker()) {
    return route.fulfill({
      contentType: 'text/plain',
      status: 200,
      body: 'from sw',
    });
  } else {
    return route.continue();
  }
});
```

## Known Limitations

Requests for updated Service Worker main script code currently cannot be routed (https://github.com/microsoft/playwright/issues/14711).

