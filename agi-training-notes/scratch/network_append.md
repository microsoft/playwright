
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
**Returns:** `Frame[]`
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
**@deprecated** (Use `locator.fill()` instead). Types into an input element within the frame.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.evaluate(pageFunction, arg)`
Executes JavaScript inside the frame.
**Returns:** `Promise<any>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.evaluateHandle(pageFunction, arg)`
Executes JavaScript inside the frame and returns a JSHandle to the result.
**Returns:** `Promise<JSHandle>`
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
**Returns:** `Promise<JSHandle>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.waitForLoadState(state, options)`
Waits for the frame to reach a specific load state.
**Returns:** `Promise<void>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.waitForNavigation(options)`
**@deprecated** (Use `waitForURL` instead). Waits for the frame to navigate.
**Returns:** `Promise<Response | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.waitForSelector(selector, options)`
Waits for a selector to appear or disappear inside the frame.
**Returns:** `Promise<ElementHandle | null>`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/frame.ts`)

### `Frame.waitForTimeout(timeout)`
**@deprecated** (Use `page.waitForTimeout` for debugging only). Waits for a timeout.
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
Returns the parsed JSON of the request's post body, if any.
**Returns:** `Object | null`
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

### `Request.frame()`
Returns the `Frame` that initiated this request.
**Returns:** `Frame`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.serviceWorker()`
Returns the service worker that initiated this request, if any.
**Returns:** `Worker | null`
**Source:** `packages/playwright-core/types/types.d.ts` (verified in `src/client/network.ts`)

### `Request.isNavigationRequest()`
Returns `true` if the request is a main document navigation request.
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
**Returns:** `ResourceTiming`
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
Returns a promise that resolves when the response body finishes downloading.
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
**Returns:** `Promise<object>`
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
