# Playwright-Core & Codegen API Reference

> **Provenance**
> - Source Commit: `b4a646a624c0b1e8e352d320cbc6684581625ff6`
> - Commit Date: `2026-08-06`
> - Methodology: Static-source analysis of upstream Playwright TypeScript files. Runtime/browser behavior was not exercised.

Dictionary-style function reference, verified against the real upstream source
(`packages/playwright-core/types/types.d.ts` + `src/client/*.ts`). Companion to
NOTES.md's architecture deep-dives -- this file is for quick lookup, NOTES.md is for
understanding mechanism. Scope: Documents the full public `playwright-core/types/types.d.ts` interface surface at the pinned revision, including Page, Locator, BrowserContext, Browser, Frame, Route, Request, Response, JSHandle, ElementHandle, Keyboard, Mouse, Download, Dialog, FileChooser, ConsoleMessage, APIRequestContext, APIResponse, WebSocket, Worker, Selectors, Touchscreen, Tracing, Video, Clock, Coverage, BrowserType, CDPSession, ElectronApplication, Electron, Android, AndroidDevice, AndroidInput, AndroidSocket, AndroidWebView, FrameLocator, APIRequest, BrowserServer, WebSocketRoute, WebError, Screencast, Debugger, ConnectOverCDPTransport, Credentials, Disposable, Logger, WebStorage, LaunchOptions, ConnectOverCDPOptions, ConnectOptions, LocatorScreenshotOptions, BrowserContextOptions, ViewportSize, HTTPCredentials, Geolocation, Cookie, PageScreenshotOptions, ChromiumBrowserContext, ChromiumBrowser, FirefoxBrowser, WebKitBrowser, and ChromiumCoverage. This reference covers interface declarations only; other exported types, namespaces, constants, and implementation internals are out of scope.

> **Audit Status**
> - Page, Locator, BrowserContext, Browser, Frame, Route, Request, and Response sections were re-audited against the pinned revision; member coverage and public signatures were checked, with descriptions retained where they matched the pinned JSDoc.
> - JSHandle, ElementHandle, Keyboard, and Mouse were audited against the same pinned revision; inherited JSHandle members are not duplicated under ElementHandle.
> - Download, Dialog, FileChooser, and ConsoleMessage were audited against the same pinned revision; unique members and overload totals were checked.
> - APIRequestContext, APIResponse, WebSocket, and Worker were audited against the same pinned revision; unique members and overload totals were checked.
> - Selectors, Touchscreen, Tracing, Video, Clock, and Coverage were audited against the same pinned revision; unique members and overload totals were checked.
> - BrowserType, CDPSession, ElectronApplication, Electron, Android, AndroidDevice, AndroidInput, AndroidSocket, and AndroidWebView were audited against the same pinned revision; unique members and overload totals were checked.
> - FrameLocator, APIRequest, BrowserServer, WebSocketRoute, WebError, Screencast, and Debugger were audited against the same pinned revision; unique members and overload totals were checked.
> - ConnectOverCDPTransport, Credentials, Disposable, Logger, WebStorage, LaunchOptions, ConnectOverCDPOptions, ConnectOptions, LocatorScreenshotOptions, BrowserContextOptions, ViewportSize, HTTPCredentials, Geolocation, Cookie, PageScreenshotOptions, ChromiumBrowserContext, ChromiumBrowser, FirefoxBrowser, WebKitBrowser, and ChromiumCoverage were audited against the same pinned revision; top-level fields/methods and specialization wrappers were checked.

Entry format per method:
### `ClassName.methodName(args)`
One-line description (Playwright's own words where accurate, tightened for brevity).
**Returns:** return type
**Source:** `packages/playwright-core/types/types.d.ts` (verify against
`src/client/<file>.ts`)
*(add a **Deprecated:** line only if the real JSDoc marks it as such)*

---

## Page

### Navigation

### `Page.goBack(options)`
Navigates to the previous page in history.
**Returns:** `Promise<Response | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.goForward(options)`
Navigates to the next page in history.
**Returns:** `Promise<Response | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.goto(url, options)`
Navigates to the specified URL and waits for the given load state.
**Returns:** `Promise<Response | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.reload(options)`
Reloads the current page.
**Returns:** `Promise<Response | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.setContent(html, options)`
Assigns HTML markup to the page.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### Waiting & Delays

### `Page.waitForLoadState(state, options)`
Waits for the page to reach the specified load state (load, domcontentloaded, networkidle).
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.waitForNavigation(options)`
Waits for the main frame to navigate to a new URL.
**Returns:** `Promise<Response | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)
**Deprecated:** inherently racy, please use `waitForURL` instead.

### `Page.waitForRequest(urlOrPredicate, options)`
Waits for a request matching the specified URL or predicate function.
**Returns:** `Promise<Request>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.waitForResponse(urlOrPredicate, options)`
Waits for a response matching the specified URL or predicate function.
**Returns:** `Promise<Response>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.waitForTimeout(timeout)`
Waits for the given amount of time in milliseconds.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)
**Deprecated:** Note that `page.waitForTimeout()` should only be used for debugging.

### `Page.waitForURL(url, options)`
Waits for the main frame to navigate to the specified URL.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.waitForEvent(event, optionsOrPredicate)`
Waits for a specific event to be emitted on the page.
**Returns:** `Promise<any>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### Locators & Element Queries

### `Page.locator(selector, options)`
Creates a locator for the specified selector.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.getByAltText(text, options)`
Creates a locator that matches an element by its alt text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.getByLabel(text, options)`
Creates a locator that matches an element by its associated label text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.getByPlaceholder(text, options)`
Creates a locator that matches an input element by its placeholder text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.getByRole(role, options)`
Creates a locator that matches an element by its ARIA role, name, and attributes.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.getByTestId(testId)`
Creates a locator that matches an element by its test-id attribute.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.getByText(text, options)`
Creates a locator that matches an element containing the specified text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.getByTitle(text, options)`
Creates a locator that matches an element by its title attribute.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.frameLocator(selector)`
Creates a frame locator that matches an iframe by selector.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.pierceFrames(options)`
Returns a frame locator resolving to all descendant frames.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.pickLocator()`
Triggers the UI inspector to allow the user to click an element and pick a locator.
**Returns:** `Promise<Locator>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.cancelPickLocator()`
Cancels an ongoing `page.pickLocator()` call.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.$(selector, options)`
Queries the page for the first matching element.
**Returns:** `Promise<ElementHandleForTag<K> | null>` (tag-name selector) or `Promise<ElementHandle<SVGElement | HTMLElement> | null>` (general string selector)
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.$$(selector)`
Queries the page for all matching elements.
**Returns:** `Promise<ElementHandleForTag<K>[]>` (tag-name selector) or `Promise<ElementHandle<SVGElement | HTMLElement>[]>` (general string selector)
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### Interactivity (Page-Level UI Actions)

### `Page.check(selector, options)`
Checks a checkbox or radio button matching the selector.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.click(selector, options)`
Clicks an element matching the selector.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.dblclick(selector, options)`
Double-clicks an element matching the selector.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.dispatchEvent(selector, type, eventInit, options)`
Dispatches an event to the element matching the selector.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.dragAndDrop(source, target, options)`
Drags the source element to the target element and drops it.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.fill(selector, value, options)`
Fills an input, textarea, or contenteditable element with the provided value.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.setInputFiles(selector, files, options)`
Sets files on a file input matching the selector.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.focus(selector, options)`
Focuses the element matching the selector.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.getAttribute(selector, name, options)`
Returns the value of the specified attribute for the matching element.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.hover(selector, options)`
Hovers over the element matching the selector.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.innerHTML(selector, options)`
Returns the `innerHTML` of the matching element.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.innerText(selector, options)`
Returns the `innerText` of the matching element.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.inputValue(selector, options)`
Returns the value of the matching input, textarea, or select element.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.isChecked(selector, options)`
Checks if the matching checkbox or radio button is checked.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.isDisabled(selector, options)`
Checks if the matching element is disabled.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.isEditable(selector, options)`
Checks if the matching element is editable.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.isEnabled(selector, options)`
Checks if the matching element is enabled.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.isHidden(selector, options)`
Checks if the matching element is hidden.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.isVisible(selector, options)`
Checks if the matching element is visible.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.press(selector, key, options)`
Presses a specific keyboard key on the matching element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.selectOption(selector, values, options)`
Selects one or more options in a `<select>` element.
**Returns:** `Promise<string[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.setChecked(selector, checked, options)`
Sets the checked state of a checkbox or radio button.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.tap(selector, options)`
Taps an element matching the selector (for mobile emulation).
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.textContent(selector, options)`
Returns the `textContent` of the matching element.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.type(selector, text, options)`
Types text into the matching element, firing keydown, keypress/input, and keyup events.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)
**Deprecated:** In most cases, you should use `locator.fill()` or `locator.pressSequentially()` instead.

### `Page.uncheck(selector, options)`
Unchecks a checkbox or radio button matching the selector.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.waitForSelector(selector, options)`
Waits for an element matching the selector to satisfy state criteria.
**Returns:** `Promise<ElementHandleForTag<K> | null>` (tag-name selector) or `Promise<ElementHandle<SVGElement | HTMLElement> | null>` (general string selector). Both are nullable when options/state permits a hidden or detached result.
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.waitForFunction(pageFunction, arg, options)`
Waits for a function to evaluate to a truthy value in the page context.
**Returns:** `Promise<SmartHandle<R>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### Routing & Network

### `Page.route(url, handler, options)`
Intercepts network requests matching the URL pattern and routes them to the handler.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.requests()`
Returns up to the currently retained last 100 requests. Note: old returned request objects may be collected as new requests arrive.
**Returns:** `Promise<Request[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.routeFromHAR(har, options)`
Serves network responses directly from a HAR file.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.routeWebSocket(url, handler)`
Intercepts WebSocket connections matching the URL pattern.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.unroute(url, handler)`
Removes a specific network routing handler.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.unrouteAll(options)`
Removes all network routing handlers set on the page.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.setExtraHTTPHeaders(headers)`
Sets extra HTTP headers to be sent with every request from the page.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### Events & Event Listeners

### `Page.on(event, listener)`
Adds an event listener for the specified page event.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.once(event, listener)`
Adds a one-time event listener for the specified page event.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.off(event, listener)`
Removes a specific event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.addListener(event, listener)`
Alias for `Page.on()`. Adds an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.removeListener(event, listener)`
Alias for `Page.off()`. Removes an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.removeAllListeners(type, options)`
Removes all listeners, or those of the specified event.
**Returns:** `this` (without options) or `Promise<void>` (with options)
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `Page.prependListener(event, listener)`
Adds an event listener to the beginning of the listeners array.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/channelOwner.ts`)

### Scripts & Evaluation

### `Page.$eval(selector, pageFunction, arg)`
Evaluates a function in the page context, passing the matching element as an argument.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.$$eval(selector, pageFunction, arg)`
Evaluates a function in the page context, passing all matching elements as an argument array.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.addInitScript(script, arg)`
Adds a script to be evaluated in every frame upon creation, before any other scripts run.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.addScriptTag(options)`
Injects a `<script>` tag into the page.
**Returns:** `Promise<ElementHandle>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.addStyleTag(options)`
Injects a `<style>` tag into the page.
**Returns:** `Promise<ElementHandle>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.evaluate(pageFunction, arg)`
Evaluates a function in the page context and returns the result.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.evaluateHandle(pageFunction, arg)`
Evaluates a function in the page context and returns a JSHandle to the result.
**Returns:** `Promise<SmartHandle<R>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.exposeBinding(name, callback)`
Exposes a Node.js function to the page context, optionally passing source information.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.exposeFunction(name, callback)`
Exposes a Node.js function to the page context.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.addLocatorHandler(locator, handler, options)`
Registers a handler that is called when a locator matches and obscures an action target.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.removeLocatorHandler(locator)`
Removes a previously registered locator handler.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### Emulation & Configuration

### `Page.emulateMedia(options)`
Emulates CSS media type, media features, or color schemes.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.setDefaultNavigationTimeout(timeout)`
Changes the default maximum navigation time for the page.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.setDefaultTimeout(timeout)`
Changes the default maximum time for all page methods awaiting conditions.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.setViewportSize(viewportSize)`
Resizes the page's viewport to the given dimensions.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### Screenshots & Output

### `Page.screenshot(options)`
Captures a screenshot of the page.
**Returns:** `Promise<Buffer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.ariaSnapshot(options)`
Returns an ARIA snapshot representation of the page.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.ariaSnapshotJSON(options)`
Returns a JSON-serialized ARIA snapshot representation of the page.
**Returns:** `Promise<any>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.pdf(options)`
Generates a PDF of the page. (Chromium only).
**Returns:** `Promise<Buffer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### Page Lifecycle & Tabs

### `Page.bringToFront()`
Brings the page to the front (activates the tab).
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.close(options)`
Closes the page and terminates its lifecycle.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.opener()`
Returns the page that opened this page, if any.
**Returns:** `Promise<Page | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.isClosed()`
Indicates whether the page has been closed.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### Accessors & State (Properties & Methods)

### `Page.clock`
Gets the `Clock` API for manipulating time and timers.
**Returns:** `Clock`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.screencast`
Gets the `Screencast` API to manage screencast frames and sessions.
**Returns:** `Screencast`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.localStorage`
Provides access to the page's `localStorage` for the current origin.
**Returns:** `WebStorage`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.sessionStorage`
Provides access to the page's `sessionStorage` for the current origin.
**Returns:** `WebStorage`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.coverage`
Gets the `Coverage` API to gather JS/CSS coverage.
**Returns:** `Coverage`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.keyboard`
Gets the `Keyboard` API for dispatching keyboard events.
**Returns:** `Keyboard`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.mouse`
Gets the `Mouse` API for dispatching mouse events.
**Returns:** `Mouse`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.request`
Gets the `APIRequestContext` for sending API requests from the page's network context.
**Returns:** `APIRequestContext`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.touchscreen`
Gets the `Touchscreen` API for dispatching touch events.
**Returns:** `Touchscreen`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.context()`
Returns the browser context that owns the page.
**Returns:** `BrowserContext`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.content()`
Gets the full HTML contents of the page, including the doctype.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.frame(frameSelector)`
Returns a frame matching the specified name or URL.
**Returns:** `Frame | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.frames()`
Returns an array of all frames attached to the page.
**Returns:** `Frame[]`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.mainFrame()`
Returns the page's main frame.
**Returns:** `Frame`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.title()`
Returns the page's title.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.url()`
Returns the page's current URL.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.video()`
Returns the video object associated with the page if recording is enabled.
**Returns:** `Video | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.viewportSize()`
Returns the dimensions of the page's viewport.
**Returns:** `Size | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.workers()`
Returns an array of all WebWorkers associated with the page.
**Returns:** `Worker[]`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.consoleMessages()`
Returns all console messages emitted by the page.
**Returns:** `Promise<ConsoleMessage[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.clearConsoleMessages()`
Clears the accumulated console messages array.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.clearPageErrors()`
Clears the accumulated page errors array.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.pageErrors(options)`
Returns up to the currently retained last 200 page errors.
**Returns:** `Promise<Error[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.requestGC()`
Requests the browser to execute garbage collection.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.pause()`
Pauses test execution for manual debugging in the Playwright Inspector.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)

### `Page.hideHighlight()`
Hides any highlights drawn by `Locator.highlight()`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/page.ts`)


---

## Locator

### Filtering & Chaining

### `Locator.and(locator)`
Creates a locator that matches elements satisfying both locators simultaneously.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.filter(options)`
Filters the current locator based on inner text or the presence of a child locator.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.first()`
Returns a locator pointing to the first matching element.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.last()`
Returns a locator pointing to the last matching element.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.locator(selectorOrLocator, options)`
Returns a new locator that finds a descendant element matching the selector.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.nth(index)`
Returns a locator pointing to the n-th matching element.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.or(locator)`
Creates a locator that matches elements satisfying either locator.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.frameLocator(selector)`
Returns a frame locator resolving to an iframe matching the selector inside the current locator.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### Specialized Selectors

### `Locator.getByAltText(text, options)`
Creates a sub-locator that matches an element by its alt text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.getByLabel(text, options)`
Creates a sub-locator that matches an element by its associated label text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.getByPlaceholder(text, options)`
Creates a sub-locator that matches an input by its placeholder text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.getByRole(role, options)`
Creates a sub-locator that matches an element by its ARIA role and attributes.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.getByTestId(testId)`
Creates a sub-locator that matches an element by its test-id attribute.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.getByText(text, options)`
Creates a sub-locator that matches an element containing the specified text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.getByTitle(text, options)`
Creates a sub-locator that matches an element by its title attribute.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### Interactivity & Actions

### `Locator.blur(options)`
Removes keyboard focus from the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.check(options)`
Checks a checkbox or radio button.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.clear(options)`
Clears the value of an input or textarea element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.click(options)`
Clicks the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.dblclick(options)`
Double-clicks the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.dispatchEvent(type, eventInit, options)`
Dispatches an event directly on the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.dragTo(target, options)`
Drags the element to a target locator and drops it.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.drop(payload, options)`
Programmatically drops data payloads on the element without simulating mouse drag.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.fill(value, options)`
Fills an input, textarea, or contenteditable element with the specified value.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.focus(options)`
Sets keyboard focus on the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.hover(options)`
Hovers the mouse over the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.press(key, options)`
Presses a specific keyboard key on the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.pressSequentially(text, options)`
Types text sequentially into the element, simulating real user keystrokes.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.scrollIntoViewIfNeeded(options)`
Scrolls the element into the viewport if it is not already visible.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.selectOption(values, options)`
Selects one or more options in a `<select>` element.
**Returns:** `Promise<string[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.selectText(options)`
Highlights/selects the text content inside the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.setChecked(checked, options)`
Ensures the checkbox or radio button matches the specified boolean checked state.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.setInputFiles(files, options)`
Sets files on a `<input type="file">` element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.tap(options)`
Taps the element (for mobile emulation).
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.type(text, options)`
Types text into the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)
**Deprecated:** In most cases, you should use `locator.fill()` or `locator.pressSequentially()` instead.

### `Locator.uncheck(options)`
Unchecks a checkbox or radio button.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### Element State & Properties

### `Locator.all()`
Returns an array of locators pointing to every matched element.
**Returns:** `Promise<Locator[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.allInnerTexts()`
Returns an array of `innerText` values for all matched elements.
**Returns:** `Promise<string[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.allTextContents()`
Returns an array of `textContent` values for all matched elements.
**Returns:** `Promise<string[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.boundingBox(options)`
Returns the bounding box (x, y, width, height) of the element.
**Returns:** `Promise<Rect | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.count()`
Returns the number of elements matching the locator.
**Returns:** `Promise<number>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.getAttribute(name, options)`
Returns the value of the specified attribute on the element.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.innerHTML(options)`
Returns the `innerHTML` of the element.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.innerText(options)`
Returns the `innerText` of the element.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.inputValue(options)`
Returns the value of the input, textarea, or select element.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.isChecked(options)`
Checks if the checkbox or radio button is checked.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.isDisabled(options)`
Checks if the element is disabled.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.isEditable(options)`
Checks if the element is editable.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.isEnabled(options)`
Checks if the element is enabled.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.isHidden(options)`
Checks if the element is hidden.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.isVisible(options)`
Checks if the element is visible.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.textContent(options)`
Returns the `textContent` of the element.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.contentFrame()`
Returns a FrameLocator to the content frame of the matching iframe element.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.normalize()`
Returns a normalized locator mapping to the exact same elements without semantic ambiguities.
**Returns:** `Promise<Locator>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### Verification & Waiting

### `Locator.waitFor(options)`
Waits for the locator to resolve to an element in the given state (attached, detached, visible, hidden).
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.waitForFunction(pageFunction, arg, options)`
Waits for a function to evaluate to a truthy value, passing the element as an argument.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### Output & Handles

### `Locator.ariaSnapshot(options)`
Returns an ARIA snapshot representation of the element.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.ariaSnapshotJSON(options)`
Returns a JSON-serialized ARIA snapshot representation of the element.
**Returns:** `Promise<any>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.elementHandle(options)`
Resolves the locator into an `ElementHandle`.
**Returns:** `Promise<ElementHandle<SVGElement | HTMLElement>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.evaluate(pageFunction, arg, options)`
Evaluates a function in the page context, passing the matching element as an argument.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.evaluateAll(pageFunction, arg)`
Evaluates a function in the page context, passing all matching elements as an argument array.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.evaluateHandle(pageFunction, arg, options)`
Evaluates a function in the page context, passing the matching element, and returns a JSHandle.
**Returns:** `Promise<SmartHandle<R>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.elementHandles()`
Resolves the locator into an array of `ElementHandle`s for all matching elements.
**Returns:** `Promise<ElementHandle[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.screenshot(options)`
Captures a screenshot of the specific element.
**Returns:** `Promise<Buffer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.highlight(options)`
Draws a visible bounding box over the element for debugging purposes. Disposing the result removes the highlight.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.hideHighlight()`
Hides the highlight drawn by `locator.highlight()`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### Misc & Metadata

### `Locator.page()`
Returns the Page associated with this locator.
**Returns:** `Page`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.describe(description)`
Attaches a custom description to the locator for logging/debugging.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.description()`
Returns the custom description attached to the locator, if any.
**Returns:** `string | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `Locator.toString()`
Returns the string representation of the locator.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

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
**Deprecated:** Background pages have been removed from Chromium together with Manifest V2 extensions.
**Returns:** `Page[]`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.serviceWorkers()`
Returns all service workers currently active in the context.
**Returns:** `Worker[]`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### Configuration & State Management

### `BrowserContext.cookies(urls)`
Gets cookies for all or specific URLs.
**Returns:** `Promise<Cookie[]>`
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
**Deprecated:** Browsers may cache credentials after successful authentication. Create a new browser context instead.
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

### `BrowserContext.addInitScript(script, arg, options)`
Adds a script to be evaluated in all pages upon creation.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.exposeBinding(name, callback)`
Exposes a Node.js function as a global function on all pages, passing the source object.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.exposeFunction(name, callback)`
Exposes a Node.js function as a global function on all pages.
**Returns:** `Promise<Disposable>`
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
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `BrowserContext.once(event, listener)`
Adds a one-time event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `BrowserContext.off(event, listener)`
Removes an event listener. (Alias for `removeListener`).
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `BrowserContext.addListener(event, listener)`
Adds an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `BrowserContext.removeListener(event, listener)`
Removes an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `BrowserContext.removeAllListeners(type, options)`
Removes all listeners, or those of the specified event.
**Returns:** `this` (without options) or `Promise<void>` (with options)
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `BrowserContext.prependListener(event, listener)`
Adds an event listener to the beginning of the listeners array.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### Misc

### `BrowserContext.newCDPSession(page)`
Creates a new CDP session linked to a specific page or frame.
**Returns:** `Promise<CDPSession>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.credentials`
Credentials management for the context.
**Returns:** `Credentials`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContext.debugger`
Debugger allows to pause and resume the execution.
**Returns:** `Debugger`
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
Binds the browser to a named pipe or WebSocket, making it available for other clients to connect to, and returns the endpoint.
**Returns:** `Promise<{ endpoint: string }>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browser.ts`)

### `Browser.unbind()`
Unbinds and stops the browser server created by `bind()`.
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
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `Browser.once(event, listener)`
Adds a one-time event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `Browser.off(event, listener)`
Removes an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `Browser.addListener(event, listener)`
Adds an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `Browser.removeListener(event, listener)`
Removes an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `Browser.removeAllListeners(type, options)`
Removes all listeners, or those of the specified event.
**Returns:** `this` (without options) or `Promise<void>` (with options)
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `Browser.prependListener(event, listener)`
Adds an event listener to the beginning of the listeners array.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

---




## Frame

A `Frame` represents a single iframe or the main frame of a page. Most `Frame` methods mirror `Page` methods, but act exclusively within the context of the frame.

### Accessors & Navigation

### `Frame.page()`
Returns the page containing this frame.
**Returns:** `Page`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.name()`
Returns the frame's name attribute as specified in the tag.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.url()`
Returns the frame's current URL.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.parentFrame()`
Returns the parent frame, if any. Detached frames and main frames return `null`.
**Returns:** `Frame | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.childFrames()`
Returns an array of child frames.
**Returns:** `Array<Frame>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.isDetached()`
Returns `true` if the frame has been detached from the DOM.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.title()`
Returns the page title.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.goto(url, options)`
Navigates the frame. (Unlike `page.goto`, this strictly targets this specific frame).
**Returns:** `Promise<Response | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.frameElement()`
Returns the `iframe` or `frame` DOM element for this frame.
**Returns:** `Promise<ElementHandle>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.content()`
Gets the full HTML contents of the frame.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.setContent(html, options)`
Sets the HTML contents of the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### Locators

### `Frame.locator(selector, options)`
Returns a Locator pointing to a matching element within the frame.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.getByTestId(testId)`
Returns a Locator pointing to an element with a matching test-id inside the frame.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.getByAltText(text, options)`
Returns a Locator matching an element's `alt` attribute inside the frame.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.getByLabel(text, options)`
Returns a Locator matching a form element by its associated label inside the frame.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.getByPlaceholder(text, options)`
Returns a Locator matching an element's `placeholder` attribute inside the frame.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.getByRole(role, options)`
Returns a Locator matching an element by its ARIA role inside the frame.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.getByText(text, options)`
Returns a Locator matching a specific text node inside the frame.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.getByTitle(text, options)`
Returns a Locator matching an element's `title` attribute inside the frame.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.frameLocator(selector)`
Returns a FrameLocator pointing to a child iframe within this frame.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.pierceFrames(options)`
Returns a FrameLocator piercing through all matching child iframes automatically.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.$(selector, options)`
Returns the ElementHandle pointing to the frame element.
**Returns:** `Promise<ElementHandleForTag<K> | null>` (tag-name selector) or `Promise<ElementHandle<SVGElement | HTMLElement> | null>` (general string selector)
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.$$(selector)`
Returns the ElementHandles pointing to the frame elements.
**Returns:** `Promise<ElementHandleForTag<K>[]>` (tag-name selector) or `Promise<ElementHandle<SVGElement | HTMLElement>[]>` (general string selector)
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.$eval(selector, pageFunction, arg)`
Returns the return value of `pageFunction`.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.$$eval(selector, pageFunction, arg)`
Returns the return value of `pageFunction` applied to all matching elements.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### Interactions & Evaluation

### `Frame.click(selector, options)`
Clicks an element within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.dblclick(selector, options)`
Double-clicks an element within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.dragAndDrop(source, target, options)`
Drags an element to a target within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.tap(selector, options)`
Taps an element within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.fill(selector, value, options)`
Fills an input element within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.focus(selector, options)`
Focuses an element within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.hover(selector, options)`
Hovers an element within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.press(selector, key, options)`
Focuses an element within the frame and presses a single key.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.selectOption(selector, values, options)`
Selects options within a `<select>` element in the frame.
**Returns:** `Promise<string[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.setInputFiles(selector, files, options)`
Sets files on a file input within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.check(selector, options)`
Checks a checkbox or radio button within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.uncheck(selector, options)`
Unchecks a checkbox or radio button within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.setChecked(selector, checked, options)`
Checks or unchecks an element based on the provided state.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.type(selector, text, options)`
**Deprecated:** (Use `locator.fill()` instead). Types into an input element within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.evaluate(pageFunction, arg, options)`
Executes JavaScript inside the frame.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.evaluateHandle(pageFunction, arg, options)`
Executes JavaScript inside the frame and returns a JSHandle to the result.
**Returns:** `Promise<SmartHandle<R>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.dispatchEvent(selector, type, eventInit, options)`
Dispatches a DOM event on an element within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### State Queries

### `Frame.textContent(selector, options)`
Gets the text content of an element in the frame.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.innerText(selector, options)`
Gets the rendered inner text of an element in the frame.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.innerHTML(selector, options)`
Gets the inner HTML of an element in the frame.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.getAttribute(selector, name, options)`
Gets a DOM attribute of an element in the frame.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.inputValue(selector, options)`
Gets the input value of a form element in the frame.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.isChecked(selector, options)`
Returns whether a checkbox or radio is checked in the frame.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.isDisabled(selector, options)`
Returns whether an element is disabled in the frame.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.isEditable(selector, options)`
Returns whether an element is editable in the frame.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.isEnabled(selector, options)`
Returns whether an element is enabled in the frame.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.isHidden(selector, options)`
Returns whether an element is hidden in the frame.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.isVisible(selector, options)`
Returns whether an element is visible in the frame.
**Returns:** `Promise<boolean>`

**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### Waiting & Overrides

### `Frame.waitForFunction(pageFunction, arg, options)`
Waits for a function to evaluate to a truthy value inside the frame.
**Returns:** `Promise<SmartHandle<R>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.waitForLoadState(state, options)`
Waits for the frame to reach a specific load state.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.waitForNavigation(options)`
**Deprecated:** (Use `waitForURL` instead). Waits for the frame to navigate.
**Returns:** `Promise<Response | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.waitForSelector(selector, options)`
Waits for a selector to appear or disappear inside the frame.
**Returns:** `Promise<null|ElementHandle<SVGElement | HTMLElement>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.waitForTimeout(timeout)`
**Deprecated:** (Use `page.waitForTimeout` for debugging only). Waits for a timeout.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.waitForURL(url, options)`
Waits for the frame to navigate to the given URL.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.addScriptTag(options)`
Adds a `<script>` tag to the frame.
**Returns:** `Promise<ElementHandle>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.addStyleTag(options)`
Adds a `<link rel="stylesheet">` or `<style>` tag to the frame.
**Returns:** `Promise<ElementHandle>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

---

## Route

The `Route` class represents an intercepted network request.

### Methods

### `Route.request()`
Returns the intercepted request.
**Returns:** `Request`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Route.abort(errorCode)`
Aborts the route's request.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Route.continue(options)`
Sends the route's request to the network with optional overrides.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Route.fallback(options)`
Continues the request, allowing subsequent matching handlers in the routing chain to be invoked.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Route.fetch(options)`
Performs the request and fetches the response without fulfilling it immediately.
**Returns:** `Promise<APIResponse>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Route.fulfill(options)`
Fulfills the route's request with a given response (e.g. mocking a 200 OK with custom body).
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

---

## Request

The `Request` class represents an HTTP request sent by a page.

### Methods

### `Request.url()`
Returns the URL of the request.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.resourceType()`
Returns the resource type (e.g., `document`, `image`, `fetch`).
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.method()`
Returns the HTTP method of the request.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.postData()`
Returns the request's post body, if any, as a string.
**Returns:** `string | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.postDataBuffer()`
Returns the request's post body, if any, as a raw Buffer.
**Returns:** `Buffer | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.postDataJSON()`
Returns the parsed request body for form-urlencoded data and JSON as a fallback, if any.
**Returns:** `Serializable | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.headers()`
Returns an object containing the HTTP headers associated with the request.
**Returns:** `{ [key: string]: string }`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.allHeaders()`
Returns a promise that resolves to an object with all HTTP headers.
**Returns:** `Promise<{ [key: string]: string }>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.headersArray()`
Returns a promise that resolves to an array of header objects (`{ name, value }`).
**Returns:** `Promise<{ name: string, value: string }[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.headerValue(name)`
Returns the value of the specified header.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.response()`
Returns the matching `Response` object, or `null` if the request failed.
**Returns:** `Promise<Response | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.existingResponse()`
Returns the `Response` object if the response has already been received, `null` otherwise. Unlike `response()`, does not wait for the response to arrive.
**Returns:** `Response | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.frame()`
Returns the `Frame` that initiated this request.
**Returns:** `Frame`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.serviceWorker()`
Returns the service worker that initiated this request, if any.
**Returns:** `Worker | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.isNavigationRequest()`
Returns whether this request is driving a frame navigation.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.redirectedFrom()`
Returns the request that was redirected to this request, if any.
**Returns:** `Request | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.redirectedTo()`
Returns the request this request was redirected to, if any.
**Returns:** `Request | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.failure()`
Returns the failure message if the request failed.
**Returns:** `{ errorText: string } | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.timing()`
Returns resource timing information for the request.
**Returns:** `{ startTime: number, domainLookupStart: number, domainLookupEnd: number, connectStart: number, secureConnectionStart: number, connectEnd: number, requestStart: number, responseStart: number, responseEnd: number }`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.sizes()`
Returns resource size information (e.g. body size, header size).
**Returns:** `Promise<{ requestBodySize: number, requestHeadersSize: number, responseBodySize: number, responseHeadersSize: number }>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

---

## Response

The `Response` class represents an HTTP response received by a page.

### Methods

### `Response.url()`
Returns the URL of the response.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.ok()`
Returns `true` if the status code is between 200 and 299.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.status()`
Returns the status code of the response (e.g., 200 for a success).
**Returns:** `number`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.statusText()`
Returns the status text of the response (e.g., "OK").
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.fromServiceWorker()`
Returns `true` if this response was served from a Service Worker.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.headers()`
Returns an object containing the HTTP headers associated with the response.
**Returns:** `{ [key: string]: string }`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.allHeaders()`
Returns a promise that resolves to an object with all HTTP headers.
**Returns:** `Promise<{ [key: string]: string }>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.headersArray()`
Returns a promise that resolves to an array of header objects (`{ name, value }`).
**Returns:** `Promise<{ name: string, value: string }[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.headerValue(name)`
Returns the value of the specified header.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.headerValues(name)`
Returns all values for the specified header.
**Returns:** `Promise<string[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.finished()`
Waits for this response to finish; currently resolves to `null`.
**Returns:** `Promise<Error | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.body()`
Returns the raw body payload of the response as a Buffer.
**Returns:** `Promise<Buffer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.text()`
Returns the text representation of the response body.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.json()`
Returns the JSON representation of the response body.
**Returns:** `Promise<Serializable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.request()`
Returns the matching `Request` object.
**Returns:** `Request`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.frame()`
Returns the `Frame` that initiated this response.
**Returns:** `Frame`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.serverAddr()`
Returns the IP address and port of the server if available.
**Returns:** `Promise<{ ipAddress: string, port: number } | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.securityDetails()`
Returns the security details if the response was received over a secure connection.
**Returns:** `Promise<{ issuer?: string, protocol?: string, subjectName?: string, validFrom?: number, validTo?: number } | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Response.httpVersion()`
Returns the HTTP version of the response.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

---

## JSHandle

Represents an in-page JavaScript object, created by `page.evaluateHandle()`.

### `JSHandle.evaluate(pageFunction, arg, options)`
Evaluates a function in the page context, passing this handle as the first argument.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/jsHandle.ts`)

### `JSHandle.evaluateHandle(pageFunction, arg, options)`
Evaluates a function and returns its value as a `JSHandle`.
**Returns:** `Promise<SmartHandle<R>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/jsHandle.ts`)

### `JSHandle.jsonValue()`
Returns a JSON representation of the referenced object.
**Returns:** `Promise<T>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/jsHandle.ts`)

### `JSHandle.asElement()`
Returns the handle as an `ElementHandle`, or `null` when it is not an element.
**Returns:** `ElementHandle<T> | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/jsHandle.ts`)

### `JSHandle.dispose()`
Stops referencing the JavaScript object so it can be garbage collected.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/jsHandle.ts`)

### `JSHandle.getProperties()`
Returns own property names mapped to `JSHandle` values.
**Returns:** `Promise<Map<string, JSHandle>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/jsHandle.ts`)

### `JSHandle.getProperty(propertyName)`
Fetches one property from the referenced object.
**Returns:** `Promise<JSHandle>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/jsHandle.ts`)

### `JSHandle.[Symbol.asyncDispose]()`
Disposes the handle through the explicit resource-management protocol.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/jsHandle.ts`)

---

## ElementHandle

Represents a particular in-page DOM element. Locator-based APIs are preferred for new tests.

### `ElementHandle.$(selector, options)`
Finds one matching element in this handle's subtree.
**Returns:** `Promise<ElementHandle | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.$$(selector)`
Finds all matching elements in this handle's subtree.
**Returns:** `Promise<ElementHandle[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.$eval(selector, pageFunction, arg)`
Evaluates a function with the first matching descendant as its first argument.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.$$eval(selector, pageFunction, arg)`
Evaluates a function with all matching descendants as an array.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.boundingBox()`
Returns the element bounding box, or `null` when it is not visible.
**Returns:** `Promise<{ x: number, y: number, width: number, height: number } | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.check(options)`
Checks a checkbox or radio input.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.click(options)`
Clicks the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.contentFrame()`
Returns the content frame for an iframe/frame element, or `null` otherwise.
**Returns:** `Promise<Frame | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.dblclick(options)`
Double-clicks the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.dispatchEvent(type, eventInit)`
Dispatches an event directly on the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.fill(value, options)`
Fills an input or textarea with the specified value.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.focus()`
Focuses the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.getAttribute(name)`
Returns an attribute value, or `null` when absent.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.hover(options)`
Hovers over the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.innerHTML()`
Returns `element.innerHTML`.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.innerText()`
Returns `element.innerText`.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.inputValue(options)`
Returns the value of an input, textarea, or select element.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)
**Deprecated:** The `options.timeout` option is ignored; the value is returned immediately.

### `ElementHandle.isChecked()`
Returns whether a checkbox or radio input is checked.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.isDisabled()`
Returns whether the element is disabled.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.isEditable()`
Returns whether the element is editable.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.isEnabled()`
Returns whether the element is enabled.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.isHidden()`
Returns whether the element is hidden.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.isVisible()`
Returns whether the element is visible.
**Returns:** `Promise<boolean>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.ownerFrame()`
Returns the frame containing this element.
**Returns:** `Promise<Frame | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.press(key, options)`
Focuses the element and presses a key.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.screenshot(options)`
Takes a screenshot of the element.
**Returns:** `Promise<Buffer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.scrollIntoViewIfNeeded(options)`
Scrolls the element into view when needed.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.selectOption(values, options)`
Selects one or more options in a select element.
**Returns:** `Promise<string[]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.selectText(options)`
Selects the element text.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.setChecked(checked, options)`
Sets a checkbox or radio element's checked state.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.setInputFiles(files, options)`
Sets the value of a file input.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.tap(options)`
Performs a tap gesture on the element.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.textContent()`
Returns the node text content.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.type(text, options)`
Types text character by character. Prefer `Locator.fill()` or `Locator.pressSequentially()`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)
**Deprecated:** Use locator-based typing instead.

### `ElementHandle.uncheck(options)`
Unchecks a checkbox or radio input.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.waitForElementState(state, options)`
Waits for an element state such as visible, hidden, stable, enabled, disabled, or editable.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

### `ElementHandle.waitForSelector(selector, options)`
Waits for a matching descendant to satisfy the requested state.
**Returns:** `Promise<ElementHandle | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/elementHandle.ts`)

---

## Keyboard

Provides low-level keyboard input through `page.keyboard`.

### `Keyboard.down(key)`
Dispatches a `keydown` event.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

### `Keyboard.insertText(text)`
Dispatches an input event without keydown, keyup, or keypress events.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

### `Keyboard.press(key, options)`
Runs `keyboard.down()` followed by `keyboard.up()`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

### `Keyboard.type(text, options)`
Sends keyboard events for each character.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

### `Keyboard.up(key)`
Dispatches a `keyup` event.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

---

## Mouse

Provides low-level mouse input and cursor positioning through `page.mouse`.

### `Mouse.click(x, y, options)`
Moves, presses, and releases the mouse.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

### `Mouse.dblclick(x, y, options)`
Moves the mouse and clicks twice.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

### `Mouse.down(options)`
Dispatches a `mousedown` event.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

### `Mouse.move(x, y, options)`
Moves to coordinates, optionally emitting interpolated steps.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

### `Mouse.up(options)`
Dispatches a `mouseup` event.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

### `Mouse.wheel(deltaX, deltaY)`
Dispatches a wheel event.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

---

### Batch audit summary

| Class | Declared members | Overload declarations |
| --- | ---: | ---: |
| JSHandle | 8 | 10 |
| ElementHandle | 37 | 48 |
| Keyboard | 5 | 5 |
| Mouse | 6 | 6 |

Verified against source commit `b4a646a624c0b1e8e352d320cbc6684581625ff6`. ElementHandle inherits JSHandle members; inherited members are documented only under JSHandle.

---

## Download

Represents a file download dispatched by a page through the `page.on('download')` event.

### `Download.cancel()`
Cancels the download; `failure()` resolves to `canceled` after successful cancellation.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/download.ts`)

### `Download.createReadStream()`
Returns a readable stream for a successful download.
**Returns:** `Promise<Readable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/download.ts`)

### `Download.delete()`
Deletes the downloaded file, waiting for completion when necessary.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/download.ts`)

### `Download.failure()`
Returns an error message, or `null` for a successful download.
**Returns:** `Promise<string | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/download.ts`)

### `Download.page()`
Returns the page that owns the download.
**Returns:** `Page`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/download.ts`)

### `Download.path()`
Returns the downloaded file path; throws for failed/canceled downloads or remote connections.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/download.ts`)

### `Download.saveAs(path)`
Copies the download to a user-specified path, waiting for completion as needed.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/download.ts`)

### `Download.suggestedFilename()`
Returns the browser-computed suggested filename.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/download.ts`)

### `Download.url()`
Returns the downloaded URL.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/download.ts`)

---

## Dialog

Represents a JavaScript `alert`, `beforeunload`, `confirm`, or `prompt` dialog.

### `Dialog.accept(promptText)`
Accepts the dialog, optionally supplying prompt text.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/dialog.ts`)

### `Dialog.defaultValue()`
Returns the default prompt value, or an empty string for other dialog types.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/dialog.ts`)

### `Dialog.dismiss()`
Dismisses the dialog.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/dialog.ts`)

### `Dialog.message()`
Returns the dialog message.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/dialog.ts`)

### `Dialog.page()`
Returns the page that initiated the dialog, when available.
**Returns:** `Page | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/dialog.ts`)

### `Dialog.type()`
Returns the dialog type: `alert`, `beforeunload`, `confirm`, or `prompt`.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/dialog.ts`)

---

## FileChooser

Represents a file input chooser dispatched through `page.on('filechooser')`.

### `FileChooser.element()`
Returns the associated input element handle.
**Returns:** `ElementHandle`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fileChooser.ts`)

### `FileChooser.isMultiple()`
Returns whether the input accepts multiple files.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fileChooser.ts`)

### `FileChooser.page()`
Returns the page that owns this chooser.
**Returns:** `Page`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fileChooser.ts`)

### `FileChooser.setFiles(files, options)`
Sets or clears the associated file input value.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fileChooser.ts`)
**Deprecated:** `options.noWaitAfter` has no effect.

---

## ConsoleMessage

Represents a `console.*` message dispatched through `page.on('console')`.

### `ConsoleMessage.args()`
Returns arguments passed to the console call as `JSHandle` instances.
**Returns:** `JSHandle[]`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/consoleMessage.ts`)

### `ConsoleMessage.location()`
Returns the call-site URL and zero-based line and column information.
**Returns:** `{ url: string, line: number, column: number, lineNumber: number, columnNumber: number }`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/consoleMessage.ts`)
**Deprecated:** `lineNumber` and `columnNumber`; use `line` and `column` instead.

### `ConsoleMessage.page()`
Returns the page that produced the message, when available.
**Returns:** `Page | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/consoleMessage.ts`)

### `ConsoleMessage.text()`
Returns the console message text.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/consoleMessage.ts`)

### `ConsoleMessage.timestamp()`
Returns the message timestamp in milliseconds since the Unix epoch.
**Returns:** `number`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/consoleMessage.ts`)

### `ConsoleMessage.type()`
Returns the console message type.
**Returns:** `"log" | "debug" | "info" | "error" | "warning" | "dir" | "dirxml" | "table" | "trace" | "clear" | "startGroup" | "startGroupCollapsed" | "endGroup" | "assert" | "profile" | "profileEnd" | "count" | "time" | "timeEnd"`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/consoleMessage.ts`)

### `ConsoleMessage.worker()`
Returns the web worker or service worker that produced the message, when available.
**Returns:** `Worker | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/consoleMessage.ts`)

---

### Batch audit summary

| Class | Declared members | Overload declarations |
| --- | ---: | ---: |
| Download | 9 | 9 |
| Dialog | 6 | 6 |
| FileChooser | 4 | 4 |
| ConsoleMessage | 7 | 7 |

Verified against source commit `b4a646a624c0b1e8e352d320cbc6684581625ff6`.

---

## APIRequestContext

Performs HTTP(S) requests with isolated cookie storage and optional tracing.

### `APIRequestContext.delete(url, options)`
Sends an HTTP DELETE request.
**Returns:** `Promise<APIResponse>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.dispose(options)`
Discards resources held by this request context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.fetch(urlOrRequest, options)`
Sends an HTTP request and manages cookies for the context.
**Returns:** `Promise<APIResponse>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.get(url, options)`
Sends an HTTP GET request.
**Returns:** `Promise<APIResponse>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.head(url, options)`
Sends an HTTP HEAD request.
**Returns:** `Promise<APIResponse>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.patch(url, options)`
Sends an HTTP PATCH request.
**Returns:** `Promise<APIResponse>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.post(url, options)`
Sends an HTTP POST request.
**Returns:** `Promise<APIResponse>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.put(url, options)`
Sends an HTTP PUT request.
**Returns:** `Promise<APIResponse>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.storageState(options)`
Returns cookies and local-storage state for the request context.
**Returns:** `Promise<StorageState>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.tracing`
Returns the tracing API associated with this request context.
**Returns:** `Tracing`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIRequestContext.[Symbol.asyncDispose]()`
Disposes the request context asynchronously.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

---

## APIResponse

Represents a response returned by an `APIRequestContext` request.

### `APIResponse.body()`
Returns the response body as a buffer.
**Returns:** `Promise<Buffer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.dispose()`
Disposes the response body held in memory.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.headers()`
Returns all response headers as an object.
**Returns:** `{ [key: string]: string }`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.headersArray()`
Returns response headers while preserving casing and duplicates.
**Returns:** `Array<{ name: string, value: string }>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.json()`
Parses and returns the response body as JSON.
**Returns:** `Promise<Serializable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.ok()`
Returns whether the status code is in the 200–299 range.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.securityDetails()`
Returns HTTPS security details, or `null` when unavailable.
**Returns:** `Promise<{ issuer?: string, protocol?: string, subjectName?: string, validFrom?: number, validTo?: number } | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.serverAddr()`
Returns the server IP address and port, or `null` when unavailable.
**Returns:** `Promise<{ ipAddress: string, port: number } | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.status()`
Returns the HTTP status code.
**Returns:** `number`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.statusText()`
Returns the HTTP status text.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.text()`
Returns the response body as text.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.timing()`
Returns resource timing information.
**Returns:** `ResourceTiming`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.url()`
Returns the response URL.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

### `APIResponse.[Symbol.asyncDispose]()`
Disposes the response body asynchronously.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

---

## WebSocket

Represents a WebSocket connection created within a page.

### `WebSocket.isClosed()`
Returns whether the WebSocket is closed.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocket.url()`
Returns the WebSocket URL.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocket.waitForEvent(event, optionsOrPredicate)`
Waits for a close, frame, or socket-error event.
**Returns:** `Promise<any>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocket.on(event, listener)`
Adds an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `WebSocket.once(event, listener)`
Adds a one-time event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `WebSocket.off(event, listener)`
Removes an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `WebSocket.addListener(event, listener)`
Adds an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `WebSocket.removeListener(event, listener)`
Removes an event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

### `WebSocket.prependListener(event, listener)`
Adds an event listener at the beginning of the listener list.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/eventEmitter.ts`)

---

## Worker

Represents a dedicated WebWorker or service worker.

### `Worker.evaluate(pageFunction, arg)`
Evaluates a function or expression in the worker context.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

### `Worker.evaluateHandle(pageFunction, arg)`
Evaluates a function and returns its value as a `JSHandle`.
**Returns:** `Promise<SmartHandle<R>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

### `Worker.on(event, listener)`
Adds a worker event listener for `close` or `console`.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

### `Worker.once(event, listener)`
Adds a one-time worker event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

### `Worker.addListener(event, listener)`
Adds a worker event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

### `Worker.removeListener(event, listener)`
Removes a worker event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

### `Worker.off(event, listener)`
Removes a worker event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

### `Worker.prependListener(event, listener)`
Adds a worker listener at the beginning of the listener list.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

### `Worker.url()`
Returns the worker URL.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

### `Worker.waitForEvent(event, optionsOrPredicate)`
Waits for a worker `close` or `console` event.
**Returns:** `Promise<Worker | ConsoleMessage>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/worker.ts`)

---

### Batch audit summary

| Class | Declared members | Overload declarations |
| --- | ---: | ---: |
| APIRequestContext | 11 | 11 |
| APIResponse | 14 | 14 |
| WebSocket | 9 | 27 |
| Worker | 10 | 14 |

Verified against source commit `b4a646a624c0b1e8e352d320cbc6684581625ff6`.

---

## Selectors

Installs custom selector engines and configures the attribute used by `getByTestId`.

### `Selectors.register(name, script, options)`
Registers a custom selector engine before pages are created.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/selectors.ts`)

### `Selectors.setTestIdAttribute(attributeName)`
Defines the attribute name used by `page.getByTestId(testId)`.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/selectors.ts`)

---

## Touchscreen

Simulates touchscreen input in main-frame CSS pixels.

### `Touchscreen.tap(x, y)`
Dispatches `touchstart` and `touchend` for a single touch at the specified coordinates.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/input.ts`)

---

## Tracing

Controls trace and HAR recording for a browser context.

### `Tracing.group(name, options)`
Creates a trace group and assigns subsequent API calls to it until `groupEnd()` is called.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/tracing.ts`)

### `Tracing.groupEnd()`
Closes the most recently opened trace group.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/tracing.ts`)

### `Tracing.start(options)`
Starts tracing for the browser context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/tracing.ts`)

### `Tracing.startChunk(options)`
Starts a new trace chunk within an active tracing session.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/tracing.ts`)

### `Tracing.startHar(path, options)`
Starts HAR recording for network activity in the browser context.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/tracing.ts`)

### `Tracing.stop(options)`
Stops tracing and optionally exports the collected trace.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/tracing.ts`)

### `Tracing.stopChunk(options)`
Stops the current trace chunk and optionally exports it.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/tracing.ts`)

### `Tracing.stopHar()`
Stops HAR recording and saves the HAR file.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/tracing.ts`)

---

## Video

Represents the recorded video associated with a page in a video-enabled context.

### `Video.delete()`
Deletes the video file, waiting for recording to finish if necessary.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/video.ts`)

### `Video.path()`
Returns the recorded video's filesystem path.
**Returns:** `Promise<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/video.ts`)

### `Video.saveAs(path)`
Saves the video to a user-specified destination path.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/video.ts`)

---

## Clock

Controls fake time and timer progression for an entire browser context.

### `Clock.fastForward(ticks)`
Advances the clock by the specified duration and fires due timers at most once.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/clock.ts`)

### `Clock.install(options)`
Installs fake implementations for time-related APIs in the browser context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/clock.ts`)

### `Clock.pauseAt(time)`
Advances the clock to the specified time and pauses further automatic progression.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/clock.ts`)

### `Clock.resume()`
Resumes normal timer execution after the clock has been paused.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/clock.ts`)

### `Clock.runFor(ticks)`
Advances the clock while firing all scheduled time-related callbacks.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/clock.ts`)

### `Clock.setFixedTime(time)`
Makes `Date.now()` and `new Date()` return a fixed fake time while timers continue running.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/clock.ts`)

### `Clock.setSystemTime(time)`
Sets system time without triggering timers.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/clock.ts`)

---

## Coverage

Collects JavaScript and CSS coverage information on Chromium-based browsers.

### `Coverage.startCSSCoverage(options)`
Starts CSS coverage collection.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/coverage.ts`)

### `Coverage.startJSCoverage(options)`
Starts JavaScript coverage collection.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/coverage.ts`)

### `Coverage.stopCSSCoverage()`
Stops CSS coverage collection and returns stylesheet coverage data.
**Returns:** `Promise<Array<{...}>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/coverage.ts`)

### `Coverage.stopJSCoverage()`
Stops JavaScript coverage collection and returns script coverage data.
**Returns:** `Promise<Array<{...}>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/coverage.ts`)

---

### Batch audit summary

| Class | Declared members | Overload declarations |
| --- | ---: | ---: |
| Selectors | 2 | 2 |
| Touchscreen | 1 | 1 |
| Tracing | 8 | 8 |
| Video | 3 | 3 |
| Clock | 7 | 7 |
| Coverage | 4 | 4 |

Verified against source commit `b4a646a624c0b1e8e352d320cbc6684581625ff6`.

---

## BrowserType

Launches new browser instances or connects to existing ones for a specific engine.

### `BrowserType.connectOverCDP(endpointURL, options)`
Attaches Playwright to an existing Chromium-based browser over the Chrome DevTools Protocol.
**Returns:** `Promise<Browser>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `BrowserType.connect(wsEndpoint, options)`
Attaches Playwright to an existing browser launched by `launchServer()`.
**Returns:** `Promise<Browser>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `BrowserType.executablePath()`
Returns the path where Playwright expects the bundled browser executable.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `BrowserType.launch(options)`
Launches a new browser process.
**Returns:** `Promise<Browser>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `BrowserType.launchPersistentContext(userDataDir, options)`
Launches a browser with persistent storage and returns its only context.
**Returns:** `Promise<BrowserContext>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `BrowserType.launchServer(options)`
Launches a browser server that accepts later Playwright connections.
**Returns:** `Promise<BrowserServer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `BrowserType.name()`
Returns the browser engine name, such as `chromium`, `webkit`, or `firefox`.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

---

## CDPSession

Provides raw access to the Chrome DevTools Protocol for a specific target.

### `CDPSession.on(event, listener)`
Adds a CDP event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/cdpSession.ts`)

### `CDPSession.addListener(event, listener)`
Adds a CDP event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/cdpSession.ts`)

### `CDPSession.off(event, listener)`
Removes a CDP event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/cdpSession.ts`)

### `CDPSession.removeListener(event, listener)`
Removes a CDP event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/cdpSession.ts`)

### `CDPSession.once(event, listener)`
Adds a one-time CDP event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/cdpSession.ts`)

### `CDPSession.send(method, params)`
Sends a raw DevTools Protocol command through the session.
**Returns:** `Promise<Protocol.CommandReturnValues[T]>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/cdpSession.ts`)

### `CDPSession.prependListener(event, listener)`
Adds a CDP event listener at the beginning of the listener list.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/cdpSession.ts`)

### `CDPSession.detach()`
Detaches the session from its target.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/cdpSession.ts`)

---

## ElectronApplication

Controls an Electron application process and its windows.

### `ElectronApplication.evaluate(pageFunction, arg)`
Evaluates a function in the Electron main process and returns its value.
**Returns:** `Promise<R>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.evaluateHandle(pageFunction, arg)`
Evaluates a function in the Electron main process and returns its value as a `JSHandle`.
**Returns:** `Promise<SmartHandle<R>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.on(event, listener)`
Adds an Electron application event listener for `close`, `console`, or `window`.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.once(event, listener)`
Adds a one-time Electron application event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.addListener(event, listener)`
Adds an Electron application event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.removeListener(event, listener)`
Removes an Electron application event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.off(event, listener)`
Removes an Electron application event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.prependListener(event, listener)`
Adds an Electron application event listener at the beginning of the listener list.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.browserWindow(page)`
Returns the `BrowserWindow` object handle corresponding to a Playwright page.
**Returns:** `Promise<JSHandle>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.close()`
Closes the Electron application.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.context()`
Returns the browser context backing the Electron application.
**Returns:** `BrowserContext`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.firstWindow(options)`
Waits for and returns the first opened application window.
**Returns:** `Promise<Page>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.process()`
Returns the main process child process for the Electron application.
**Returns:** `ChildProcess`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.waitForEvent(event, optionsOrPredicate)`
Waits for an Electron application event and returns its payload.
**Returns:** `Promise<void | ConsoleMessage | Page>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.windows()`
Returns all currently opened application windows.
**Returns:** `Array<Page>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

### `ElectronApplication.[Symbol.asyncDispose]()`
Asynchronously closes the Electron application when used with `await using`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

---

## Electron

Launches Electron applications for automation.

### `Electron.launch(options)`
Launches an Electron application and returns its controller object.
**Returns:** `Promise<ElectronApplication>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/electron.ts`)

---

## Android

Provides experimental Android automation entry points.

### `Android.connect(endpoint, options)`
Connects to an existing Android automation server endpoint.
**Returns:** `Promise<AndroidDevice>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `Android.devices(options)`
Returns the list of detected Android devices available through ADB.
**Returns:** `Promise<Array<AndroidDevice>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `Android.launchServer(options)`
Launches an Android automation server that clients can connect to.
**Returns:** `Promise<BrowserServer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `Android.setDefaultTimeout(timeout)`
Sets the default timeout for Android operations.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

---

## AndroidDevice

Represents a connected Android device or emulator.

### `AndroidDevice.on(event, listener)`
Adds a device event listener for `close` or `webview`.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.once(event, listener)`
Adds a one-time device event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.addListener(event, listener)`
Adds a device event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.removeListener(event, listener)`
Removes a device event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.off(event, listener)`
Removes a device event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.prependListener(event, listener)`
Adds a device event listener at the beginning of the listener list.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.close()`
Disconnects from the device.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.drag(selector, dest, options)`
Drags the matched widget toward the specified point.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.fill(selector, text, options)`
Fills the matched input widget with text.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.fling(selector, direction, options)`
Performs a fast fling gesture on the matched widget.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.info(selector)`
Returns element metadata for the matched widget.
**Returns:** `Promise<AndroidElementInfo>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.installApk(file, options)`
Installs an APK on the device.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.launchBrowser(options)`
Launches a browser on the device and returns its browser context.
**Returns:** `Promise<BrowserContext>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.longTap(selector, options)`
Performs a long tap on the matched widget.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.model()`
Returns the device model name.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.open(command)`
Launches a shell process on the device and returns a socket for communicating with it.
**Returns:** `Promise<AndroidSocket>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.pinchClose(selector, percent, options)`
Performs a pinch-close gesture on the matched widget.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.pinchOpen(selector, percent, options)`
Performs a pinch-open gesture on the matched widget.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.press(selector, key, options)`
Presses a key in the matched widget.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.push(file, path, options)`
Copies a file or buffer to a path on the device.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.screenshot(options)`
Captures a screenshot of the device.
**Returns:** `Promise<Buffer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.scroll(selector, direction, percent, options)`
Scrolls the matched widget in the specified direction.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.serial()`
Returns the device serial number.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.setDefaultTimeout(timeout)`
Sets the default timeout for device operations.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.shell(command)`
Executes a shell command on the device and returns its output.
**Returns:** `Promise<Buffer>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.swipe(selector, direction, percent, options)`
Swipes the matched widget in the specified direction.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.tap(selector, options)`
Taps the matched widget.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.wait(selector, options)`
Waits for the matched widget to appear or disappear.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.waitForEvent(event, optionsOrPredicate)`
Waits for a device event and returns its payload.
**Returns:** `Promise<AndroidDevice | AndroidWebView>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.webView(selector, options)`
Waits for and returns an Android WebView matching the selector.
**Returns:** `Promise<AndroidWebView>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.webViews()`
Returns all currently open WebViews.
**Returns:** `Array<AndroidWebView>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.input`
Exposes low-level input primitives for the device.
**Returns:** `AndroidInput`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidDevice.[Symbol.asyncDispose]()`
Asynchronously closes the device when used with `await using`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

---

## AndroidInput

Provides low-level input primitives for an Android device.

### `AndroidInput.drag(from, to, steps)`
Performs a drag gesture between two points.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidInput.press(key)`
Presses the specified Android key.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidInput.swipe(from, segments, steps)`
Performs a swipe gesture following the specified path segments.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidInput.tap(point)`
Taps the specified point on the device screen.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidInput.type(text)`
Types text into the currently focused widget.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

---

## AndroidSocket

Represents a socket connected to a process running on the Android device.

### `AndroidSocket.on(event, listener)`
Adds a socket event listener for `close` or `data`.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidSocket.once(event, listener)`
Adds a one-time socket event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidSocket.addListener(event, listener)`
Adds a socket event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidSocket.removeListener(event, listener)`
Removes a socket event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidSocket.off(event, listener)`
Removes a socket event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidSocket.prependListener(event, listener)`
Adds a socket event listener at the beginning of the listener list.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidSocket.close()`
Closes the socket.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidSocket.write(data)`
Writes data to the socket.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidSocket.[Symbol.asyncDispose]()`
Asynchronously closes the socket when used with `await using`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

---

## AndroidWebView

Represents an inspectable WebView exposed by an Android application.

### `AndroidWebView.on(event, listener)`
Adds a WebView close-event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidWebView.once(event, listener)`
Adds a one-time WebView close-event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidWebView.addListener(event, listener)`
Adds a WebView close-event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidWebView.removeListener(event, listener)`
Removes a WebView close-event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidWebView.off(event, listener)`
Removes a WebView close-event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidWebView.prependListener(event, listener)`
Adds a WebView close-event listener at the beginning of the listener list.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidWebView.page()`
Connects to the WebView and returns a Playwright page for interacting with it.
**Returns:** `Promise<Page>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidWebView.pid()`
Returns the WebView process identifier.
**Returns:** `number`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

### `AndroidWebView.pkg()`
Returns the WebView package identifier.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/android.ts`)

---

### Batch audit summary

| Class | Declared members | Overload declarations |
| --- | ---: | ---: |
| BrowserType | 7 | 10 |
| CDPSession | 8 | 19 |
| ElectronApplication | 16 | 32 |
| Electron | 1 | 1 |
| Android | 4 | 4 |
| AndroidDevice | 33 | 40 |
| AndroidInput | 5 | 5 |
| AndroidSocket | 9 | 15 |
| AndroidWebView | 9 | 9 |

Verified against source commit `b4a646a624c0b1e8e352d320cbc6684581625ff6`.

---

## FrameLocator

Enters iframe contexts and creates locators scoped inside them.

### `FrameLocator.first()`
Returns a frame locator for the first matching frame.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)
**Deprecated:** use `locator.first().contentFrame()` instead.

### `FrameLocator.frameLocator(selector)`
Creates a child frame locator inside the current frame locator.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `FrameLocator.getByAltText(text, options)`
Locates elements inside the frame by alt text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `FrameLocator.getByLabel(text, options)`
Locates form controls inside the frame by associated label text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `FrameLocator.getByPlaceholder(text, options)`
Locates input elements inside the frame by placeholder text.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `FrameLocator.getByRole(role, options)`
Locates elements inside the frame by ARIA role, name, and related attributes.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `FrameLocator.getByTestId(testId)`
Locates elements inside the frame by test id.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `FrameLocator.getByText(text, options)`
Locates elements inside the frame by text content.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `FrameLocator.getByTitle(text, options)`
Locates elements inside the frame by title attribute.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `FrameLocator.last()`
Returns a frame locator for the last matching frame.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)
**Deprecated:** use `locator.last().contentFrame()` instead.

### `FrameLocator.locator(selectorOrLocator, options)`
Creates a locator for an element inside the frame.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

### `FrameLocator.nth(index)`
Returns a frame locator for the n-th matching frame.
**Returns:** `FrameLocator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)
**Deprecated:** use `locator.nth(index).contentFrame()` instead.

### `FrameLocator.owner()`
Returns a locator pointing to the same `iframe` element as this frame locator.
**Returns:** `Locator`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/locator.ts`)

---

## APIRequest

Creates standalone API request contexts for Web API testing.

### `APIRequest.newContext(options)`
Creates a new `APIRequestContext` instance with its own request configuration and cookie storage.
**Returns:** `Promise<APIRequestContext>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/fetch.ts`)

---

## BrowserServer

Represents a running browser server launched for later Playwright connections.

### `BrowserServer.on(event, listener)`
Adds a browser server event listener for `close`.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.once(event, listener)`
Adds a one-time browser server event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.addListener(event, listener)`
Adds a browser server event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.removeListener(event, listener)`
Removes a browser server event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.off(event, listener)`
Removes a browser server event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.prependListener(event, listener)`
Adds a browser server event listener at the beginning of the listener list.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.close()`
Closes the browser gracefully and terminates its process.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.kill()`
Kills the browser process and waits for it to exit.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.process()`
Returns the spawned browser process.
**Returns:** `ChildProcess`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.wsEndpoint()`
Returns the browser WebSocket endpoint for `browserType.connect()`.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

### `BrowserServer.[Symbol.asyncDispose]()`
Asynchronously closes the browser server when used with `await using`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/server/browser.ts`)

---

## WebSocketRoute

Intercepts and controls a routed WebSocket connection.

### `WebSocketRoute.onMessage(handler)`
Registers a handler for messages on this side of the WebSocket route.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocketRoute.onClose(handler)`
Registers a handler for WebSocket close events on this side of the route.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocketRoute.close(options)`
Closes one side of the WebSocket connection.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocketRoute.connectToServer()`
Connects the routed WebSocket to the actual server and returns the server-side route.
**Returns:** `WebSocketRoute`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocketRoute.protocols()`
Returns the subprotocols requested by the page.
**Returns:** `Array<string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocketRoute.send(message)`
Sends a message to the page or the server, depending on which side this route represents.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocketRoute.url()`
Returns the WebSocket URL created in the page.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `WebSocketRoute.[Symbol.asyncDispose]()`
Asynchronously closes the WebSocket route when used with `await using`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

---

## WebError

Represents an unhandled exception thrown in a page.

### `WebError.error()`
Returns the unhandled error that was thrown.
**Returns:** `Error`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/webError.ts`)

### `WebError.location()`
Returns the source location of the unhandled error.
**Returns:** `{ url: string, line: number, column: number }`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/webError.ts`)

### `WebError.page()`
Returns the page that produced the unhandled exception, if any.
**Returns:** `null | Page`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/webError.ts`)

---

## Screencast

Captures screencast output and manages recording overlays and annotations.

### `Screencast.start(options)`
Starts the screencast and optionally records video or delivers frames to a callback.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/screencast.ts`)

### `Screencast.hideActions()`
Removes action decorations from the screencast.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/screencast.ts`)

### `Screencast.hideOverlays()`
Hides overlays without removing them.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/screencast.ts`)

### `Screencast.showActions(options)`
Enables visual annotations on interacted elements and returns a disposable that disables them.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/screencast.ts`)

### `Screencast.showChapter(title, options)`
Shows a chapter overlay with a title and optional description.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/screencast.ts`)

### `Screencast.showOverlay(html, options)`
Adds an overlay with the given HTML content and returns a disposable that removes it.
**Returns:** `Promise<Disposable>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/screencast.ts`)

### `Screencast.showOverlays()`
Shows previously hidden overlays.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/screencast.ts`)

### `Screencast.stop()`
Stops the screencast and saves the video if recording was active.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/screencast.ts`)

---

## Debugger

Controls Playwright debugger pause, resume, and stepping behavior.

### `Debugger.on(event, listener)`
Adds a debugger event listener for `pausedstatechanged`.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.once(event, listener)`
Adds a one-time debugger event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.addListener(event, listener)`
Adds a debugger event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.removeListener(event, listener)`
Removes a debugger event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.off(event, listener)`
Removes a debugger event listener.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.prependListener(event, listener)`
Adds a debugger event listener at the beginning of the listener list.
**Returns:** `this`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.next()`
Resumes execution and pauses again before the next action.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.pausedDetails()`
Returns details about the current paused call, or `null` if the debugger is not paused.
**Returns:** `null | { location: { file: string, line?: number, column?: number }, title: string }`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.requestPause()`
Configures the debugger to pause before the next action is executed.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.resume()`
Resumes script execution.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

### `Debugger.runTo(location)`
Resumes execution and pauses when an action originates from the specified source location.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/debugger.ts`)

---

### Batch audit summary

| Class | Declared members | Overload declarations |
| --- | ---: | ---: |
| FrameLocator | 13 | 13 |
| APIRequest | 1 | 1 |
| BrowserServer | 11 | 11 |
| WebSocketRoute | 8 | 8 |
| WebError | 3 | 3 |
| Screencast | 8 | 8 |
| Debugger | 11 | 11 |

Verified against source commit `b4a646a624c0b1e8e352d320cbc6684581625ff6`.

---

## ConnectOverCDPTransport

Defines a custom transport used when connecting over Chrome DevTools Protocol.

### `ConnectOverCDPTransport.open()`
Optionally opens and initializes the transport.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOverCDPTransport.send(message)`
Sends a protocol message through the transport.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOverCDPTransport.close()`
Closes the transport.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOverCDPTransport.onmessage`
Callback invoked when a protocol message is received.
**Returns:** `((message: object) => void) | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOverCDPTransport.onclose`
Callback invoked when the transport closes.
**Returns:** `((reason?: string) => void) | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

---

## Credentials

Manages virtual WebAuthn credentials scoped to a browser context.

### `Credentials.create(rpId, options)`
Seeds a virtual WebAuthn credential and returns it.
**Returns:** `Promise<{ id: string, rpId: string, userHandle: string, privateKey: string, publicKey: string }>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/credentials.ts`)

### `Credentials.delete(id)`
Removes a credential from the authenticator by credential id.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/credentials.ts`)

### `Credentials.get(options)`
Returns the credentials currently held by the authenticator, optionally filtered.
**Returns:** `Promise<Array<{ id: string, rpId: string, userHandle: string, privateKey: string, publicKey: string }>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/credentials.ts`)

### `Credentials.install()`
Installs the virtual WebAuthn authenticator into the context.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/credentials.ts`)

---

## Disposable

Represents a reversible resource that can be removed or undone later.

### `Disposable.dispose()`
Removes the associated resource.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/disposable.ts`)

### `Disposable.[Symbol.asyncDispose]()`
Asynchronously disposes the resource when used with `await using`.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/disposable.ts`)

---

## Logger

Defines a pluggable sink for Playwright log output.

### `Logger.isEnabled(name, severity)`
Determines whether the sink is interested in a logger name and severity.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Logger.log(name, severity, message, args, hints)`
Receives a log entry with message arguments and optional formatting hints.
**Returns:** `void`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## WebStorage

Exposes the page's `localStorage` or `sessionStorage` through an async API.

### `WebStorage.clear()`
Removes all items from the storage.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/webStorage.ts`)

### `WebStorage.getItem(name)`
Returns the value for the given item name if present.
**Returns:** `Promise<null | string>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/webStorage.ts`)

### `WebStorage.items()`
Returns all items in storage as name/value pairs.
**Returns:** `Promise<Array<{ name: string, value: string }>>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/webStorage.ts`)

### `WebStorage.removeItem(name)`
Removes the item with the given name.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/webStorage.ts`)

### `WebStorage.setItem(name, value)`
Sets the value for the given item name.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/webStorage.ts`)

---

## LaunchOptions

Option schema for `browserType.launch()`.

### `LaunchOptions.args`
Additional browser command-line arguments.
**Returns:** `Array<string> | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.artifactsDir`
Directory where artifacts such as traces and downloads are stored.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.channel`
Browser distribution channel to launch.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.chromiumSandbox`
Whether Chromium sandboxing is enabled.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.downloadsPath`
Directory where accepted downloads are saved.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.env`
Environment variables visible to the browser process.
**Returns:** `{ [key: string]: string | undefined } | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.executablePath`
Path to a custom browser executable.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.firefoxUserPrefs`
Custom Firefox user preferences.
**Returns:** `{ [key: string]: string | number | boolean } | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.handleSIGHUP`
Whether the browser closes on `SIGHUP`.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.handleSIGINT`
Whether the browser closes on `SIGINT`.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.handleSIGTERM`
Whether the browser closes on `SIGTERM`.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.headless`
Whether the browser runs in headless mode.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.ignoreDefaultArgs`
Whether to ignore Playwright's default launch arguments, or which ones to filter out.
**Returns:** `boolean | Array<string> | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.logger`
Logger sink for Playwright logging.
**Returns:** `Logger | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)
**Deprecated:** the logs received by the logger are incomplete; use tracing instead.

### `LaunchOptions.proxy`
Network proxy settings for the browser instance.
**Returns:** `{ server: string, bypass?: string, username?: string, password?: string } | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.slowMo`
Artificial delay applied to Playwright operations.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.timeout`
Maximum time to wait for browser launch.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `LaunchOptions.tracesDir`
Directory where traces are saved.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

---

## ConnectOverCDPOptions

Option schema for `browserType.connectOverCDP()`.

### `ConnectOverCDPOptions.artifactsDir`
Directory where browser artifacts are saved.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOverCDPOptions.endpointURL`
Deprecated endpoint URL field; use the first argument instead.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)
**Deprecated:** use the first argument instead.

### `ConnectOverCDPOptions.headers`
Additional HTTP headers sent with the connect request.
**Returns:** `{ [key: string]: string } | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOverCDPOptions.isLocal`
Whether Playwright and the CDP server run on the same host.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOverCDPOptions.noDefaults`
Whether Playwright skips applying its default overrides to the existing default context.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOverCDPOptions.slowMo`
Artificial delay applied to Playwright operations.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOverCDPOptions.timeout`
Maximum time to wait for the connection to be established.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

---

## ConnectOptions

Option schema for `browserType.connect()`.

### `ConnectOptions.exposeNetwork`
Rules describing which client-side network resources are exposed to the browser.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOptions.headers`
Additional HTTP headers sent with the WebSocket connect request.
**Returns:** `{ [key: string]: string } | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOptions.slowMo`
Artificial delay applied to Playwright operations.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

### `ConnectOptions.timeout`
Maximum time to wait for the connection to be established.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserType.ts`)

---

## LocatorScreenshotOptions

Option schema for `locator.screenshot()`.

### `LocatorScreenshotOptions.animations`
How CSS animations and transitions are handled during screenshot capture.
**Returns:** `"disabled" | "allow" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.caret`
How the text caret is handled during screenshot capture.
**Returns:** `"hide" | "initial" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.mask`
Locators to mask in the screenshot.
**Returns:** `Array<Locator> | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.maskColor`
Mask overlay color.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.omitBackground`
Whether to hide the default white background.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.path`
Path where the screenshot image is written.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.quality`
Image quality for lossy formats.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.scale`
Pixel scaling mode for the screenshot.
**Returns:** `"css" | "device" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.signal`
Abort signal for canceling screenshot capture.
**Returns:** `AbortSignal | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.style`
Stylesheet text applied while taking the screenshot.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.timeout`
Maximum time to wait for screenshot capture.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `LocatorScreenshotOptions.type`
Screenshot image format.
**Returns:** `"png" | "jpeg" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## BrowserContextOptions

Option schema for `browser.newContext()` and related APIs.

### `BrowserContextOptions.acceptDownloads`
Whether downloads are automatically accepted.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.baseURL`
Base URL used to resolve relative URLs.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.bypassCSP`
Whether Content Security Policy is bypassed.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.clientCertificates`
Client certificates used for mutual TLS authentication.
**Returns:** `Array<object> | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.colorScheme`
Emulated `prefers-color-scheme` value.
**Returns:** `null | "light" | "dark" | "no-preference" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.contrast`
Emulated `prefers-contrast` value.
**Returns:** `null | "no-preference" | "more" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.deviceScaleFactor`
Emulated device scale factor.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.extraHTTPHeaders`
Additional headers sent with every request.
**Returns:** `{ [key: string]: string } | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.forcedColors`
Emulated `forced-colors` value.
**Returns:** `null | "active" | "none" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.geolocation`
Emulated geolocation coordinates.
**Returns:** `Geolocation | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.hasTouch`
Whether the viewport supports touch events.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.httpCredentials`
HTTP authentication credentials.
**Returns:** `HTTPCredentials | Array<HTTPCredentials> | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.ignoreHTTPSErrors`
Whether HTTPS errors are ignored.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.isMobile`
Whether mobile emulation is enabled.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.javaScriptEnabled`
Whether JavaScript execution is enabled.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.locale`
Emulated user locale.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.logger`
Logger sink for context logging.
**Returns:** `Logger | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.offline`
Whether network offline mode is enabled.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.permissions`
Permissions granted to all pages in the context.
**Returns:** `Array<string> | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.pierceFrames`
Whether selectors pierce frames by default.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.proxy`
Network proxy settings for the context.
**Returns:** `{ server: string, bypass?: string, username?: string, password?: string } | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.recordHar`
HAR recording configuration.
**Returns:** `object | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.recordVideo`
Video recording configuration.
**Returns:** `object | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.reducedMotion`
Emulated `prefers-reduced-motion` value.
**Returns:** `null | "reduce" | "no-preference" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.screen`
Emulated screen size.
**Returns:** `{ width: number, height: number } | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.serviceWorkers`
Service worker policy for the context.
**Returns:** `"allow" | "block" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.storageState`
Initial storage state for cookies and local storage.
**Returns:** `string | object | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.strictSelectors`
Whether strict selector mode is enabled.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.timezoneId`
Emulated timezone identifier.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.userAgent`
Custom user agent string.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

### `BrowserContextOptions.viewport`
Emulated viewport size, or `null` to disable viewport emulation.
**Returns:** `null | ViewportSize | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/browserContext.ts`)

---

## ViewportSize

Represents viewport dimensions in CSS pixels.

### `ViewportSize.width`
Viewport width in pixels.
**Returns:** `number`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `ViewportSize.height`
Viewport height in pixels.
**Returns:** `number`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## HTTPCredentials

Represents HTTP authentication credentials and send policy.

### `HTTPCredentials.username`
Authentication username.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `HTTPCredentials.password`
Authentication password.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `HTTPCredentials.origin`
Optional origin restriction for sending credentials.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `HTTPCredentials.send`
Whether credentials are sent only after challenge or always.
**Returns:** `"unauthorized" | "always" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## Geolocation

Represents latitude, longitude, and optional accuracy for emulation.

### `Geolocation.latitude`
Latitude between -90 and 90.
**Returns:** `number`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Geolocation.longitude`
Longitude between -180 and 180.
**Returns:** `number`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Geolocation.accuracy`
Optional non-negative accuracy value.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## Cookie

Represents a browser cookie in storage state and cookie APIs.

### `Cookie.name`
Cookie name.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Cookie.value`
Cookie value.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Cookie.domain`
Cookie domain.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Cookie.path`
Cookie path.
**Returns:** `string`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Cookie.expires`
Cookie expiration time as Unix seconds.
**Returns:** `number`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Cookie.httpOnly`
Whether the cookie is HTTP-only.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Cookie.secure`
Whether the cookie requires a secure connection.
**Returns:** `boolean`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Cookie.sameSite`
SameSite policy.
**Returns:** `"Strict" | "Lax" | "None"`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `Cookie.partitionKey`
Optional partition key for partitioned cookie storage.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## PageScreenshotOptions

Option schema for `page.screenshot()`.

### `PageScreenshotOptions.animations`
How CSS animations and transitions are handled during screenshot capture.
**Returns:** `"disabled" | "allow" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.caret`
How the text caret is handled during screenshot capture.
**Returns:** `"hide" | "initial" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.clip`
Rectangular clip area for the screenshot.
**Returns:** `{ x: number, y: number, width: number, height: number } | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.fullPage`
Whether to capture the full scrollable page.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.mask`
Locators to mask in the screenshot.
**Returns:** `Array<Locator> | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.maskColor`
Mask overlay color.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.omitBackground`
Whether to hide the default white background.
**Returns:** `boolean | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.path`
Path where the screenshot image is written.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.quality`
Image quality for lossy formats.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.scale`
Pixel scaling mode for the screenshot.
**Returns:** `"css" | "device" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.signal`
Abort signal for canceling screenshot capture.
**Returns:** `AbortSignal | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.style`
Stylesheet text applied while taking the screenshot.
**Returns:** `string | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.timeout`
Maximum time to wait for screenshot capture.
**Returns:** `number | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

### `PageScreenshotOptions.type`
Screenshot image format.
**Returns:** `"png" | "jpeg" | "webp" | undefined`
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## ChromiumBrowserContext

Type wrapper extending `BrowserContext` without adding new members.
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## ChromiumBrowser

Type wrapper extending `Browser` without adding new members.
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## FirefoxBrowser

Type wrapper extending `Browser` without adding new members.
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## WebKitBrowser

Type wrapper extending `Browser` without adding new members.
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

## ChromiumCoverage

Type wrapper extending `Coverage` without adding new members.
**Source:** `packages/playwright-core/types/types.d.ts` (documented from the public type schema only)

---

### Batch audit summary

| Class | Declared members | Overload declarations |
| --- | ---: | ---: |
| ConnectOverCDPTransport | 5 | 5 |
| Credentials | 4 | 4 |
| Disposable | 2 | 2 |
| Logger | 2 | 2 |
| WebStorage | 5 | 5 |
| LaunchOptions | 18 | 18 |
| ConnectOverCDPOptions | 7 | 7 |
| ConnectOptions | 4 | 4 |
| LocatorScreenshotOptions | 12 | 12 |
| BrowserContextOptions | 31 | 31 |
| ViewportSize | 2 | 2 |
| HTTPCredentials | 4 | 4 |
| Geolocation | 3 | 3 |
| Cookie | 9 | 9 |
| PageScreenshotOptions | 14 | 14 |
| ChromiumBrowserContext | 0 | 0 |
| ChromiumBrowser | 0 | 0 |
| FirefoxBrowser | 0 | 0 |
| WebKitBrowser | 0 | 0 |
| ChromiumCoverage | 0 | 0 |

Verified against source commit `b4a646a624c0b1e8e352d320cbc6684581625ff6`.
