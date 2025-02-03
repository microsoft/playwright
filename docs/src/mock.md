---
id: mock
title: "Mock APIs"
---

## Introduction

Web APIs are usually implemented as HTTP endpoints. Playwright provides APIs to **mock** and **modify** network traffic, both HTTP and HTTPS. Any requests that a page does, including [XHRs](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) and
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) requests, can be tracked, modified and mocked. With Playwright you can also mock using HAR files that contain multiple network requests made by the page.

## Mock API requests

The following code will intercept all the calls to `*/**/api/v1/fruits` and will return a custom response instead. No requests to the API will be made. The test goes to the URL that uses the mocked route and asserts that mock data is present on the page.

```js
test("mocks a fruit and doesn't call api", async ({ page }) => {
  // Mock the api call before navigating
  await page.route('*/**/api/v1/fruits', async route => {
    const json = [{ name: 'Strawberry', id: 21 }];
    await route.fulfill({ json });
  });
  // Go to the page
  await page.goto('https://demo.playwright.dev/api-mocking');

  // Assert that the Strawberry fruit is visible
  await expect(page.getByText('Strawberry')).toBeVisible();
});
```

```python async
async def test_mock_the_fruit_api(page: Page):
    async def handle(route: Route):
        json = [{"name": "Strawberry", "id": 21}]
        # fulfill the route with the mock data
        await route.fulfill(json=json)

    # Intercept the route to the fruit API
    await page.route("*/**/api/v1/fruits", handle)

    # Go to the page
    await page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the Strawberry fruit is visible
    await expect(page.get_by_text("Strawberry")).to_be_visible()
```

```python sync
def test_mock_the_fruit_api(page: Page):
    def handle(route: Route):
        json = [{"name": "Strawberry", "id": 21}]
        # fulfill the route with the mock data
        route.fulfill(json=json)

    # Intercept the route to the fruit API
    page.route("*/**/api/v1/fruits", handle)

    # Go to the page
    page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the Strawberry fruit is visible
    expect(page.get_by_text("Strawberry")).to_be_visible()
```

```csharp
// Intercept the route to the fruit API
await page.RouteAsync("*/**/api/v1/fruits", async route => {
  var json = new[] { new { name = "Strawberry", id = 21 } };
  // fulfill the route with the mock data
  await route.FulfillAsync(new()
  {
    Json = json
  });
});

// Go to the page
await page.GotoAsync("https://demo.playwright.dev/api-mocking");

// Assert that the Strawberry fruit is visible
await Expect(page.GetByTextAsync("Strawberry")).ToBeVisibleAsync();
```

```java
// Intercept the route to the fruit API
page.route("https://fruit.ceo/api/breeds/image/random", route -> {
    List<Dictionary<String, Object>> data = new ArrayList<Dictionary<String, Object>>();
    Hashtable<String, Object> dict = new Hashtable<String, Object>();
    dict.put("name", "Strawberry");
    dict.put("id", 21);
    data.add(dict);
  // fulfill the route with the mock data
  route.fulfill(RequestOptions.create().setData(data));
});

// Go to the page
page.navigate("https://demo.playwright.dev/api-mocking");

// Assert that the Strawberry fruit is visible
assertThat(page.getByText("Strawberry")).isVisible();
```

You can see from the trace of the example test that the API was never called, it was however fulfilled with the mock data.
![api mocking trace](https://github.com/microsoft/playwright/assets/13063165/3dc14cbf-c100-4efc-ac21-d7b52d698b53)

Read more about [advanced networking](./network.md).

## Modify API responses

Sometimes, it is essential to make an API request, but the response needs to be patched to
allow for reproducible testing. In that case, instead of mocking the request, one
can perform the request and fulfill it with the modified response.

In the example below we intercept the call to the fruit API and add a new fruit called 'Loquat', to the data. We then go to the url and assert that this data is there:


```js
test('gets the json from api and adds a new fruit', async ({ page }) => {
  // Get the response and add to it
  await page.route('*/**/api/v1/fruits', async route => {
    const response = await route.fetch();
    const json = await response.json();
    json.push({ name: 'Loquat', id: 100 });
    // Fulfill using the original response, while patching the response body
    // with the given JSON object.
    await route.fulfill({ response, json });
  });

  // Go to the page
  await page.goto('https://demo.playwright.dev/api-mocking');

  // Assert that the new fruit is visible
  await expect(page.getByText('Loquat', { exact: true })).toBeVisible();
});
```

```python async
async def test_gets_the_json_from_api_and_adds_a_new_fruit(page: Page):
    async def handle(route: Route):
        response = await route.fetch()
        json = await response.json()
        json.append({ "name": "Loquat", "id": 100})
        # Fulfill using the original response, while patching the response body
        # with the given JSON object.
        await route.fulfill(response=response, json=json)

    await page.route("https://demo.playwright.dev/api-mocking/api/v1/fruits", handle)

    # Go to the page
    await page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the new fruit is visible
    await expect(page.get_by_text("Loquat", exact=True)).to_be_visible()
```

```python sync
def test_gets_the_json_from_api_and_adds_a_new_fruit(page: Page):
    def handle(route: Route):
        response = route.fetch()
        json = response.json()
        json.append({ "name": "Loquat", "id": 100})
        # Fulfill using the original response, while patching the response body
        # with the given JSON object.
        route.fulfill(response=response, json=json)

    page.route("https://demo.playwright.dev/api-mocking/api/v1/fruits", handle)

    # Go to the page
    page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the new fruit is visible
    expect(page.get_by_text("Loquat", exact=True)).to_be_visible()
```

```csharp
await page.RouteAsync("*/**/api/v1/fruits", async (route) => {
    var response = await route.FetchAsync();
    var fruits = await response.JsonAsync<Fruit[]>();
    fruits.Add(new Fruit() { Name = "Loquat", Id = 100 });
    // Fulfill using the original response, while patching the response body
    // with the given JSON object.
    await route.FulfillAsync(new ()
    {
      Response = response,
      Json = fruits
    });
  }
);
// Go to the page
await page.GotoAsync("https://demo.playwright.dev/api-mocking");

// Assert that the Loquat fruit is visible
await Expect(page.GetByTextAsync("Loquat", new () { Exact = true })).ToBeVisibleAsync();
```

```java
page.route("*/**/api/v1/fruits", route -> {
  Response response = route.fetch();
  byte[] json = response.body();
  JsonObject parsed = new Gson().fromJson(new String(json), JsonObject.class);
  parsed.add(new JsonObject().add("name", "Loquat").add("id", 100));
  // Fulfill using the original response, while patching the response body
  // with the given JSON object.
  route.fulfill(new Route.FulfillOptions().setResponse(response).setBody(parsed.toString()));
});

// Go to the page
page.navigate("https://demo.playwright.dev/api-mocking");

// Assert that the Loquat fruit is visible
assertThat(page.getByText("Loquat", new Page.GetByTextOptions().setExact(true))).isVisible();
```

In the trace of our test we can see that the API was called and the response was modified.
![trace of test showing api being called and fulfilled](https://github.com/microsoft/playwright/assets/13063165/8b8dd82d-1b3e-428e-871b-840581fed439)

By inspecting the response we can see that our new fruit was added to the list.
![trace of test showing the mock response](https://github.com/microsoft/playwright/assets/13063165/03e6c87c-4ecc-47e8-9ca0-30fface25e9d)

Read more about [advanced networking](./network.md).

## Mocking with HAR files

A HAR file is an [HTTP Archive](http://www.softwareishard.com/blog/har-12-spec/) file that contains a record of all the network requests that are made when a page is loaded. It contains information about the request and response headers, cookies, content, timings, and more. You can use HAR files to mock network requests in your tests. You'll need to:

1. Record a HAR file.
1. Commit the HAR file alongside the tests.
1. Route requests using the saved HAR files in the tests.

### Recording a HAR file

To record a HAR file we use [`method: Page.routeFromHAR`] or [`method: BrowserContext.routeFromHAR`] method. This method takes in the path to the HAR file and an optional object of options.
The options object can contain the URL so that only requests with the URL matching the specified glob pattern will be served from the HAR File. If not specified, all requests will be served from the HAR file.

Setting `update` option to true will create or update the HAR file with the actual network information instead of serving the requests from the HAR file. Use it when creating a test to populate the HAR with real data.

```js
test('records or updates the HAR file', async ({ page }) => {
  // Get the response from the HAR file
  await page.routeFromHAR('./hars/fruit.har', {
    url: '*/**/api/v1/fruits',
    update: true,
  });

  // Go to the page
  await page.goto('https://demo.playwright.dev/api-mocking');

  // Assert that the fruit is visible
  await expect(page.getByText('Strawberry')).toBeVisible();
});
```

```python async
async def test_records_or_updates_the_har_file(page: Page):
    # Get the response from the HAR file
    await page.route_from_har("./hars/fruit.har", url="*/**/api/v1/fruits", update=True)

    # Go to the page
    await page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the fruit is visible
    await expect(page.get_by_text("Strawberry")).to_be_visible()
```

```python sync
def test_records_or_updates_the_har_file(page: Page):
    # Get the response from the HAR file
    page.route_from_har("./hars/fruit.har", url="*/**/api/v1/fruits", update=True)

    # Go to the page
    page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the fruit is visible
    expect(page.get_by_text("Strawberry")).to_be_visible()
```

```csharp
// Get the response from the HAR file
await page.RouteFromHARAsync("./hars/fruit.har", new () {
  Url = "*/**/api/v1/fruits",
  Update = true,
});

// Go to the page
await page.GotoAsync("https://demo.playwright.dev/api-mocking");

// Assert that the fruit is visible
await Expect(page.GetByText("Strawberry")).ToBeVisibleAsync();
```

```java
// Get the response from the HAR file
page.routeFromHAR(Path.of("./hars/fruit.har"), new RouteFromHAROptions()
  .setUrl("*/**/api/v1/fruits")
  .setUpdate(true)
);

// Go to the page
page.navigate("https://demo.playwright.dev/api-mocking");

// Assert that the fruit is visible
assertThat(page.getByText("Strawberry")).isVisible();
```

### Modifying a HAR file

Once you have recorded a HAR file you can modify it by opening the hashed .txt file inside your 'hars' folder and editing the JSON. This file should be committed to your source control. Anytime you run this test with `update: true` it will update your HAR file with the request from the API.

```json
[
  {
    "name": "Playwright",
    "id": 100
  },
  // ... other fruits
]
```

### Replaying from HAR

Now that you have the HAR file recorded and modified the mock data, it can be used to serve matching responses in the test. For this, just turn off or simply remove the `update` option. This will run the test against the HAR file instead of hitting the API.

```js
test('gets the json from HAR and checks the new fruit has been added', async ({ page }) => {
  // Replay API requests from HAR.
  // Either use a matching response from the HAR,
  // or abort the request if nothing matches.
  await page.routeFromHAR('./hars/fruit.har', {
    url: '*/**/api/v1/fruits',
    update: false,
  });

  // Go to the page
  await page.goto('https://demo.playwright.dev/api-mocking');

  // Assert that the Playwright fruit is visible
  await expect(page.getByText('Playwright', { exact: true })).toBeVisible();
});
```

```python async
async def test_gets_the_json_from_har_and_checks_the_new_fruit_has_been_added(page: Page):
    # Replay API requests from HAR.
    # Either use a matching response from the HAR,
    # or abort the request if nothing matches.
    await page.route_from_har("./hars/fruit.har", url="*/**/api/v1/fruits", update=False)

    # Go to the page
    await page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the Playwright fruit is visible
    await expect(page.get_by_text("Playwright", exact=True)).to_be_visible()
```

```python sync
def test_gets_the_json_from_har_and_checks_the_new_fruit_has_been_added(page: Page):
    # Replay API requests from HAR.
    # Either use a matching response from the HAR,
    # or abort the request if nothing matches.
    page.route_from_har("./hars/fruit.har", url="*/**/api/v1/fruits", update=False)

    # Go to the page
    page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the Playwright fruit is visible
    expect(page.get_by_text("Playwright", exact=True)).to_be_visible()
```

```csharp
// Replay API requests from HAR.
// Either use a matching response from the HAR,
// or abort the request if nothing matches.
await page.RouteFromHARAsync("./hars/fruit.har", new ()
  {
    Url = "*/**/api/v1/fruits",
    Update = false,
  }
);

// Go to the page
await page.GotoAsync("https://demo.playwright.dev/api-mocking");

// Assert that the Playwright fruit is visible
await page.ExpectByTextAsync("Playwright", new() { Exact = true }).ToBeVisibleAsync();
```

```java
// Replay API requests from HAR.
// Either use a matching response from the HAR,
// or abort the request if nothing matches.
page.routeFromHAR(Path.of("./hars/fruit.har"), new RouteFromHAROptions()
  .setUrl("*/**/api/v1/fruits")
  .setUpdate(false)
);

// Go to the page
page.navigate("https://demo.playwright.dev/api-mocking");

// Assert that the Playwright fruit is visible
assertThat(page.getByText("Playwright", new Page.GetByTextOptions()
  .setExact(true))).isVisible();
```
In the trace of our test we can see that the route was fulfilled from the HAR file and the API was not called.
![trace showing the HAR file being used](https://github.com/microsoft/playwright/assets/13063165/1bd7ab66-ea4f-43c2-a4e5-ca17d4837ff1)

If we inspect the response we can see our new fruit was added to the JSON, which was done by manually updating the hashed `.txt` file inside the `hars` folder.
![trace showing response from HAR file](https://github.com/microsoft/playwright/assets/13063165/db3117fc-7b02-4973-9a51-29e213261a6a)

HAR replay matches URL and HTTP method strictly. For POST requests, it also matches POST payloads strictly. If multiple recordings match a request, the one with the most matching headers is picked. An entry resulting in a redirect will be followed automatically.

Similar to when recording, if given HAR file name ends with `.zip`, it is considered an archive containing the HAR file along with network payloads stored as separate entries. You can also extract this archive, edit payloads or HAR log manually and point to the extracted har file. All the payloads will be resolved relative to the extracted har file on the file system.

#### Recording HAR with CLI

We recommend the `update` option to record HAR file for your test. However, you can also record the HAR with Playwright CLI.

Open the browser with Playwright CLI and pass `--save-har` option to produce a HAR file. Optionally, use `--save-har-glob` to only save requests you are interested in, for example API endpoints. If the har file name ends with `.zip`, artifacts are written as separate files and are all compressed into a single `zip`.

```bash js
# Save API requests from example.com as "example.har" archive.
npx playwright open --save-har=example.har --save-har-glob="**/api/**" https://example.com
```

```bash java
# Save API requests from example.com as "example.har" archive.
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="open --save-har=example.har --save-har-glob='**/api/**' https://example.com"
```

```bash python
# Save API requests from example.com as "example.har" archive.
playwright open --save-har=example.har --save-har-glob="**/api/**" https://example.com
```

```bash csharp
# Save API requests from example.com as "example.har" archive.
pwsh bin/Debug/netX/playwright.ps1 open --save-har=example.har --save-har-glob="**/api/**" https://example.com
```

Read more about [advanced networking](./network.md).

## Mock WebSockets

The following code will intercept WebSocket connections and mock entire communcation over the WebSocket, instead of connecting to the server. This example responds to a `"request"` with a `"response"`.

```js
await page.routeWebSocket('wss://example.com/ws', ws => {
  ws.onMessage(message => {
    if (message === 'request')
      ws.send('response');
  });
});
```

```java
page.routeWebSocket("wss://example.com/ws", ws -> {
  ws.onMessage(frame -> {
    if ("request".equals(frame.text()))
      ws.send("response");
  });
});
```

```python async
def message_handler(ws: WebSocketRoute, message: Union[str, bytes]):
  if message == "request":
    ws.send("response")

await page.route_web_socket("wss://example.com/ws", lambda ws: ws.on_message(
    lambda message: message_handler(ws, message)
))
```

```python sync
def message_handler(ws: WebSocketRoute, message: Union[str, bytes]):
  if message == "request":
    ws.send("response")

page.route_web_socket("wss://example.com/ws", lambda ws: ws.on_message(
    lambda message: message_handler(ws, message)
))
```

```csharp
await page.RouteWebSocketAsync("wss://example.com/ws", ws => {
  ws.OnMessage(frame => {
    if (frame.Text == "request")
      ws.Send("response");
  });
});
```

Alternatively, you may want to connect to the actual server, but intercept messages in-between and modify or block them. Here is an example that modifies some of the messages sent by the page to the server, and leaves the rest unmodified.

```js
await page.routeWebSocket('wss://example.com/ws', ws => {
  const server = ws.connectToServer();
  ws.onMessage(message => {
    if (message === 'request')
      server.send('request2');
    else
      server.send(message);
  });
});
```

```java
page.routeWebSocket("wss://example.com/ws", ws -> {
  WebSocketRoute server = ws.connectToServer();
  ws.onMessage(frame -> {
    if ("request".equals(frame.text()))
      server.send("request2");
    else
      server.send(frame.text());
  });
});
```

```python async
def message_handler(server: WebSocketRoute, message: Union[str, bytes]):
  if message == "request":
    server.send("request2")
  else:
    server.send(message)

def handler(ws: WebSocketRoute):
  server = ws.connect_to_server()
  ws.on_message(lambda message: message_handler(server, message))

await page.route_web_socket("wss://example.com/ws", handler)
```

```python sync
def message_handler(server: WebSocketRoute, message: Union[str, bytes]):
  if message == "request":
    server.send("request2")
  else:
    server.send(message)

def handler(ws: WebSocketRoute):
  server = ws.connect_to_server()
  ws.on_message(lambda message: message_handler(server, message))

page.route_web_socket("wss://example.com/ws", handler)
```

```csharp
await page.RouteWebSocketAsync("wss://example.com/ws", ws => {
  var server = ws.ConnectToServer();
  ws.OnMessage(frame => {
    if (frame.Text == "request")
      server.Send("request2");
    else
      server.Send(frame.Text);
  });
});
```

For more details, see [WebSocketRoute].

## Mock Server
* langs: js

By default, Playwright only has access to the network traffic made by the browser.
To mock and intercept traffic made by the application server, use Playwright's **experimental** mocking proxy. Note this feature is **experimental** and subject to change.

The mocking proxy is a HTTP proxy server that's connected to the currently running test.
If you send it a request, it will apply the network routes configured via `page.route` and `context.route`, reusing your existing browser routes.

To get started, enable the `mockingProxy` option in your Playwright config:

```js
export default defineConfig({
  use: { mockingProxy: true }
});
```

Playwright will now inject the proxy URL into all browser requests under the `x-playwright-proxy` header.
On your server, read the URL in this header and prepend it to all outgoing traffic you want to intercept:

```js
const headers = getCurrentRequestHeaders(); // this looks different for each application
const proxyURL = decodeURIComponent(headers.get('x-playwright-proxy') ?? '');
await fetch(proxyURL + 'https://api.example.com/users');
```

Prepending the URL will direct the request through the proxy. You can now intercept it with [`method: BrowserContext.route`] and [`method: Page.route`], just like browser requests:
```js
// shopping-cart.spec.ts
import { test, expect } from '@playwright/test';

test('checkout applies customer loyalty bonus points', async ({ page }) => {
  await page.route('https://users.internal.example.com/loyalty/balance*', (route, request) => {
    await route.fulfill({ json: { userId: 'jane@doe.com', balance: 100 } });
  });

  await page.goto('http://localhost:3000/checkout');

  await expect(page.getByRole('list')).toMatchAriaSnapshot(`
    - list "Cart":
      - listitem: Super Duper Hammer
      - listitem: Nails
      - listitem: 16mm Birch Plywood
    - text: "Price after applying 10$ loyalty discount: 79.99$"
    - button "Buy now"
  `);
});
```

Now, prepending the proxy URL manually can be cumbersome. If your HTTP client supports it, consider setting up a global interceptor:

```js
import { axios } from 'axios';

axios.interceptors.request.use(async config => {
  const headers = getCurrentRequestHeaders(); // this line looks different for each application
  const proxy = decodeURIComponent(headers.get('x-playwright-proxy') ?? '');
  config.url = new URL(proxy + config.url, config.baseURL).toString();
  return config;
});
```

```js
import { setGlobalDispatcher, getGlobalDispatcher } from 'undici';

const proxyingDispatcher = getGlobalDispatcher().compose(dispatch => (opts, handler) => {
  const headers = getCurrentRequestHeaders(); // this line looks different for each application
  const proxy = decodeURIComponent(headers.get('x-playwright-proxy') ?? '');
  const newURL = new URL(proxy + opts.origin + opts.path);
  opts.origin = newURL.origin;
  opts.path = newURL.pathname;
  return dispatch(opts, handler);
});
setGlobalDispatcher(proxyingDispatcher); // this will also apply to global fetch
```

:::note
Note that this style of proxying, where the proxy URL is prepended to the request URL, does *not* use [`CONNECT`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/CONNECT), which is the common way of establishing a proxy connection.
This is because for HTTPS requests, a `CONNECT` proxy does not have access to the proxied traffic. That's great behaviour for a production proxy, but counteracts network interception!
:::


### Recipes
* langs: js

#### Next.js
* langs: js

Monkey-patch `globalThis.fetch` in your `instrumentation.ts` file:

```js
// instrumentation.ts

import { headers } from 'next/headers';

export function register() {
  if (process.env.NODE_ENV === 'test') {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const proxy = (await headers()).get('x-playwright-proxy');
      if (!proxy)
        return originalFetch(input, init);
      const request = new Request(input, init);
      return originalFetch(decodeURIComponent(proxy) + request.url, request);
    };
  }
}
```

#### Remix
* langs: js


Monkey-patch `globalThis.fetch` in your `entry.server.ts` file, and use `AsyncLocalStorage` to make current request headers available:

```js
import { setGlobalDispatcher, getGlobalDispatcher } from 'undici';
import { AsyncLocalStorage } from 'node:async_hooks';

const headersStore = new AsyncLocalStorage<Headers>();
if (process.env.NODE_ENV === 'test') {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const proxy = headersStore.getStore()?.get('x-playwright-proxy');
    if (!proxy)
      return originalFetch(input, init);
    const request = new Request(input, init);
    return originalFetch(decodeURIComponent(proxy) + request.url, request);
  };
}

export default function handleRequest(request: Request, /* ... */) {
  return headersStore.run(request.headers, () => {
    // ...
    return handleBrowserRequest(request, /* ... */);
  });
}
```

#### Angular
* langs: js

Configure your `HttpClient` with an [interceptor](https://angular.dev/guide/http/setup#withinterceptors):

```js
// app.config.server.ts

import { inject, REQUEST } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

const serverConfig = {
  providers: [
    /* ... */
    provideHttpClient(
        /* ... */
        withInterceptors([
          (req, next) => {
            const proxy = inject(REQUEST)?.headers.get('x-playwright-proxy');
            if (proxy)
              req = req.clone({ url: decodeURIComponent(proxy) + req.url })
            return next(req);
          },
        ]),
    )
  ]
};

/* ... */
```

#### Astro
* langs: js

Set up a server-side fetch override in an Astro integration:

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import type { AstroIntegration } from "astro"
import { AsyncLocalStorage } from "async_hooks";

const playwrightMockingProxy: AstroIntegration = {
  name: 'playwrightMockingProxy',
  hooks: {
    'astro:server:setup': async astro => {
      if (process.env.NODE_ENV !== 'test')
        return;

      const proxyStorage = new AsyncLocalStorage<string>();
      const originalFetch = globalThis.fetch;
      globalThis.fetch = async (input, init) => {
        const proxy = proxyStorage.getStore();
        if (!proxy)
          return originalFetch(input, init);
        const request = new Request(input, init);
        return originalFetch(proxy + request.url, request);
      };
      astro.server.middlewares.use((req, res, next) => {
        const header = req.headers['x-playwright-proxy'] as string;
        if (typeof header !== 'string')
          return next();
        proxyStorage.run(decodeURIComponent(header), next);
      });
    },
  }
};

export default defineConfig({
  integrations: [
    playwrightMockingProxy
  ]
});
```

#### Nuxt

```js
// server/plugins/playwright-mocking-proxy.ts

import { getGlobalDispatcher, setGlobalDispatcher } from "undici"
import { useEvent, getRequestHeader } from '#imports'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'test')
    return;

  const proxiedDispatcher = getGlobalDispatcher().compose(dispatch => (opts, handler) => {
    const isInternal = opts.path.startsWith("/__nuxt")
    const proxy = getRequestHeader(useEvent(), 'x-playwright-proxy')
    if (proxy && !isInternal) {
      const newURL = new URL(decodeURIComponent(proxy) + opts.origin + opts.path);
      opts.origin = newURL.origin;
      opts.path = newURL.pathname;
    }
    return dispatch(opts, handler)
  })
  setGlobalDispatcher(proxiedDispatcher)
});
```

```js
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    experimental: {
      asyncContext: true,
    }
  }
})
```
