---
id: network
title: "Network"
---

Playwright provides APIs to **monitor** and **modify** network traffic, both HTTP and HTTPS. Any requests that page
does, including [XHRs](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) and
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) requests, can be tracked, modified and handled.

<!-- TOC -->

<br/>

## HTTP Authentication

```js
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
using var context = await Browser.NewContextAsync(new BrowserNewContextOptions
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

### API reference
- [`method: Browser.newContext`]

## HTTP Proxy

You can configure pages to load over the HTTP(S) proxy or SOCKSv5. Proxy can be either set globally
for the entire browser, or for each browser context individually.

You can optionally specify username and password for HTTP(S) proxy, you can also specify hosts to
bypass proxy for.

Here is an example of a global proxy:

```js
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
  .setUsername('usr')
  .setPassword('pwd'));
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
await using var browser = await BrowserType.LaunchAsync(new BrowserTypeLaunchOptions
{
    Proxy = proxy
});
```

When specifying proxy for each context individually, **Chromium on Windows** needs a hint that proxy will be set. This is done via passing a non-empty proxy server to the browser itself. Here is an example of a context-specific proxy:

```js
const browser = await chromium.launch({
  // Browser proxy option is required for Chromium on Windows.
  proxy: { server: 'per-context' }
});
const context = await browser.newContext({
  proxy: { server: 'http://myproxy.com:3128' }
})
```

```java
Browser browser = chromium.launch(new BrowserType.LaunchOptions()
  // Browser proxy option is required for Chromium on Windows.
  .setProxy(new Proxy("per-context"));
BrowserContext context = chromium.launch(new Browser.NewContextOptions()
  .setProxy(new Proxy("http://myproxy.com:3128"));
```

```python async
# Browser proxy option is required for Chromium on Windows.
browser = await chromium.launch(proxy={"server": "per-context"})
context = await browser.new_context(proxy={"server": "http://myproxy.com:3128"})
```

```python sync
# Browser proxy option is required for Chromium on Windows.
browser = chromium.launch(proxy={"server": "per-context"})
context = browser.new_context(proxy={"server": "http://myproxy.com:3128"})
```

```csharp
var proxy = new Proxy { Server = "per-context" };
await using var browser = await BrowserType.LaunchAsync(new BrowserTypeLaunchOptions
{
    // Browser proxy option is required for Chromium on Windows.
    Proxy = proxy
});
using var context = await Browser.NewContextAsync(new BrowserNewContextOptions
{
    Proxy = new Proxy { Server = "http://myproxy.com:3128" })
});
```


## Network events

You can monitor all the requests and responses:

```js
const { chromium, webkit, firefox } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Subscribe to 'request' and 'response' events.
  page.on('request', request =>
      console.log('>>', request.method(), request.url()));
  page.on('response', response =>
      console.log('<<', response.status(), response.url()));
  await page.goto('https://example.com');

  await browser.close();
})();
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
from playwright.async_api import async_playwright

async def run(playwright):
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
from playwright.sync_api import sync_playwright

def run(playwright):
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

Or wait for a network response after the button click:

```js
// Use a glob URL pattern
const [response] = await Promise.all([
  page.waitForResponse('**/api/fetch_data'),
  page.click('button#update'),
]);
```

```java
// Use a glob URL pattern
Response response = page.waitForResponse("**/api/fetch_data", () -> {
  page.click("button#update");
});
```

```python async
# Use a glob url pattern
async with page.expect_response("**/api/fetch_data") as response_info:
    await page.click("button#update")
response = await response_info.value
```

```python sync
# Use a glob url pattern
with page.expect_response("**/api/fetch_data") as response_info:
    page.click("button#update")
response = response_info.value
```

```csharp
// Use a glob URL pattern
var waitForResponseTask = page.WaitForResponseAsync("**/api/fetch_data");
await page.ClickAsync("button#update");
var response = await waitForResponseTask;
```

#### Variations

```js
// Use a RegExp
const [response] = await Promise.all([
  page.waitForResponse(/\.jpeg$/),
  page.click('button#update'),
]);

// Use a predicate taking a Response object
const [response] = await Promise.all([
  page.waitForResponse(response => response.url().includes(token)),
  page.click('button#update'),
]);
```

```java
// Use a RegExp
Response response = page.waitForResponse(Pattern.compile("\\.jpeg$"), () -> {
  page.click("button#update");
});

// Use a predicate taking a Response object
Response response = page.waitForResponse(r -> r.url().contains(token), () -> {
  page.click("button#update");
});
```

```python async
# Use a regular expression
async with page.expect_response(re.compile(r"\.jpeg$")) as response_info:
    await page.click("button#update")
response = await response_info.value

# Use a predicate taking a response object
async with page.expect_response(lambda response: token in response.url) as response_info:
    await page.click("button#update")
response = await response_info.value
```

```python sync
# Use a regular expression
with page.expect_response(re.compile(r"\.jpeg$")) as response_info:
    page.click("button#update")
response = response_info.value

# Use a predicate taking a response object
with page.expect_response(lambda response: token in response.url) as response_info:
    page.click("button#update")
response = response_info.value
```

```csharp
// Use a regular expression
var waitForResponseTask = page.WaitForResponseAsync(new Regex("\\.jpeg$"));
await page.ClickAsync("button#update");
var response = await waitForResponseTask;

// Use a predicate taking a Response object
var waitForResponseTask = page.WaitForResponseAsync(r => r.Url.Contains(token));
await page.ClickAsync("button#update");
var response = await waitForResponseTask;
```

### API reference
- [Request]
- [Response]
- [`event: Page.request`]
- [`event: Page.response`]
- [`method: Page.waitForRequest`]
- [`method: Page.waitForResponse`]

<br/>

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

```js
// Set up route on the entire browser context.
// It will apply to popup windows and opened links.

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
# Set up route on the entire browser context.
# It will apply to popup windows and opened links.
await context.route(
    "**/api/login",
    lambda route: route.fulfill(status=200, body="accept"))
await page.goto("https://example.com")
```

```python sync
# Set up route on the entire browser context.
# It will apply to popup windows and opened links.
context.route(
    "**/api/login",
    lambda route: route.fulfill(status=200, body="accept"))
page.goto("https://example.com")
```

```csharp
await page.RouteAsync("**/api/fetch_data", async route => {
  await route.FulfillAsync(status: 200, body: testData);
});
await page.GotoAsync("https://example.com");
```

### API reference
- [`method: BrowserContext.route`]
- [`method: BrowserContext.unroute`]
- [`method: Page.route`]
- [`method: Page.unroute`]
- [Route]

<br/>

## Modify requests

```js
// Delete header
await page.route('**/*', route => {
  const headers = route.request().headers();
  delete headers['X-Secret'];
  route.continue({headers});
});

// Continue requests as POST.
await page.route('**/*', route => route.continue({method: 'POST'}));
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
    route.continue_(headers=headers)
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
    await route.ContinueAsync(new RouteContinueOptions { Headers = headers });
});

// Continue requests as POST.
await page.RouteAsync("**/*", async route => await route.ContinueAsync(method: "POST"));
```

You can continue requests with modifications. Example above removes an HTTP header from the outgoing requests.

## Abort requests

```js
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());

// Abort based on the request type
await page.route('**/*', route => {
  return route.request().resourceType() === 'image' ?
      route.abort() : route.continue();
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

### API reference
- [`method: Page.route`]
- [`method: BrowserContext.route`]
- [`method: Route.abort`]

<br/>

## Modify responses

To modify a response use [APIRequestContext] to get original response and then pass the response to [`method: Route.fulfill`].
You can override individual fields on the response via options:

```js
await page.route('**/title.html', async route => {
  // Fetch original response.
  const response = await page.request.fetch(route.request());
  // Add a prefix to the title.
  let body = await response.text();
  body = body.replace('<title>', '<title>My prefix:');
  route.fulfill({
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
  APIResponse response = page.request().fetch(route.request());
  // Add a prefix to the title.
  String body = response.text();
  body = body.replace("<title>", "<title>My prefix:");
  Map<String, String> headers = response.headers();
  headers.put("content-type": "text/html");
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
    response = await page.request.fetch(route.request)
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
    response = page.request.fetch(route.request)
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
    var response = await Page.APIRequest.FetchAsync(route.Request);
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

### API reference
- [APIRequestContext]
- [`method: Page.route`]
- [`method: BrowserContext.route`]
- [`property: Playwright.request`]
- [`property: BrowserContext.request`]
- [`property: Page.request`]
- [`method: Route.fulfill`]

<br/>

## Record and replay requests

You can record network activity as an HTTP Archive file (HAR). Later on, this archive can be used to mock responses to the network requests. You'll need to:
1. Record a HAR file.
1. Commit the HAR file alongside the tests.
1. Route requests using the saved HAR files in the tests.

### Recording HAR with CLI

Open the browser with [Playwright CLI](./cli.md) and pass `--save-har` option to produce a HAR file. Optionally, use `--save-har-glob` to only save requests you are interested in, for example API endpoints.

```bash js
# Save API requests from example.com as "example.har" archive.
npx playwright open --save-har=example.har --save-har-glob="**/api/**" https://example.com
```

```bash java
# Save API requests from example.com as "example.har" archive.
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="open --save-har=example.har --save-har-glob='**/api/**' https://example.com"
```

```bash python
# Save API requests from example.com as "example.har" archive.
playwright open --save-har=example.har --save-har-glob="**/api/**" https://example.coms
```

```bash csharp
# Save API requests from example.com as "example.har" archive.
pwsh bin\Debug\netX\playwright.ps1 open --save-har=example.har --save-har-glob="**/api/**" https://example.com
```

### Recording HAR with a script

Alternatively, instead of using the CLI, you can record HAR programmatically. Pass [`option: har`] option when creating a [BrowserContext] with [`method: Browser.newContext`] to create an archive.

```js
const context = await browser.newContext({
  recordHar: { path: 'example.har', urlFilter: '**/api/**' }
});

// ... Perform actions ...

// Close context to ensure HAR is saved to disk.
await context.close();
```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
    .setRecordHarPath(Paths.get("example.har"))
    .setRecordHarUrlFilter("**/api/**");

// ... Perform actions ...

// Close context to ensure HAR is saved to disk.
context.close();
```

```python async
context = await browser.new_context(record_har_path="example.har", record_har_url_filter="**/api/**")

# ... Perform actions ...

# Close context to ensure HAR is saved to disk.
await context.close()
```

```python sync
context = browser.new_context(record_har_path="example.har", record_har_url_filter="**/api/**")

# ... Perform actions ...

# Close context to ensure HAR is saved to disk.
context.close()
```

```csharp
var context = await browser.NewContextAsync(new () {
    RecordHarPath = "example.har",
    RecordHarUrlFilter = "**/api/**",
});

// ... Perform actions ...

// Close context to ensure HAR is saved to disk.
await context.CloseAsync();
```

### Replaying from HAR

Pass [`option: har`] option to the [`method: Route.fulfill`] method to use a matching response from the HAR file.

```js
// Replay API requests from HAR.
// Either use a matching response from the HAR,
// or abort the request if nothing matches.
await page.routeFromHar('example.har', { url: '**/api/**' });
```

```java
// Either use a matching response from the HAR,
// or abort the request if nothing matches.
page.routeFromHar(Paths.get("example.har"), new Page.RouteFromHarOptions().setUrl("**/api/**"));
```

```python async
# Either use a matching response from the HAR,
# or abort the request if nothing matches.
await page.route_from_har("example.har", url="**/api/**")
```

```python sync
# Either use a matching response from the HAR,
# or abort the request if nothing matches.
page.route_from_har("example.har", url="**/api/**")
```

```csharp
// Either use a matching response from the HAR,
// or abort the request if nothing matches.
await Page.RouteFromHarAsync("example.har", new () { Url = "**/api/**" });
```

### API reference
- [`method: Browser.newContext`]
- [`method: Route.fulfill`]

<br/>

## WebSockets

Playwright supports [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) inspection out of the
box. Every time WebSocket is created, [`event: Page.webSocket`] event is fired. This event contains the [WebSocket]
instance for further web socket frames inspection:

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

### API reference
- [WebSocket]
- [`event: Page.webSocket`]
- [`event: WebSocket.frameSent`]
- [`event: WebSocket.frameReceived`]
- [`event: WebSocket.close`]

<br/>
