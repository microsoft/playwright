/**
 * 04-network-interception.js
 *
 * Demonstrates request interception and mocking using page.route() and the Route API.
 *
 * Real source code references studied:
 * - Public API / Client side:
 *   - `packages/playwright-core/src/client/page.ts` -> `Page.route(url, handler)`
 *     Registers a `RouteHandler` in `_routes` array on the Page (or BrowserContext).
 *   - `packages/playwright-core/src/client/network.ts` -> `Route`
 *     Provides methods:
 *     - `route.fulfill(options)`: Fulfills request with mock status, headers, and body (base64 encoded if binary/file).
 *     - `route.continue(options)`: Continues network request with optional modified headers/url/method.
 *     - `route.abort(errorCode)`: Aborts network request (e.g. 'failed', 'timedout').
 *     - `route.fallback(options)`: Yields control to next matching route handler.
 *     - `route.request()`: Returns `Request` instance representing intercepted network request.
 * - Server side dispatcher & execution:
 *   - `packages/playwright-core/src/server/dispatchers/networkDispatchers.ts` -> `RouteDispatcher`
 *     Dispatches RPC messages (`fulfill`, `continue`, `abort`) to server side network manager.
 *   - `packages/playwright-core/src/server/network.ts` -> `Route` & `Request`
 *     Manages network interceptors attached to CDP/Firefox/WebKit network domains.
 */

const { chromium } = require('playwright-core');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept all API JSON requests to /api/user/*
  // Page.route in client/page.ts adds a RouteHandler to page._routes
  await page.route('**/api/user/*', async (route, request) => {
    console.log('Intercepted request method:', request.method());
    console.log('Intercepted request URL:', request.url());

    // Fulfill request with mock data without sending network traffic to remote server.
    // Route.fulfill in client/network.ts constructs parameters (status, headers, body)
    // and sends RPC message to RouteDispatcher on server side.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 42,
        username: 'mocked_user',
        role: 'admin'
      })
    });
  });

  // Intercept image requests and abort them to save bandwidth
  await page.route(/\.(png|jpg|jpeg|svg)$/, async route => {
    // Route.abort in client/network.ts sends RPC abort message to server
    await route.abort('failed');
  });

  // Intercept analytics requests and modify headers before sending to server
  await page.route('**/analytics', async route => {
    // Route.continue in client/network.ts passes modified headers upstream
    await route.continue({
      headers: {
        ...route.request().headers(),
        'X-Mock-Analytics': 'true'
      }
    });
  });

  await page.goto('https://example.com');

  await context.close();
  await browser.close();
}

if (require.main === module) {
  main().catch(console.error);
}
