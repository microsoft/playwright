
---

## BrowserContext

The `BrowserContext` represents an isolated browser session, analogous to an incognito window. Each context has its own pages, cookies, cache, and storage state.

### Properties & State

### `BrowserContext.request`
APIRequestContext instance for making network requests scoped to the context.
**Returns:** `APIRequestContext`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.tracing`
Tracing API for starting/stopping tracing for this context.
**Returns:** `Tracing`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.clock`
Clock API for manipulating time and timers scoped to this context.
**Returns:** `Clock`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.browser()`
Returns the browser instance of the context. If it was launched as a persistent context, returns `null`.
**Returns:** `Browser | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.isClosed()`
Indicates whether the context has been closed.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### Pages & Workers

### `BrowserContext.newPage()`
Creates a new page in the browser context.
**Returns:** `Promise<Page>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.pages()`
Returns all open pages in the context.
**Returns:** `Page[]`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.backgroundPages()`
**@deprecated** Background pages have been removed from Chromium together with Manifest V2 extensions.
**Returns:** `Page[]`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.serviceWorkers()`
Returns all service workers currently active in the context.
**Returns:** `Worker[]`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### Configuration & State Management

### `BrowserContext.cookies(urls)`
Gets cookies for all or specific URLs.
**Returns:** `Promise<network.NetworkCookie[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.addCookies(cookies)`
Adds cookies to the context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.clearCookies(options)`
Clears context cookies.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.grantPermissions(permissions, options)`
Grants specified permissions to the context or specific origins.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.clearPermissions()`
Clears all granted permissions.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.setGeolocation(geolocation)`
Sets the geolocation of the context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.setExtraHTTPHeaders(headers)`
Sets extra HTTP headers to be sent with every request in the context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.setOffline(offline)`
Sets the context to offline or online mode.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.setHTTPCredentials(httpCredentials)`
Sets HTTP credentials for the context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.setDefaultNavigationTimeout(timeout)`
Sets the default navigation timeout for the context.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.setDefaultTimeout(timeout)`
Sets the default timeout for the context.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.storageState(options)`
Returns storage state for the context, which can be used to create a new context with the same state.
**Returns:** `Promise<StorageState>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.setStorageState(storageState)`
Sets storage state for the context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### Network Routing

### `BrowserContext.route(url, handler, options)`
Intercepts and handles network requests.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.routeFromHAR(har, options)`
Routes network requests from a HAR file.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.routeWebSocket(url, handler)`
Intercepts WebSocket connections.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.unroute(url, handler)`
Removes a route handler.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.unrouteAll(options)`
Removes all routes configured for the context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### Scripts & Bindings

### `BrowserContext.addInitScript(script, arg)`
Adds a script to be evaluated in all pages upon creation.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.exposeBinding(name, callback)`
Exposes a Node.js function as a global function on all pages, passing the source object.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.exposeFunction(name, callback)`
Exposes a Node.js function as a global function on all pages.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### Lifecycle & Events

### `BrowserContext.close(options)`
Closes the browser context. All pages in the context are also closed.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.waitForEvent(event, optionsOrPredicate)`
Waits for an event to fire and passes its value into the predicate function.
**Returns:** `Promise<any>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.on(event, listener)`
Adds an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.once(event, listener)`
Adds a one-time event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.off(event, listener)`
Removes an event listener. (Alias for `removeListener`).
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.addListener(event, listener)`
Adds an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.removeListener(event, listener)`
Removes an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### Misc

### `BrowserContext.newCDPSession(page)`
Creates a new CDP session linked to a specific page or frame.
**Returns:** `Promise<CDPSession>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

---

## Browser

A Browser is created via `chromium.launch()`, `firefox.launch()`, or `webkit.launch()`. It manages multiple `BrowserContext` instances.

### Core Context Creation

### `Browser.newContext(options)`
Creates a new browser context.
**Returns:** `Promise<BrowserContext>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.newPage(options)`
Creates a new page in a new browser context.
**Returns:** `Promise<Page>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### Accessors & State

### `Browser.browserType()`
Returns the browser type (`chromium`, `firefox`, or `webkit`) that this browser belongs to.
**Returns:** `BrowserType`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.contexts()`
Returns an array of all open browser contexts.
**Returns:** `BrowserContext[]`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.isConnected()`
Indicates whether the browser is connected.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.version()`
Returns the browser version.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### Advanced & Tracing

### `Browser.startTracing(page, options)`
**Chromium-only.** Starts low-level Chromium tracing. (For Playwright Tracing, use `context.tracing`).
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.stopTracing()`
**Chromium-only.** Stops tracing and returns a buffer with the trace data.
**Returns:** `Promise<Buffer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.newBrowserCDPSession()`
**Chromium-only.** Creates a new CDP session attached to the browser itself.
**Returns:** `Promise<CDPSession>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### Remote Connectivity

### `Browser.bind(title, options)`
Reserves a new CDP connection for remote browsers and returns its websocket endpoint.
**Returns:** `Promise<{ endpoint: string }>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.unbind()`
Removes a previously bound CDP connection.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### Lifecycle & Events

### `Browser.close(options)`
Closes the browser and all of its contexts.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.on(event, listener)`
Adds an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.once(event, listener)`
Adds a one-time event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.off(event, listener)`
Removes an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.addListener(event, listener)`
Adds an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.removeListener(event, listener)`
Removes an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)
