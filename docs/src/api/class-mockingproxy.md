# class: MockingProxy
* since: v1.51

`MockingProxy` allows you to intercept network traffic from your application server.

```js
const { webkit, mockingProxy } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext();
  const server = await mockingProxy.newProxy(8888); // point your application server to MockingProxy all requests through this port

  await server.route("https://headless-cms.example.com/posts", (route, request) => {
    await route.fulfill({
      json: [
        { id: 1, title: 'Hello, World!' },
        { id: 2, title: 'Second post' },
        { id: 2, title: 'Third post' }
      ]
    });
  })

  const page = await context.newPage();
  await page.goto('https://localhost:3000/posts');

  console.log(await page.getByRole('list').ariaSnapshot())
  // - list:
  //    - listitem: Hello, World!
  //    - listitem: Second post
  //    - listitem: Third post
})();
```

## async method: MockingProxy.route
* since: v1.51


Routing provides the capability to modify network requests that are made through the MockingProxy.

Once routing is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

**Usage**

An example of a naive handler that aborts all requests to a specific domain:

```js
const page = await browser.newPage();
const server = await page.context().newMockingProxy(8888)
await server.route('https://api.example.com', route => route.abort()); // simulates this API being unreachable
await page.goto('http://localhost:3000');
```

It is possible to examine the request to decide the route action. For example, mocking all requests that contain some post data, and leaving all other requests as is:

```js
await serer.route('https://api.example.com/*', async route => {
  if (route.request().postData().includes('my-string'))
    await route.fulfill({ body: 'mocked-data' });
  else
    await route.continue();  
})
```

To remove a route with its handler you can use [`method: MockingProxy.unroute`].

### param: MockingProxy.route.url
* since: v1.51
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
When a [`option: Browser.newContext.baseURL`] via the context options was provided and the passed URL is a path,
it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.

### param: MockingProxy.route.handler
* since: v1.51
* langs: js, python
- `handler` <[function]\([Route], [Request]\): [Promise<any>|any]>

handler function to route the request.

### param: MockingProxy.route.handler
* since: v1.51
* langs: csharp, java
- `handler` <[function]\([Route]\)>

handler function to route the request.

### option: MockingProxy.route.times
* since: v1.51
- `times` <[int]>

How often a route should be used. By default it will be used every time.

## async method: MockingProxy.unrouteAll
* since: v1.51

Removes all routes created with [`method: MockingProxy.route`].

### option: MockingProxy.unrouteAll.behavior = %%-unroute-all-options-behavior-%%
* since: v1.51

## async method: MockingProxy.unroute
* since: v1.51

Removes a route created with [`method: MockingProxy.route`]. When [`param: handler`] is not specified, removes all
routes for the [`param: url`].

### param: MockingProxy.unroute.url
* since: v1.51
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] used to register a routing with
[`method: MockingProxy.route`].

### param: MockingProxy.unroute.handler
* since: v1.51
* langs: js, python
- `handler` ?<[function]\([Route], [Request]\): [Promise<any>|any]>

Optional handler function used to register a routing with [`method: MockingProxy.route`].

### param: MockingProxy.unroute.handler
* since: v1.51
* langs: csharp, java
- `handler` ?<[function]\([Route]\)>

Optional handler function used to register a routing with [`method: MockingProxy.route`].

## event: MockingProxy.request
* since: v1.51
- argument: <[Request]>

Emitted when a request passes through the MockingProxy. The [request] object is read-only. In order to intercept and mutate requests, see
[`method: MockingProxy.route`].

## event: MockingProxy.requestfailed
* since: v1.51
- argument: <[Request]>

Emitted when a request fails, for example by timing out.

## event: MockingProxy.requestfinished
* since: v1.51
- argument: <[Request]>

Emitted when a request finishes successfully after downloading the response body. For a successful response, the
sequence of events is `request`, `response` and `requestfinished`.

## event: MockingProxy.response
* since: v1.51
- argument: <[Response]>

Emitted when [response] status and headers are received for a request. For a successful response, the sequence of events
is `request`, `response` and `requestfinished`.

## async method: MockingProxy.waitForEvent
* since: v1.51
* langs: js, python
  - alias-python: expect_event
- returns: <[any]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy
value. Will throw an error if the page is closed before the event is fired. Returns the event data value.

**Usage**

```js
const requestPromise = MockingProxy.waitForEvent('request');
await page.getByText('Download file').click();
const download = await requestPromise;
```

```python async
async with MockingProxy.expect_event("request") as event_info:
    await page.get_by_role("button")
frame = await event_info.value
```

```python sync
with MockingProxy.expect_event("request") as event_info:
    page.get_by_role("button")
frame = event_info.value
```

### param: MockingProxy.waitForEvent.event = %%-wait-for-event-event-%%
* since: v1.51

### param: MockingProxy.waitForEvent.optionsOrPredicate
* since: v1.51
* langs: js
- `optionsOrPredicate` ?<[function]|[Object]>
  - `predicate` <[function]> Receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` ?<[float]> Maximum time to wait for in milliseconds. Defaults to `0` - no timeout.

Either a predicate that receives an event or an options object. Optional.

### option: MockingProxy.waitForEvent.predicate = %%-wait-for-event-predicate-%%
* since: v1.51

### option: MockingProxy.waitForEvent.timeout = %%-wait-for-event-timeout-%%
* since: v1.51

## async method: MockingProxy.waitForRequest
* since: v1.51
* langs:
  * alias-python: expect_request
  * alias-csharp: RunAndWaitForRequest
- returns: <[Request]>

Waits for the matching request and returns it. See [waiting for event](../events.md#waiting-for-event) for more details about events.

**Usage**

```js
// Start waiting for request before clicking. Note no await.
const requestPromise = MockingProxy.waitForRequest('https://example.com/resource');
await page.getByText('trigger request').click();
const request = await requestPromise;

// Alternative way with a predicate. Note no await.
const requestPromise = MockingProxy.waitForRequest(request =>
  request.url() === 'https://example.com' && request.method() === 'GET',
);
await page.getByText('trigger request').click();
const request = await requestPromise;
```

```java
// Waits for the next request with the specified url
Request request = MockingProxy.waitForRequest("https://example.com/resource", () -> {
  // Triggers the request
  page.getByText("trigger request").click();
});

// Waits for the next request matching some conditions
Request request = MockingProxy.waitForRequest(request -> "https://example.com".equals(request.url()) && "GET".equals(request.method()), () -> {
  // Triggers the request
  page.getByText("trigger request").click();
});
```

```python async
async with MockingProxy.expect_request("http://example.com/resource") as first:
    await page.get_by_text("trigger request").click()
first_request = await first.value

# or with a lambda
async with MockingProxy.expect_request(lambda request: request.url == "http://example.com" and request.method == "get") as second:
    await page.get_by_text("trigger request").click()
second_request = await second.value
```

```python sync
with MockingProxy.expect_request("http://example.com/resource") as first:
    page.get_by_text("trigger request").click()
first_request = first.value

# or with a lambda
with MockingProxy.expect_request(lambda request: request.url == "http://example.com" and request.method == "get") as second:
    page.get_by_text("trigger request").click()
second_request = second.value
```

```csharp
// Waits for the next request with the specified url.
await MockingProxy.RunAndWaitForRequestAsync(async () =>
{
    await page.GetByText("trigger request").ClickAsync();
}, "http://example.com/resource");

// Alternative way with a predicate.
await MockingProxy.RunAndWaitForRequestAsync(async () =>
{
    await page.GetByText("trigger request").ClickAsync();
}, request => request.Url == "https://example.com" && request.Method == "GET");
```

## async method: MockingProxy.waitForRequest
* since: v1.51
* langs: python
- returns: <[EventContextManager]<[Request]>>

### param: MockingProxy.waitForRequest.action = %%-csharp-wait-for-event-action-%%
* since: v1.51

### param: MockingProxy.waitForRequest.urlOrPredicate
* since: v1.51
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Request]\):[boolean]>

Request URL string, regex or predicate receiving [Request] object.

### param: MockingProxy.waitForRequest.urlOrPredicate
* since: v1.51
* langs: js
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Request]\):[boolean]|[Promise]<[boolean]>>

Request URL string, regex or predicate receiving [Request] object.

### option: MockingProxy.waitForRequest.timeout
* since: v1.51
- `timeout` <[float]>

Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be
changed by using the [`method: Page.setDefaultTimeout`] method.

### param: MockingProxy.waitForRequest.callback = %%-java-wait-for-event-callback-%%
* since: v1.51

## async method: MockingProxy.waitForRequestFinished
* since: v1.51
* langs: java, python, csharp
  - alias-python: expect_request_finished
  - alias-csharp: RunAndWaitForRequestFinished
- returns: <[Request]>

Performs action and waits for a [Request] to finish loading. If predicate is provided, it passes
[Request] value into the `predicate` function and waits for `predicate(request)` to return a truthy value.

## async method: MockingProxy.waitForRequestFinished
* since: v1.51
* langs: python
- returns: <[EventContextManager]<[Request]>>

### param: MockingProxy.waitForRequestFinished.action = %%-csharp-wait-for-event-action-%%
* since: v1.51

### option: MockingProxy.waitForRequestFinished.predicate
* since: v1.51
- `predicate` <[function]\([Request]\):[boolean]>

Receives the [Request] object and resolves to truthy value when the waiting should resolve.

### option: MockingProxy.waitForRequestFinished.timeout = %%-wait-for-event-timeout-%%
* since: v1.51

### param: MockingProxy.waitForRequestFinished.callback = %%-java-wait-for-event-callback-%%
* since: v1.51

## async method: MockingProxy.waitForResponse
* since: v1.51
* langs:
  * alias-python: expect_response
  * alias-csharp: RunAndWaitForResponse
- returns: <[Response]>

Returns the matched response. See [waiting for event](../events.md#waiting-for-event) for more details about events.

**Usage**

```js
// Start waiting for response before clicking. Note no await.
const responsePromise = MockingProxy.waitForResponse('https://example.com/resource');
await page.getByText('trigger response').click();
const response = await responsePromise;

// Alternative way with a predicate. Note no await.
const responsePromise = MockingProxy.waitForResponse(response =>
  response.url() === 'https://example.com' && response.status() === 200
      && response.request().method() === 'GET'
);
await page.getByText('trigger response').click();
const response = await responsePromise;
```

```java
// Waits for the next response with the specified url
Response response = MockingProxy.waitForResponse("https://example.com/resource", () -> {
  // Triggers the response
  page.getByText("trigger response").click();
});

// Waits for the next response matching some conditions
Response response = MockingProxy.waitForResponse(response -> "https://example.com".equals(response.url()) && response.status() == 200 && "GET".equals(response.request().method()), () -> {
  // Triggers the response
  page.getByText("trigger response").click();
});
```

```python async
async with MockingProxy.expect_response("https://example.com/resource") as response_info:
    await page.get_by_text("trigger response").click()
response = await response_info.value
return response.ok

# or with a lambda
async with MockingProxy.expect_response(lambda response: response.url == "https://example.com" and response.status == 200 and response.request.method == "get") as response_info:
    await page.get_by_text("trigger response").click()
response = await response_info.value
return response.ok
```

```python sync
with MockingProxy.expect_response("https://example.com/resource") as response_info:
    page.get_by_text("trigger response").click()
response = response_info.value
return response.ok

# or with a lambda
with MockingProxy.expect_response(lambda response: response.url == "https://example.com" and response.status == 200 and response.request.method == "get") as response_info:
    page.get_by_text("trigger response").click()
response = response_info.value
return response.ok
```

```csharp
// Waits for the next response with the specified url.
await MockingProxy.RunAndWaitForResponseAsync(async () =>
{
    await page.GetByText("trigger response").ClickAsync();
}, "http://example.com/resource");

// Alternative way with a predicate.
await MockingProxy.RunAndWaitForResponseAsync(async () =>
{
    await page.GetByText("trigger response").ClickAsync();
}, response => response.Url == "https://example.com" && response.Status == 200 && response.Request.Method == "GET");
```

## async method: MockingProxy.waitForResponse
* since: v1.51
* langs: python
- returns: <[EventContextManager]<[Response]>>

### param: MockingProxy.waitForResponse.action = %%-csharp-wait-for-event-action-%%
* since: v1.51

### param: MockingProxy.waitForResponse.urlOrPredicate
* since: v1.51
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Response]\):[boolean]>

Request URL string, regex or predicate receiving [Response] object.

### param: MockingProxy.waitForResponse.urlOrPredicate
* since: v1.51
* langs: js
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Response]\):[boolean]|[Promise]<[boolean]>>

Request URL string, regex or predicate receiving [Response] object.

### option: MockingProxy.waitForResponse.timeout
* since: v1.51
- `timeout` <[float]>

Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout.

### param: MockingProxy.waitForResponse.callback = %%-java-wait-for-event-callback-%%
* since: v1.51

## method: MockingProxy.port
* since: v1.51
- returns: <[int]>

