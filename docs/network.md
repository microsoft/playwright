# Working With Network

Playwright provides APIs to **monitor** and **modify** network traffic, both HTTP and HTTPS.
Any requests that page does, including [XHRs](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) and
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) requests, can be tracked and modified.


> **NOTE** As of playwright v0.13.0, Playwright is not yet capable of tracking websocket messages.


## Monitor all network activity in page

```js
const { chromium, webkit, firefox } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Subscribe to 'request' and 'response' events.S
  page.on('request', request =>
      console.log('>>', request.method(), request.url()));
  page.on('response', response =>
      console.log('<<', response.status(), response.url()));
  await page.goto('https://example.com');

  await browser.close();
})();
```

#### API reference

- [`Request`](./api.md#class-request)
- [`Response`](./api.md#class-response)
- [`event: 'request'`](./api.md#event-request)
- [`event: 'response'`](./api.md#event-response)

<br/>

## Wait for a network response after the button click

```js
const [response] = await Promise.all([
  page.waitForResponse('/api/fetch_data'),
  page.click('button#update'),
]);
```

The snippet above clicks a button and waits for the network response that matches the given pattern.

#### Variations

```js
// User glob URL pattern
const [response] = await Promise.all([
  page.waitForResponse('**/*'),
  page.click('button#update'),
]);

// User pattern predicate
const [response] = await Promise.all([
  page.waitForResponse(url => url.includes(token)),
  page.click('button#update'),
]);
```

#### API reference

- [`page.waitForRequest(urlOrPredicate[, options])`](./api.md#pagewaitforrequesturlorpredicate-options)
- [`page.waitForResponse(urlOrPredicate[, options])`](./api.md#pagewaitforresponseurlorpredicate-options)

<br/>

## Mock API endpoint with the test data

```js
await page.route('/api/fetch_data', route => route.fulfill({
  status: 200,
  body: testData,
}));
await page.goto('https://example.com');
```

You can also use [`browserContext.route`](./api.md#browsercontextrouteurl-handler) to mock
API endpoints for all the pages in the context.

#### Variations

```js
// Set up route on the entire browser context.
// It will apply to popup windows and opened links.

await browserContext.route('/api/login', route => route.fulfill({
  status: 200,
  body: 'accept',
}));
await page.goto('https://example.com');
```

#### API reference

- [`browserContext.route(url, handler)`](./api.md#browsercontextrouteurl-handler)
- [`browserContext.unroute(url[, handler])`](./api.md#browsercontextunrouteurl-handler)
- [`page.route(url, handler)`](./api.md#pagerouteurl-handler)
- [`page.unroute(url[, handler])`](./api.md#pageunrouteurl-handler)
- [`Route`](./api.md#class-route)

<br/>

## Abort selected requests

```js
const page = await browser.newPage();
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
await page.goto('https://example.com');
```

#### Variations

```js
// Abort requests based on their type.

await page.route('**/*', route => {
  return route.request().resourceType() === 'image' ?
      route.abort() : route.continue();
});
await page.goto('https://chromium.org');
```

#### API reference

- [`page.route(url, handler)`](./api.md#pagerouteurl-handler)
- [`browserContext.route(url, handler)`](./api.md#browsercontextrouteurl-handler)
- [`route.abort([errorCode])`](./api.md#routeaborterrorcode)

<br/>

## Modify selected requests


```js
await page.route('**/*', route => {
  const headers = route.request().headers();
  delete headers['X-Secret'];
  route.continue({headers});
});
await page.goto('https://chromium.org');
```

You can continue requests with modifications. Example above removes an HTTP header from the outgoing requests.

#### Variations

```js
// Continue requests as POST.

await page.route('**/*', route =>
    route.continue({method: 'POST'}));
await page.goto('https://chromium.org');
```

<br/>

## Setup [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication)

```js
const context = await browser.newContext({
  httpCredentials: {
    username: 'bill',
    password: 'pa55w0rd',
  },
});
const page = await context.newPage();
awat page.goto('https://example.com');
```

You can also use [`browserContext.setHTTPCredentials`](./api.md#browsercontextsethttpcredentialshttpcredentials) to update HTTP credentials of an existing context.

#### API reference

- [`browser.newContext([options])`](./api.md#browsernewcontextoptions)
- [`browserContext.setHTTPCredentials(httpCredentials)`](./api.md#browsercontextsethttpcredentialshttpcredentials)
