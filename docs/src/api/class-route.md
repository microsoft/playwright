# class: Route

Whenever a network route is set up with [`method: Page.route`] or [`method: BrowserContext.route`], the `Route`
object allows to handle the route.

## async method: Route.abort

Aborts the route's request.

### param: Route.abort.errorCode
- `errorCode` <[string]>

Optional error code. Defaults to `failed`, could be one of the following:
  * `'aborted'` - An operation was aborted (due to user action)
  * `'accessdenied'` - Permission to access a resource, other than the network, was denied
  * `'addressunreachable'` - The IP address is unreachable. This usually means that there is no route to the specified host or network.
  * `'blockedbyclient'` - The client chose to block the request.
  * `'blockedbyresponse'` - The request failed because the response was delivered along with requirements which are not met ('X-Frame-Options' and 'Content-Security-Policy' ancestor checks, for instance).
  * `'connectionaborted'` - A connection timed out as a result of not receiving an ACK for data sent.
  * `'connectionclosed'` - A connection was closed (corresponding to a TCP FIN).
  * `'connectionfailed'` - A connection attempt failed.
  * `'connectionrefused'` - A connection attempt was refused.
  * `'connectionreset'` - A connection was reset (corresponding to a TCP RST).
  * `'internetdisconnected'` - The Internet connection has been lost.
  * `'namenotresolved'` - The host name could not be resolved.
  * `'timedout'` - An operation timed out.
  * `'failed'` - A generic failure occurred.

## async method: Route.continue
* langs:
  - alias-python: continue_

Continues route's request with optional overrides.

```js
await page.route('**/*', (route, request) => {
  // Override headers
  const headers = {
    ...request.headers(),
    foo: 'bar', // set "foo" header
    origin: undefined, // remove "origin" header
  };
  route.continue({headers});
});
```

### param: Route.continue.overrides
- `overrides` <[Object]>
  - `url` <[string]> If set changes the request URL. New URL must have same protocol as original one.
  - `method` <[string]> If set changes the request method (e.g. GET or POST)
  - `postData` <[string]|[Buffer]> If set changes the post data of request
  - `headers` <[Object]<[string], [string]>> If set changes the request HTTP headers. Header values will be converted to a string.

Optional request overrides, can override following properties:

## async method: Route.fulfill

Fulfills route's request with given response.

An example of fulfilling all requests with 404 responses:

```js
await page.route('**/*', route => {
  route.fulfill({
    status: 404,
    contentType: 'text/plain',
    body: 'Not Found!'
  });
});
```

An example of serving static file:

```js
await page.route('**/xhr_endpoint', route => route.fulfill({ path: 'mock_data.json' }));
```

### param: Route.fulfill.response
- `response` <[Object]>
  - `status` <[int]> Response status code, defaults to `200`.
  - `headers` <[Object]<[string], [string]>> Optional response headers. Header values will be converted to a string.
  - `contentType` <[string]> If set, equals to setting `Content-Type` response header.
  - `body` <[string]|[Buffer]> Optional response body.
  - `path` <[path]> Optional file path to respond with. The content type will be inferred from file extension. If `path` is a relative path, then it is resolved relative to the current working directory.

Response that will fulfill this route's request.

## method: Route.request
- returns: <[Request]>

A request to be routed.
