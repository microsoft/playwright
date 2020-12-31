# Navigations

Playwright can navigate to URLs and handle navigations caused by page interactions. This guide covers common scenarios to wait for page navigations and loading to complete.

<!-- GEN:toc-top-level -->
<!-- GEN:stop -->

## Navigation lifecycle
Playwright splits the process of showing a new document in a page into **navigation** and **loading**.

**Navigations** can be initiated by changing the page URL or by interacting with the page (e.g., clicking a link). Navigation ends when response headers have been parsed and session history is updated. The navigation intent may be canceled, for example, on hitting an unresolved DNS address or transformed into a file download. Only after the navigation succeeds, page starts **loading** the document.

**Loading** covers getting the remaining response body over the network, parsing, executing the scripts and firing load events:

- [`method: Page.url`] is set to the new url
- document content is loaded over network and parsed
- [`event: Page.domcontentloaded`] event is fired
- page executes some scripts and loads resources like stylesheets and images
- [`event: Page.load`] event is fired
- page executes dynamically loaded scripts
- `networkidle` is fired when no new network requests are made for 500 ms

## Scenarios initiated by browser UI
Navigations can be initiated by changing the URL bar, reloading the page or going back or forward in session history.

### Auto-wait
Navigating to a URL auto-waits for the page to fire the `load` event. If the page does a client-side redirect before `load`, `page.goto` will auto-wait for the redirected page to fire the `load` event.

```js
// Navigate the page
await page.goto('https://example.com');
```

### Custom wait
Override the default behavior to wait until a specific event, like `networkidle`.

```js
// Navigate and wait until network is idle
await page.goto('https://example.com', { waitUntil: 'networkidle' });
```

### Wait for element
In lazy-loaded pages, it can be useful to wait until an element is visible with [`method: Page.waitForSelector`]. Alternatively, page interactions like [`method: Page.click`] auto-wait for elements.

```js
// Navigate and wait for element
await page.goto('https://example.com');
await page.waitForSelector('text=Example Domain');

// Navigate and click element
// Click will auto-wait for the element
await page.goto('https://example.com');
await page.click('text=Example Domain');
```

#### API reference
- [`method: Page.goto`]
- [`method: Page.reload`]
- [`method: Page.goBack`]
- [`method: Page.goForward`]

## Scenarios initiated by page interaction
In the scenarios below, `page.click` initiates a navigation and then waits for the navigation to complete.

### Auto-wait
By default, `page.click` will wait for the navigation step to complete. This can be combined with a page interaction on the navigated page which would auto-wait for an element.

```js
// Click will auto-wait for navigation to complete
await page.click('text=Login');
// Fill will auto-wait for element on navigated page
await page.fill('#username', 'John Doe');
```

### Custom wait
`page.click` can be combined with [`method: Page.waitForLoadState`] to wait for a loading event.

```js
await page.click('button'); // Click triggers navigation
await page.waitForLoadState('networkidle'); // This resolves after 'networkidle'
```

### Wait for element
In lazy-loaded pages, it can be useful to wait until an element is visible with [`method: Page.waitForSelector`]. Alternatively, page interactions like [`method: Page.click`] auto-wait for elements.

```js
// Click triggers navigation
await page.click('text=Login');
 // Click will auto-wait for the element
await page.waitForSelector('#username', 'John Doe');

// Click triggers navigation
await page.click('text=Login');
 // Fill will auto-wait for element
await page.fill('#username', 'John Doe');
```

### Asynchronous navigation
Clicking an element could trigger asychronous processing before initiating the navigation. In these cases, it is recommended to explicitly call [`method: Page.waitForNavigation`]. For example:
* Navigation is triggered from a `setTimeout`
* Page waits for network requests before navigation

```js
await Promise.all([
  page.click('a'), // Triggers a navigation after a timeout
  page.waitForNavigation(), // Waits for the next navigation
]);
```

The `Promise.all` pattern prevents a race condition between `page.click` and `page.waitForNavigation` when navigation happens quickly.

### Multiple navigations
Clicking an element could trigger multiple navigations. In these cases, it is recommended to explicitly [`method: Page.waitForNavigation`] to a specific url. For example:
* Client-side redirects issued after the `load` event
* Multiple pushes to history state

```js
await Promise.all([
  page.waitForNavigation({ url: '**/login' }),
  page.click('a'), // Triggers a navigation with a script redirect
]);
```

The `Promise.all` pattern prevents a race condition between `page.click` and `page.waitForNavigation` when navigation happens quickly.

### Loading a popup
When popup is opened, explicitly calling [`method: Page.waitForLoadState`] ensures that popup is loaded to the desired state.

```js
const [ popup ] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('a[target="_blank"]'),  // Opens popup
]);
await popup.waitForLoadState('load');
```

#### API reference
- [`method: Page.click`]
- [`method: Page.waitForLoadState`]
- [`method: Page.waitForSelector`]
- [`method: Page.waitForNavigation`]
- [`method: Page.waitForFunction`]

## Advanced patterns
For pages that have complicated loading patterns, [`method: Page.waitForFunction`] is a powerful and extensible approach to define a custom wait criteria.

```js
await page.goto('http://example.com');
await page.waitForFunction(() => window.amILoadedYet());
// Ready to take a screenshot, according to the page itself.
await page.screenshot();
```

#### API reference
- [`method: Page.waitForFunction`]
