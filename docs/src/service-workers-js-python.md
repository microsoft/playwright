---
id: service-workers
title: "Service Workers"
---

## Introduction

:::warning
Service workers are only supported on Chromium-based browsers.
:::


:::note
If you're looking to do general network mocking, routing, and interception, please see the [Network Guide](./network.md) first. Playwright provides built-in APIs for this use case that don't require the information below. However, if you're interested in requests made by Service Workers themselves, please read below.
:::

[Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) provide a browser-native method of handling requests made by a page with the native [Fetch API (`fetch`)](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) along with other network-requested assets (like scripts, css, and images).

They can act as a **network proxy** between the page and the external network to perform caching logic or can provide users with an offline experience if the Service Worker adds a [FetchEvent](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent#examples) listener.

Many sites that use Service Workers simply use them as a transparent optimization technique. While users might notice a faster experience, the app's implementation is unaware of their existence. Running the app with or without Service Workers enabled appears functionally equivalent.

## How to Disable Service Workers
* langs: js

Playwright allows to disable Service Workers during testing. This makes tests more predictable and performant. However, if your actual page uses a Service Worker, the behavior might be different.

To disable service workers, set [`property: TestOptions.serviceWorkers`] to `'block'`.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    serviceWorkers: 'allow'
  },
});
```

## How to Disable Service Workers
* langs: python

Playwright allows to disable Service Workers during testing. This makes tests more predictable and performant. However, if your actual page uses a Service Worker, the behavior might be different.

To disable service workers, set `service_workers` context option to `"block"`.

```python title="conftest.py"
import pytest

@pytest.fixture(scope="session")
def browser_context_args(browser_context_args):
    return {
        **browser_context_args,
        "service_workers": "block"
    }
```

## Accessing Service Workers and Waiting for Activation

You can use [`method: BrowserContext.serviceWorkers`] to list the Service [Worker]s, or specifically watch for the Service [Worker] if you anticipate a page will trigger its [registration](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register):

```js
const serviceWorkerPromise = context.waitForEvent('serviceworker');
await page.goto('/example-with-a-service-worker.html');
const serviceworker = await serviceWorkerPromise;
```

```python sync
with context.expect_event("serviceworker") as worker_info:
  page.goto("/example-with-a-service-worker.html")
service_worker = worker_info.value
```

```python async
async with context.expect_event("serviceworker") as worker_info:
  await page.goto("/example-with-a-service-worker.html")
service_worker = await worker_info.value
```

[`event: BrowserContext.serviceWorker`] event is fired ***before*** the Service Worker has taken control over the page, so ***before*** evaluating in the worker with [`method: Worker.evaluate`] you should wait on its activation.

There are more idiomatic methods of waiting for a Service Worker to be activated, but the following is an implementation agnostic method:

```js
await page.evaluate(async () => {
  const registration = await window.navigator.serviceWorker.getRegistration();
  if (registration.active?.state === 'activated')
    return;
  await new Promise(resolve => {
    window.navigator.serviceWorker.addEventListener('controllerchange', resolve);
  });
});
```

```python sync
page.evaluate("""async () => {
  const registration = await window.navigator.serviceWorker.getRegistration();
  if (registration.active?.state === 'activated')
    return;
  await new Promise(resolve => {
    window.navigator.serviceWorker.addEventListener('controllerchange', resolve);
  });
}""")
```

```python async
await page.evaluate("""async () => {
  const registration = await window.navigator.serviceWorker.getRegistration();
  if (registration.active?.state === 'activated')
    return;
  await new Promise(resolve => {
    window.navigator.serviceWorker.addEventListener('controllerchange', resolve);
  });
}""")
```

## Network Events and Routing

Any network request made by the **Service Worker** is reported through the [BrowserContext] object:

* [`event: BrowserContext.request`], [`event: BrowserContext.requestFinished`], [`event: BrowserContext.response`] and [`event: BrowserContext.requestFailed`] are fired
* [`method: BrowserContext.route`] sees the request
* [`method: Request.serviceWorker`] will be set to the Service [Worker] instance, and [`method: Request.frame`] will **throw**

Additionally, for any network request made by the **Page**, method [`method: Response.fromServiceWorker`] return `true` when the request was handled a Service Worker's fetch handler.

Consider a simple service worker that fetches every request made by the page:

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

If `index.html` registers this service worker, and then fetches `data.json`, the following Request/Response events would be emitted (along with the corresponding network lifecycle events):

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


## Routing Service Worker Requests Only

```js
await context.route('**', async route => {
  if (route.request().serviceWorker()) {
    // NB: calling route.request().frame() here would THROW
    await route.fulfill({
      contentType: 'text/plain',
      status: 200,
      body: 'from sw',
    });
  } else {
    await route.continue();
  }
});
```

```python sync
def handle_route(route: Route):
  if route.request.service_worker:
    # NB: accessing route.request.frame here would THROW
    route.fulfill(content_type="text/plain", status=200, body="from sw")
  else:
    route.continue_()

context.route("**", handle_route)
```

```python async
async def handle_route(route: Route):
  if route.request.service_worker:
    # NB: accessing route.request.frame here would THROW
    await route.fulfill(content_type="text/plain", status=200, body="from sw")
  else:
    await route.continue_()

await context.route("**", handle_route)
```

## Known Limitations

Requests for updated Service Worker main script code currently cannot be routed (https://github.com/microsoft/playwright/issues/14711).

