---
id: service-worker-network-interception
title: "Service Worker Network Interception (Chromium)"
---

:::note
Service Worker Network instrumentation only works in Chrome / Chromium. If you want full network interception in Firefox and WebKit, you can disable Service Workers by setting [`option: Browser.newContext.serviceWorkers`] to `'block'`.
:::

If a site uses [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API), Playwright's standard set of Network Events and Interception/Routing will work. Service Workers have complex lifecycles and can intercept Network Requests themselves, so there are a few things to note.

## Event Targets

Network events for a [`fetch`](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) call made within the Service Worker are emitted on the [BrowserContext].

If the Service Worker's implementation looks like:

```js
// service-worker.js
const config = fetch("/example.txt");

self.addEventListener("fetch", async event => {
  // Make some requests
  const aResp = await fetch("/a.txt");
  const bResp = await fetch("/b.txt");
  const combinedText = await aResp.text() + await bResp.text();
  const respForPage = new Response(combinedText, { status: 200, headers: { 'Content-Type': 'text/plain', 'X-Header-Added-By-SW': 'hi!' } });

  // Fulfill the request for the page
  event.respondWith(respForPage);
});
```

[`event: BrowserContext.request`] would be emitted each time `fetch("/example.txt")`, `fetch("/a.txt")` and `fetch("/b.txt")` are called.

A [Route] can be setup to intercept these requests via [`method: BrowserContext.route`], too.

If a `fetch` call is made in a page where a Service Worker is registered with a [`FetchEvent` handler](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent#examples), a [`event: Page.request`] ***and*** [`event: BrowserContext.request`] will be emitted for the request associated with the page, in addition to the two [`event: BrowserContext.request`] events that are emitted on behalf of the `fetch("/a.txt")` and `fetch("/b.txt")`. 

The request coming from the page will not be interceptable or routeable at the page- or context-level.

## Caveats: Multiple Events

Most Service Worker's will just intercept a Page's `fetch` events, and then make the `fetch` themselves:

```js
// service-worker.js
self.addEventListener("fetch", async event => {
  event.respondWith(fetch(event.request));
});
```

In this case, calling `fetch('/data.json')` in the page, would trigger emit context-level events for the request within the Service Worker, plus a page- and context-level set of events.

```js 
await Promise.all([
  page.waitForEvent('request', r => r.url().endsWith('/data.json')), // fetch within the Page
  context.waitForEvent('request', r => r.url().endsWith('/data.json') && !r.serviceWorker()), // fetch within the Page
  context.waitForEvent('request', r => r.url().endsWith('/data.json') && r.serviceWorker() === null), // fetch within the Service Worker, the second condition could also be written as r.fromServiceWorker()
  page.evaluate(() => fetch('/data.json')),
]);
```

## Intercepting Service Worker Requests Only

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

## Intercepting the Main Service Worker Script

The initial request for the Service Worker's script can be intercepted via [`method: BrowserContext.route`].

## Disabling Service Workers

You can disable Service Workers when using request interception by setting [`option: Browser.newContext.serviceWorkers`] to `'block'`.

## Waiting for Activation

If you want want to ensure a Service Worker is activated before continuing some actions, you can use:

```js
await page.waitForFunction('navigator.serviceWorker.ready');
```

The [`BrowserContext.serviceworker`] event is emitted ***before*** the Service Worker main script has been evaluated, so before calling [ServiceWorker.evaluate] you should wait on its activation.  

## Known Limitations

* Requests for updated Service Worker main script code currently cannot be intercepted (https://github.com/microsoft/playwright/issues/14711).

