# Working With Network

![playwright network](https://user-images.githubusercontent.com/746130/79428385-f0264900-7f7a-11ea-86e6-cd03190b8de7.png)

Playwright provides APIs to **monitor** and **modify** network traffic, both HTTP and HTTPS.
Any requests that page does, including [XHRs](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) and
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) requests, can be tracked and modified.


> **NOTE** As of playwright v0.13.0, Playwright is not yet capable of tracking websocket messages.


## Monitor all network activity in page

```js
const page = await browser.newPage();
page.on('request', request => console.log('>>', request.method(), request.url()));
page.on('response', response => console.log('<<', response.status(), response.url()));
await page.goto('https://example.com');
```

#### API reference

- [`event: 'request'`](./api.md#event-request)
- [`event: 'response'`](./api.md#event-response)
- [`request.method()`](./api.md#requestmethod)
- [`request.url()`](./api.md#requesturl)


## Wait for a response from API endpoint after button click

```js
const [response] = await Promise.all([
  page.waitForResponse('/api/fetch_data'),
  page.click('button[type=submit]'),
]);
```

#### API reference

- [`page.waitForRequest(urlOrPredicate[, options])`](./api.md#pagewaitforrequesturlorpredicate-options)
- [`page.waitForResponse(urlOrPredicate[, options])`](./api.md#pagewaitforresponseurlorpredicate-options)



## Mock API endpoint with test data

```js
await page.route('/api/fetch_data', route => route.fulfill({
  status: 200,
  body: testData,
}));
await page.goto('https://example.com');
```

You can also use [`browserContext.route`](./api.md#browsercontextrouteurl-handler) to mock
API endpoints for all the pages in the context.

#### API reference

- [`page.route(url, handler)`](./api.md#pagerouteurl-handler)
- [`browserContext.route(url, handler)`](./api.md#browsercontextrouteurl-handler)
- [`route.fulfill(response)`](./api.md#routefulfillresponse)



## Abort all images to speedup page load

```js
const page = await browser.newPage();
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
await page.goto('https://example.com');
```

You can also use [`browserContext.route`](./api.md#browsercontextrouteurl-handler) to abort
images for all pages in the context, including popups.

#### API reference

- [`page.route(url, handler)`](./api.md#pagerouteurl-handler)
- [`browserContext.route(url, handler)`](./api.md#browsercontextrouteurl-handler)
- [`route.abort([errorCode])`](./api.md#routeaborterrorcode)



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
