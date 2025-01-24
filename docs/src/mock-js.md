---
id: mock
title: "Mock APIs"
---

TODO: add rest of mock here

## Mock Server

By default, Playwright only has access to the network traffic made by the browser.
To mock and intercept traffic made by the application server, use Playwright's mocking proxy.
How to do this differs for each application. This section explains the moving parts that you can use to embed it in any application. Skip forward to find recipes for Next.js, Remix and Angular.

Playwright's mocking proxy is an HTTP proxy server that's connected to the currently running test. If you send it a request, it will apply the network routes configured via `page.route` and `context.route`, allowing you to reuse your existing browser routes.

For browser network mocking, Playwright always knows what browser context and page a request is coming from. But because there's only a single application server shared by multiple concurrent test runs, it cannot know this for server requests! To resolve this, pick one of these two strategies:

1. [Disable parallelism](./test-parallel-js.md#disable-parallelism), so that there's only a single test at a time.
2. On the server, read the `x-playwright-proxy-port` header of incoming requests. When the mocking proxy is configured, Playwright adds this header to all browser requests.

The second strategy can be hard to integrate for some applications, because it requires access to the current request from where you're making your API requests.
If this is possible in your application, this is the recommended approach.
If it isn't, then go with disabling parallelism. It will slow down your test execution, but will make the proxy configuration easier because there will be only a single proxy running, on a port that is hardcoded.

Putting this together, figuring out what proxy to funnel a request should look something like this in your application:

```js
const proxyUrl = `http://localhost:8123/`; // 1: Disable Parallelism + hardcode port OR
const proxyUrl = `http://localhost:${$currentHeaders.get('x-playwright-proxy-port')}/`; // 2: Inject proxy port
```

And this is the Playwright config to go with it:

```ts
// playwright.config.ts
// 1: Disable Parallelism + hardcode port
export default defineConfig({
  workers: 1,
  use: { mockingProxy: { port: 8123 } }
});

// 2: Inject proxy port
export default defineConfig({
  use: { mockingProxy: { port: 'inject' } }
});
```

After figuring out what proxy to send traffic to, you need to direct traffic through it. To do so, prepend the proxy URL to all outgoing HTTP requests:

```js
await fetch(proxyUrl + 'https://api.example.com/users');
```

That's it! Your `context.route` and `page.route` methods can now intercept network traffic from your server:

```ts
// shopping-cart.spec.ts
import { test, expect } from "@playwright/test"

test('checkout applies customer loyalty bonus points', async ({ page }) => {
  await page.route("https://users.internal.example.com/loyalty/balance*", (route, request) => {
    await route.fulfill({ json: { userId: 'jane@doe.com', balance: 100 } });
  })

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

Prepending the proxy URL manually to all outgoing requests can be cumbersome. If your HTTP client supports it, consider updating your client baseURL ...

```js
import { axios } from "axios"; 

const api = axios.create({
  baseURL: proxyUrl + "https://jsonplaceholder.typicode.com",
});
```

... or setting up a global interceptor:

```js
import { axios } from "axios";

axios.interceptors.request.use(async config => {
  config.proxy = { protocol: "http", host: "localhost", port: 8123 };
  return config;
});
```

```js
import { setGlobalDispatcher, getGlobalDispatcher } from "undici"; 

const proxyingDispatcher = getGlobalDispatcher().compose(dispatch => (opts, handler) => {
  opts.path = opts.origin + opts.path;
  opts.origin = `http://localhost:8123`;
  return dispatch(opts, handler);
})
setGlobalDispatcher(proxyingDispatcher); // this will also apply to global fetch
```

:::note
Note that this style of proxying, where the proxy URL is prended to the request URL, does *not* use [`CONNECT`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/CONNECT), which is the common way of establishing a proxy connection.
This is because for HTTPS requests, a `CONNECT` proxy does not have access to the proxied traffic. That's great behaviour for a production proxy, but counteracts network interception!
:::


### Recipes

#### Next.js

Monkey-patch `globalThis.fetch` in your `instrumentation.ts` file:

```ts
// instrumentation.ts

import { headers } from "next/headers"
 
export function register() {
  if (process.env.NODE_ENV === 'test') {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
      const proxyPort = (await headers()).get('x-playwright-proxy-port');
      if (!proxyPort)
        return originalFetch(input, init);
      const request = new Request(input, init);
      return originalFetch(`http://localhost:${proxyPort}/${request.url}`, request);
    };
  }
}
```

#### Remix


Monkey-patch `globalThis.fetch` in your `entry.server.ts` file, and use `AsyncLocalStorage` to make current request headers available:

```ts
import { setGlobalDispatcher, getGlobalDispatcher } from "undici";
import { AsyncLocalStorage } from "node:async_hooks";

const headersStore = new AsyncLocalStorage<Headers>();
if (process.env.NODE_ENV === "test") {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const proxyPort = headersStore.getStore()?.get('x-playwright-proxy-port');
    if (!proxyPort)
      return originalFetch(input, init);
    const request = new Request(input, init);
    return originalFetch(`http://localhost:${proxyPort}/${request.url}`, request);
  };
}

export default function handleRequest(request: Request, ...) {
  return headersStore.run(request.headers, () => {
    // ...
    return handleBrowserRequest(request, ...);
  })
}
```

#### Angular

Configure your `HttpClient` with an [interceptor](https://angular.dev/guide/http/setup#withinterceptors):

```ts
// app.config.server.ts

import { inject, REQUEST } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

const serverConfig = {
  providers: [
    ...
    provideHttpClient(
      ...,
      withInterceptors([
        (req, next) => {
          const proxyPort = inject(REQUEST)?.headers.get('x-playwright-proxy-port');
          if (proxyPort)
            req = req.clone({ url: `http://localhost:${proxyPort}/${req.url}` })
          return next(req);
        },
      ])
    )
  ]
};

...
```

```ts
// playwright.config.ts
export default defineConfig({
  use: { mockingProxy: { port: 'inject' } }
});
```

### `.env` file

If your application uses `.env` files to configure API endpoints, you can configure the proxy by prepending them with the proxy URL:

```bash
# .env.test
CMS_BASE_URL=http://localhost:8123/https://cms.example.com/api/
USERS_SERVICE_BASE_URL=http://localhost:8123/https://users.internal.api.example.com/
```

```ts
// playwright.config.ts
export default defineConfig({
  workers: 1,
  use: { mockingProxy: { port: 8123 } }
});
```

