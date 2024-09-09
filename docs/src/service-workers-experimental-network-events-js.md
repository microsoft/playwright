---
id: service-workers-experimental
title: "(Experimental) Service Worker Network Events"
---

## Introduction

:::warning
If you're looking to do general network mocking, routing, and interception, please see the [Network Guide](./network.md) first. Playwright provides built-in APIs for this use case that don't require the information below. However, if you're interested in requests made by Service Workers themselves, please read below.
:::

[Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) provide a browser-native method of handling requests made by a page with the native [Fetch API (`fetch`)](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) along with other network-requested assets (like scripts, css, and images).

They can act as a **network proxy** between the page and the external network to perform caching logic or can provide users with an offline experience if the Service Worker adds a [FetchEvent](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent#examples) listener.

Many sites that use Service Workers simply use them as a transparent optimization technique. While users might notice a faster experience, the app's implementation is unaware of their existence. Running the app with or without Service Workers enabled appears functionally equivalent.

## How to Enable

Playwright's inspection and routing of requests made by Service Workers are **experimental** and disabled by default.

Set the `PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS` environment variable to `1` (or any other value) to enable the feature. Only Chrome/Chromium are currently supported.

If you're using (or are interested in using this feature), please comment on [this issue](https://github.com/microsoft/playwright/issues/15684) letting us know your use case.

## Service Worker Fetch

### Accessing Service Workers and Waiting for Activation

You can use [`method: BrowserContext.serviceWorkers`] to list the Service [Worker]s, or specifically watch for the Service [Worker] if you anticipate a page will trigger its [registration](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register):

```js
const serviceWorkerPromise = context.waitForEvent('serviceworker');
await page.goto('/example-with-a-service-worker.html');
const serviceworker = await serviceWorkerPromise;
```

[`event: BrowserContext.serviceWorker`] is fired ***before*** the Service Worker's main script has been evaluated, so ***before*** calling service[`method: Worker.evaluate`] you should wait on its activation.

There are more idiomatic methods of waiting for a Service Worker to be activated, but the following is an implementation agnostic method:

```js
await page.evaluate(async () => {
  const registration = await window.navigator.serviceWorker.getRegistration();
  if (registration.active?.state === 'activated')
    return;
  await new Promise(res =>
    window.navigator.serviceWorker.addEventListener('controllerchange', res),
  );
});
```

### Network Events and Routing

Any network request made by the **Service Worker** will have:

* [`event: BrowserContext.request`] and its corresponding events ([`event: BrowserContext.requestFinished`] and [`event: BrowserContext.response`], or [`event: BrowserContext.requestFailed`])
* [`method: BrowserContext.route`] will see the request
* [`method: Request.serviceWorker`] will be set to the Service [Worker] instance, and [`method: Request.frame`] will **throw**
* [`method: Response.fromServiceWorker`] will return `false`

Additionally, any network request made by the **Page** (including its sub-[Frame]s) will have:

* [`event: BrowserContext.request`] and its corresponding events ([`event: BrowserContext.requestFinished`] and [`event: BrowserContext.response`], or [`event: BrowserContext.requestFailed`])
* [`event: Page.request`] and its corresponding events ([`event: Page.requestFinished`] and [`event: Page.response`], or [`event: Page.requestFailed`])
* [`method: Page.route`] and [`method: Page.route`] will **not** see the request (if a Service Worker's fetch handler was registered)
* [`method: Request.serviceWorker`] will be set to `null`, and [`method: Request.frame`] will return the [Frame]
* [`method: Response.fromServiceWorker`] will return `true` (if a Service Worker's fetch handler was registered)

Many Service Worker implementations simply execute the request from the page (possibly with some custom caching/offline logic omitted for simplicity):

```js title="transparent-service-worker.js"
self.addEventListener('fetch', event => {
  // actually make the request
  const responsePromise = fetch(event.request);
  // send it back to the page
  event.respondWith(responsePromise);
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});
```

If a page registers the above Service Worker:

```html
<!-- filename: index.html -->
<script>
  window.registrationPromise = navigator.serviceWorker.register('/transparent-service-worker.js');
</script>
```

On the first visit to the page via [`method: Page.goto`], the following Request/Response events would be emitted (along with the corresponding network lifecycle events):

| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |
| -                                 | -                | -                              | -      | -                                      |
| [`event: BrowserContext.request`] | [Frame]          | index.html                     | Yes    |                                        |
| [`event: Page.request`]           | [Frame]          | index.html                     | Yes    |                                        |
| [`event: BrowserContext.request`] | Service [Worker] | transparent-service-worker.js  | Yes    |                                        |
| [`event: BrowserContext.request`] | Service [Worker] | data.json                      | Yes    |                                        |
| [`event: BrowserContext.request`] | [Frame]          | data.json                      |        | Yes                                    |
| [`event: Page.request`]           | [Frame]          | data.json                      |        | Yes                                    |



Since the example Service Worker just acts a basic transparent "proxy":

* There's 2 [`event: BrowserContext.request`] events for `data.json`; one [Frame]-owned, the other Service [Worker]-owned.
* Only the Service [Worker]-owned request for the resource was routable via [`method: BrowserContext.route`]; the [Frame]-owned events for `data.json` are not routeable, as they would not have even had the possibility to hit the external network since the Service Worker has a fetch handler registered.

:::caution
It's important to note: calling [`method: Request.frame`] or [`method: Response.frame`] will **throw** an exception, if called on a [Request]/[Response] that has a non-null [`method: Request.serviceWorker`].
:::


#### Advanced Example

When a Service Worker handles a page's request, the Service Worker can make 0 to n requests to the external network. The Service Worker might respond directly from a cache, generate a response in memory, rewrite the request, make two requests and then combine into 1, etc.

Consider the code snippets below to understand Playwright's view into the Request/Responses and how it impacts routing in some of these cases.


```js title="complex-service-worker.js"
self.addEventListener('install', function(event) {
  event.waitUntil(
      caches.open('v1').then(function(cache) {
      // 1. Pre-fetches and caches /addressbook.json
        return cache.add('/addressbook.json');
      })
  );
});

// Opt to handle FetchEvent's from the page
self.addEventListener('fetch', event => {
  event.respondWith(
      (async () => {
        // 1. Try to first serve directly from caches
        const response = await caches.match(event.request);
        if (response)
          return response;

        // 2. Re-write request for /foo to /bar
        if (event.request.url.endsWith('foo'))
          return fetch('./bar');

        // 3. Prevent tracker.js from being retrieved, and returns a placeholder response
        if (event.request.url.endsWith('tracker.js')) {
          return new Response('console.log("no trackers!")', {
            status: 200,
            headers: { 'Content-Type': 'text/javascript' },
          });
        }

        // 4. Otherwise, fallthrough, perform the fetch and respond
        return fetch(event.request);
      })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(clients.claim());
});
```

And a page that simply registers the Service Worker:

```html
<!-- filename: index.html -->
<script>
  window.registrationPromise = navigator.serviceWorker.register('/complex-service-worker.js');
</script>
```

On the first visit to the page via [`method: Page.goto`], the following Request/Response events would be emitted:

| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |
| -                                 | -                | -                              | -      | -                                      |
| [`event: BrowserContext.request`] | [Frame]          | index.html                     | Yes    |                                        |
| [`event: Page.request`]           | [Frame]          | index.html                     | Yes    |                                        |
| [`event: BrowserContext.request`] | Service [Worker] | complex-service-worker.js      | Yes    |                                        |
| [`event: BrowserContext.request`] | Service [Worker] | addressbook.json               | Yes    |                                        |

It's important to note that [`cache.add`](https://developer.mozilla.org/en-US/docs/Web/API/Cache/add) caused the Service Worker to make a request (Service [Worker]-owned), even before `addressbook.json` was asked for in the page.

Once the Service Worker is activated and handling FetchEvents, if the page makes the following requests:

```js
await page.evaluate(() => fetch('/addressbook.json'));
await page.evaluate(() => fetch('/foo'));
await page.evaluate(() => fetch('/tracker.js'));
await page.evaluate(() => fetch('/fallthrough.txt'));
```

The following Request/Response events would be emitted:

| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |
| -                                 | -                | -                              | -      | -                                      |
| [`event: BrowserContext.request`] | [Frame]          | addressbook.json               |        | Yes                                    |
| [`event: Page.request`]           | [Frame]          | addressbook.json               |        | Yes                                    |
| [`event: BrowserContext.request`] | Service [Worker] | bar                            | Yes    |                                        |
| [`event: BrowserContext.request`] | [Frame]          | foo                            |        | Yes                                    |
| [`event: Page.request`]           | [Frame]          | foo                            |        | Yes                                    |
| [`event: BrowserContext.request`] | [Frame]          | tracker.js                     |        | Yes                                    |
| [`event: Page.request`]           | [Frame]          | tracker.js                     |        | Yes                                    |
| [`event: BrowserContext.request`] | Service [Worker] | fallthrough.txt                | Yes    |                                        |
| [`event: BrowserContext.request`] | [Frame]          | fallthrough.txt                |        | Yes                                    |
| [`event: Page.request`]           | [Frame]          | fallthrough.txt                |        | Yes                                    |

It's important to note:

* The page requested `/foo`, but the Service Worker requested `/bar`, so there are only [Frame]-owned events for `/foo`, but not `/bar`.
* Likewise, the Service Worker never hit the network for `tracker.js`, so only [Frame]-owned events were emitted for that request.

## Routing Service Worker Requests Only

```js
await context.route('**', async route => {
  if (route.request().serviceWorker()) {
    // NB: calling route.request().frame() here would THROW
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

