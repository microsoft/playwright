---
id: network
title: "Network"
---
## Introduction

Playwright provides APIs to **monitor** and **modify** browser network traffic, both HTTP and HTTPS. Any requests that a page does, including [XHRs](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) and
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) requests, can be tracked, modified and handled.


## Mock APIs

Check out our [API mocking guide](./mock.md) to learn more on how to
- mock API requests and never hit the API
- perform the API request and modify the response
- use HAR files to mock network requests.

## Network mocking
* langs: js

You don't have to configure anything to mock network requests. Just define a custom [Route] that mocks network for a browser context.

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  // Block any css requests for each test in this file.
  await context.route(/.css$/, route => route.abort());
});

test('loads page without css', async ({ page }) => {
  await page.goto('https://playwright.dev');
  // ... test goes here
});
```

Alternatively, you can use [`method: Page.route`] to mock network in a single page.

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test('loads page without images', async ({ page }) => {
  // Block png and jpeg images.
  await page.route(/(png|jpeg)$/, route => route.abort());

  await page.goto('https://playwright.dev');
  // ... test goes here
});
```

## HTTP Authentication

Perform HTTP Authentication.

```js tab=js-test title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    httpCredentials: {
      username: 'bill',
      password: 'pa55w0rd',
    }
  }
});
```

```js tab=js-library
const context = await browser.newContext({
  httpCredentials: {
    username: 'bill',
    password: 'pa55w0rd',
  },
});
const page = await context.newPage();
await page.goto('https://example.com');
```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setHttpCredentials("bill", "pa55w0rd"));
Page page = context.newPage();
page.navigate("https://example.com");
```

```python async
context = await browser.new_context(
    http_credentials={"username": "bill", "password": "pa55w0rd"}
)
page = await context.new_page()
await page.goto("https://example.com")
```

```python sync
context = browser.new_context(
    http_credentials={"username": "bill", "password": "pa55w0rd"}
)
page = context.new_page()
page.goto("https://example.com")
```

```csharp
using var context = await Browser.NewContextAsync(new()
{
    HttpCredentials = new HttpCredentials
    {
        Username = "bill",
        Password = "pa55w0rd"
    },
});
var page = await context.NewPageAsync();
await page.GotoAsync("https://example.com");
```
## HTTP Proxy

You can configure pages to load over the HTTP(S) proxy or SOCKSv5. Proxy can be either set globally
for the entire browser, or for each browser context individually.

You can optionally specify username and password for HTTP(S) proxy, you can also specify hosts to bypass the [`option: Browser.newContext.proxy`] for.

Here is an example of a global proxy:

```js tab=js-test title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    proxy: {
      server: 'http://myproxy.com:3128',
      username: 'usr',
      password: 'pwd'
    }
  }
});
```

```js tab=js-library
const browser = await chromium.launch({
  proxy: {
    server: 'http://myproxy.com:3128',
    username: 'usr',
    password: 'pwd'
  }
});
```

```java
Browser browser = chromium.launch(new BrowserType.LaunchOptions()
  .setProxy(new Proxy("http://myproxy.com:3128")
  .setUsername("usr")
  .setPassword("pwd")));
```

```python async
browser = await chromium.launch(proxy={
  "server": "http://myproxy.com:3128",
  "username": "usr",
  "password": "pwd"
})
```

```python sync
browser = chromium.launch(proxy={
  "server": "http://myproxy.com:3128",
  "username": "usr",
  "password": "pwd"
})
```

```csharp
var proxy = new Proxy
{
    Server = "http://myproxy.com:3128",
    Username = "user",
    Password = "pwd"
};
await using var browser = await BrowserType.LaunchAsync(new()
{
    Proxy = proxy
});
```

Its also possible to specify it per context:

```js tab=js-test title="example.spec.ts"
import { test, expect } from '@playwright/test';

test('should use custom proxy on a new context', async ({ browser }) => {
  const context = await browser.newContext({
    proxy: {
      server: 'http://myproxy.com:3128',
    }
  });
  const page = await context.newPage();

  await context.close();
});
```

```js tab=js-library
const browser = await chromium.launch();
const context = await browser.newContext({
  proxy: { server: 'http://myproxy.com:3128' }
});
```

```java
Browser browser = chromium.launch();
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setProxy(new Proxy("http://myproxy.com:3128")));
```

```python async
browser = await chromium.launch()
context = await browser.new_context(proxy={"server": "http://myproxy.com:3128"})
```

```python sync
browser = chromium.launch()
context = browser.new_context(proxy={"server": "http://myproxy.com:3128"})
```

```csharp
await using var browser = await BrowserType.LaunchAsync();
await using var context = await browser.NewContextAsync(new()
{
    Proxy = new Proxy { Server = "http://myproxy.com:3128" },
});
```

## Network events

You can monitor all the [Request]s and [Response]s:

```js
// Subscribe to 'request' and 'response' events.
page.on('request', request => console.log('>>', request.method(), request.url()));
page.on('response', response => console.log('<<', response.status(), response.url()));

await page.goto('https://example.com');
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      Browser browser = chromium.launch();
      Page page = browser.newPage();
      page.onRequest(request -> System.out.println(">> " + request.method() + " " + request.url()));
      page.onResponse(response -> System.out.println("<<" + response.status() + " " + response.url()));
      page.navigate("https://example.com");
      browser.close();
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    chromium = playwright.chromium
    browser = await chromium.launch()
    page = await browser.new_page()
    # Subscribe to "request" and "response" events.
    page.on("request", lambda request: print(">>", request.method, request.url))
    page.on("response", lambda response: print("<<", response.status, response.url))
    await page.goto("https://example.com")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
    chromium = playwright.chromium
    browser = chromium.launch()
    page = browser.new_page()
    # Subscribe to "request" and "response" events.
    page.on("request", lambda request: print(">>", request.method, request.url))
    page.on("response", lambda response: print("<<", response.status, response.url))
    page.goto("https://example.com")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync();
var page = await browser.NewPageAsync();
page.Request += (_, request) => Console.WriteLine(">> " + request.Method + " " + request.Url);
page.Response += (_, response) => Console.WriteLine("<< " + response.Status + " " + response.Url);
await page.GotoAsync("https://example.com");
```

Or wait for a network response after the button click with [`method: Page.waitForResponse`]:

```js
// Use a glob URL pattern. Note no await.
const responsePromise = page.waitForResponse('**/api/fetch_data');
await page.getByText('Update').click();
const response = await responsePromise;
```

```java
// Use a glob URL pattern
Response response = page.waitForResponse("**/api/fetch_data", () -> {
  page.getByText("Update").click();
});
```

```python async
# Use a glob url pattern
async with page.expect_response("**/api/fetch_data") as response_info:
    await page.get_by_text("Update").click()
response = await response_info.value
```

```python sync
# Use a glob url pattern
with page.expect_response("**/api/fetch_data") as response_info:
    page.get_by_text("Update").click()
response = response_info.value
```

```csharp
// Use a glob URL pattern
var waitForResponseTask = page.WaitForResponseAsync("**/api/fetch_data");
await page.GetByText("Update").ClickAsync();
var response = await waitForResponseTask;
```

#### Variations

Wait for [Response]s with [`method: Page.waitForResponse`]

```js
// Use a RegExp. Note no await.
const responsePromise = page.waitForResponse(/\.jpeg$/);
await page.getByText('Update').click();
const response = await responsePromise;

// Use a predicate taking a Response object. Note no await.
const responsePromise = page.waitForResponse(response => response.url().includes(token));
await page.getByText('Update').click();
const response = await responsePromise;
```

```java
// Use a RegExp
Response response = page.waitForResponse(Pattern.compile("\\.jpeg$"), () -> {
  page.getByText("Update").click();
});

// Use a predicate taking a Response object
Response response = page.waitForResponse(r -> r.url().contains(token), () -> {
  page.getByText("Update").click();
});
```

```python async
# Use a regular expression
async with page.expect_response(re.compile(r"\.jpeg$")) as response_info:
    await page.get_by_text("Update").click()
response = await response_info.value

# Use a predicate taking a response object
async with page.expect_response(lambda response: token in response.url) as response_info:
    await page.get_by_text("Update").click()
response = await response_info.value
```

```python sync
# Use a regular expression
with page.expect_response(re.compile(r"\.jpeg$")) as response_info:
    page.get_by_text("Update").click()
response = response_info.value

# Use a predicate taking a response object
with page.expect_response(lambda response: token in response.url) as response_info:
    page.get_by_text("Update").click()
response = response_info.value
```

```csharp
// Use a regular expression
var waitForResponseTask = page.WaitForResponseAsync(new Regex("\\.jpeg$"));
await page.GetByText("Update").ClickAsync();
var response = await waitForResponseTask;

// Use a predicate taking a Response object
var waitForResponseTask = page.WaitForResponseAsync(r => r.Url.Contains(token));
await page.GetByText("Update").ClickAsync();
var response = await waitForResponseTask;
```

## Handle requests

```js
await page.route('**/api/fetch_data', route => route.fulfill({
  status: 200,
  body: testData,
}));
await page.goto('https://example.com');
```

```java
page.route("**/api/fetch_data", route -> route.fulfill(new Route.FulfillOptions()
  .setStatus(200)
  .setBody(testData)));
page.navigate("https://example.com");
```

```python async
await page.route(
    "**/api/fetch_data",
    lambda route: route.fulfill(status=200, body=test_data))
await page.goto("https://example.com")
```

```python sync
page.route(
    "**/api/fetch_data",
    lambda route: route.fulfill(status=200, body=test_data))
page.goto("https://example.com")
```

You can mock API endpoints via handling the network requests in your Playwright script.

#### Variations

Set up route on the entire browser context with [`method: BrowserContext.route`] or page with [`method: Page.route`]. It will apply to popup windows and opened links.

```js
await browserContext.route('**/api/login', route => route.fulfill({
  status: 200,
  body: 'accept',
}));
await page.goto('https://example.com');
```

```java
browserContext.route("**/api/login", route -> route.fulfill(new Route.FulfillOptions()
  .setStatus(200)
  .setBody("accept")));
page.navigate("https://example.com");
```

```python async
await context.route(
    "**/api/login",
    lambda route: route.fulfill(status=200, body="accept"))
await page.goto("https://example.com")
```

```python sync
context.route(
    "**/api/login",
    lambda route: route.fulfill(status=200, body="accept"))
page.goto("https://example.com")
```

```csharp
await page.RouteAsync("**/api/fetch_data", async route => {
  await route.FulfillAsync(new() { Status = 200, Body = testData });
});
await page.GotoAsync("https://example.com");
```

## Modify requests

```js
// Delete header
await page.route('**/*', async route => {
  const headers = route.request().headers();
  delete headers['X-Secret'];
  await route.continue({ headers });
});

// Continue requests as POST.
await page.route('**/*', route => route.continue({ method: 'POST' }));
```

```java
// Delete header
page.route("**/*", route -> {
  Map<String, String> headers = new HashMap<>(route.request().headers());
  headers.remove("X-Secret");
    route.resume(new Route.ResumeOptions().setHeaders(headers));
});

// Continue requests as POST.
page.route("**/*", route -> route.resume(new Route.ResumeOptions().setMethod("POST")));
```

```python async
# Delete header
async def handle_route(route):
    headers = route.request.headers
    del headers["x-secret"]
    await route.continue_(headers=headers)
await page.route("**/*", handle_route)

# Continue requests as POST.
await page.route("**/*", lambda route: route.continue_(method="POST"))
```

```python sync
# Delete header
def handle_route(route):
    headers = route.request.headers
    del headers["x-secret"]
    route.continue_(headers=headers)
page.route("**/*", handle_route)

# Continue requests as POST.
page.route("**/*", lambda route: route.continue_(method="POST"))
```

```csharp
// Delete header
await page.RouteAsync("**/*", async route => {
    var headers = new Dictionary<string, string>(route.Request.Headers.ToDictionary(x => x.Key, x => x.Value));
    headers.Remove("X-Secret");
    await route.ContinueAsync(new() { Headers = headers });
});

// Continue requests as POST.
await Page.RouteAsync("**/*", async route => await route.ContinueAsync(new() { Method = "POST" }));
```

You can continue requests with modifications. Example above removes an HTTP header from the outgoing requests.

## Abort requests

You can abort requests using [`method: Page.route`] and [`method: Route.abort`].

```js
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());

// Abort based on the request type
await page.route('**/*', route => {
  return route.request().resourceType() === 'image' ? route.abort() : route.continue();
});
```

```java
page.route("**/*.{png,jpg,jpeg}", route -> route.abort());

// Abort based on the request type
page.route("**/*", route -> {
  if ("image".equals(route.request().resourceType()))
    route.abort();
  else
    route.resume();
});
```

```python async
await page.route("**/*.{png,jpg,jpeg}", lambda route: route.abort())

# Abort based on the request type
await page.route("**/*", lambda route: route.abort() if route.request.resource_type == "image"  else route.continue_())
```

```python sync
page.route("**/*.{png,jpg,jpeg}", lambda route: route.abort())

# Abort based on the request type
page.route("**/*", lambda route: route.abort() if route.request.resource_type == "image"  else route.continue_())
```

```csharp
await page.RouteAsync("**/*.{png,jpg,jpeg}", route => route.AbortAsync());

// Abort based on the request type
await page.RouteAsync("**/*", async route => {
if ("image".Equals(route.Request.ResourceType))
    await route.AbortAsync();
else
    await route.ContinueAsync();
});
```

## Modify responses

To modify a response use [APIRequestContext] to get the original response and then pass the response to [`method: Route.fulfill`]. You can override individual fields on the response via options:

```js
await page.route('**/title.html', async route => {
  // Fetch original response.
  const response = await route.fetch();
  // Add a prefix to the title.
  let body = await response.text();
  body = body.replace('<title>', '<title>My prefix:');
  await route.fulfill({
    // Pass all fields from the response.
    response,
    // Override response body.
    body,
    // Force content type to be html.
    headers: {
      ...response.headers(),
      'content-type': 'text/html'
    }
  });
});
```

```java
page.route("**/title.html", route -> {
  // Fetch original response.
  APIResponse response = route.fetch();
  // Add a prefix to the title.
  String body = response.text();
  body = body.replace("<title>", "<title>My prefix:");
  Map<String, String> headers = response.headers();
  headers.put("content-type", "text/html");
  route.fulfill(new Route.FulfillOptions()
    // Pass all fields from the response.
    .setResponse(response)
    // Override response body.
    .setBody(body)
    // Force content type to be html.
    .setHeaders(headers));
});
```

```python async
async def handle_route(route: Route) -> None:
    # Fetch original response.
    response = await route.fetch()
    # Add a prefix to the title.
    body = await response.text()
    body = body.replace("<title>", "<title>My prefix:")
    await route.fulfill(
        # Pass all fields from the response.
        response=response,
        # Override response body.
        body=body,
        # Force content type to be html.
        headers={**response.headers, "content-type": "text/html"},
    )

await page.route("**/title.html", handle_route)
```

```python sync
def handle_route(route: Route) -> None:
    # Fetch original response.
    response = route.fetch()
    # Add a prefix to the title.
    body = response.text()
    body = body.replace("<title>", "<title>My prefix:")
    route.fulfill(
        # Pass all fields from the response.
        response=response,
        # Override response body.
        body=body,
        # Force content type to be html.
        headers={**response.headers, "content-type": "text/html"},
    )

page.route("**/title.html", handle_route)
```

```csharp
await Page.RouteAsync("**/title.html", async route =>
{
    // Fetch original response.
    var response = await route.FetchAsync();
    // Add a prefix to the title.
    var body = await response.TextAsync();
    body = body.Replace("<title>", "<title>My prefix:");

    var headers = response.Headers;
    headers.Add("Content-Type", "text/html");

    await route.FulfillAsync(new()
    {
        // Pass all fields from the response.
        Response = response,
        // Override response body.
        Body = body,
        // Force content type to be html.
        Headers = headers,
    });
});
```

## Glob URL patterns

Playwright uses simplified glob patterns for URL matching in network interception methods like [`method: Page.route`] or [`method: Page.waitForResponse`]. These patterns support basic wildcards:

1. Asterisks:
  - A single `*` matches any characters except `/`
  - A double `**` matches any characters including `/`
1. Question mark `?` matches only question mark `?`. If you want to match any character, use `*` instead.
1. Curly braces `{}` can be used to match a list of options separated by commas `,`
1. Backslash `\` can be used to escape any of special characters (note to escape backslash itself as `\\`)

Examples:
- `https://example.com/*.js` matches `https://example.com/file.js` but not `https://example.com/path/file.js`
- `https://example.com/?page=1` matches `https://example.com/?page=1` but not `https://example.com`
- `**/*.js` matches both `https://example.com/file.js` and `https://example.com/path/file.js`
- `**/*.{png,jpg,jpeg}` matches all image requests

Important notes:

- The glob pattern must match the entire URL, not just a part of it.
- When using globs for URL matching, consider the full URL structure, including the protocol and path separators.
- For more complex matching requirements, consider using [RegExp] instead of glob patterns.

## WebSockets

Playwright supports [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) inspection, mocking and modifying out of the box. See our [API mocking guide](./mock.md#mock-websockets) to learn how to mock WebSockets.

Every time a WebSocket is created, the [`event: Page.webSocket`] event is fired. This event contains the [WebSocket] instance for further web socket frames inspection:

```js
page.on('websocket', ws => {
  console.log(`WebSocket opened: ${ws.url()}>`);
  ws.on('framesent', event => console.log(event.payload));
  ws.on('framereceived', event => console.log(event.payload));
  ws.on('close', () => console.log('WebSocket closed'));
});
```

```java
page.onWebSocket(ws -> {
  log("WebSocket opened: " + ws.url());
  ws.onFrameSent(frameData -> log(frameData.text()));
  ws.onFrameReceived(frameData -> log(frameData.text()));
  ws.onClose(ws1 -> log("WebSocket closed"));
});
```

```python
def on_web_socket(ws):
    print(f"WebSocket opened: {ws.url}")
    ws.on("framesent", lambda payload: print(payload))
    ws.on("framereceived", lambda payload: print(payload))
    ws.on("close", lambda payload: print("WebSocket closed"))

page.on("websocket", on_web_socket)
```

```csharp
page.WebSocket += (_, ws) =>
{
    Console.WriteLine("WebSocket opened: " + ws.Url);
    ws.FrameSent += (_, f) => Console.WriteLine(f.Text);
    ws.FrameReceived += (_, f) => Console.WriteLine(f.Text);
    ws.Close += (_, ws1) => Console.WriteLine("WebSocket closed");
};
```
## Missing Network Events and Service Workers

Playwright's built-in [`method: BrowserContext.route`] and [`method: Page.route`] allow your tests to natively route requests and perform mocking and interception.

1. If you're using Playwright's native [`method: BrowserContext.route`] and [`method: Page.route`], and it appears network events are missing, disable Service Workers by setting [`option: Browser.newContext.serviceWorkers`] to `'block'`.
1. It might be that you are using a mock tool such as Mock Service Worker (MSW). While this tool works out of the box for mocking responses, it adds its own Service Worker that takes over the network requests, hence making them invisible to [`method: BrowserContext.route`] and [`method: Page.route`]. If you are interested in both network testing and mocking, consider using built-in [`method: BrowserContext.route`] and [`method: Page.route`] for [response mocking](#handle-requests).
1. If you're interested in not solely using Service Workers for testing and network mocking, but in routing and listening for requests made by Service Workers themselves, please see [this experimental feature](https://github.com/microsoft/playwright/issues/15684).
