# Navigation and loading

Playwright logically splits the process of showing a new document in the page into **navigation** and **loading**.

### Navigation

Page navigation can be either initiated by the Playwright call:

```js
// Load a page
await page.goto('https://example.com');

// Reload a page
await page.reload();

// Click a link
await page.click('text="Continue"');
```

or by the page itself:

```js
// Programmatic navigation
window.location.href = 'https://example.com';

// Single page app navigation
history.pushState({}, 'title', '#deep-link');
```

Navigation intent may result in being canceled, for example transformed into a download or hitting an unresolved DNS address. Only when the navigation succeeds, page starts **loading** the document.

### Loading

Page load takes time retrieving the response body over the network, parsing, executing the scripts and firing the events. Typical load scenario goes through the following load states:
- [`page.url()`](api.md#pageurl) is set to the new url
- document content is loaded over network and parsed
- [`domcontentloaded`](api.md#event-domcontentloaded) event is fired
- page executes some scripts and loads resources like stylesheets and images
- [`load`](api.md#event-load) event is fired
- page executes dynamically loaded scripts
- `networkidle` is fired - no new network requests made for at least `500` ms

### Common scenarios

By default, Playwright handles navigations seamlessly so that you did not need to think about them. Consider the following scenario, where everything is handled by Playwright behind the scenes:

```js
await page.goto('http://example.com');
// If the page does a client-side redirect to 'http://example.com/login'.
// Playwright will automatically wait for the login page to load.

// Playwright waits for the lazy loaded #username and #password inputs
// to appear before filling the values.
await page.fill('#username', 'John Doe');
await page.fill('#password', '********');

// Playwright waits for the login button to become enabled and clicks it.
await page.click('text=Login');
// Clicking the button navigates to the logged-in page and Playwright
// automatically waits for that.
```

Explicit loading handling may be required for more complicated scenarios though.

### Loading a popup

When popup is opened, explicitly calling [`page.waitForLoadState()`](api.md#pagewaitforloadstatestate-options) ensures that popup is loaded to the desired state.
```js
const [ popup ] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('a[target="_blank"]'),  // <-- opens popup
]);
await popup.waitForLoadState('load');
await popup.evaluate(() => window.globalVariableInitializedByOnLoadHandler);
```

### Unusual client-side redirects

Usually, the client-side redirect happens before the `load` event, and `page.goto()` method automatically waits for the redirect. However, when redirecting from a link click or after the `load` event, it would be easier to explicitly [`waitForNavigation()`](api.md#pagewaitfornavigationoptions) to a specific url.
```js
await Promise.all([
  page.waitForNavigation({ url: '**/login' }),
  page.click('a'), // Triggers a navigation with a script redirect.
]);
```

Notice the `Promise.all` to click and wait for navigation. Awaiting these methods one after the other is racy, because navigation could happen too fast.

### Click triggers navigation after a timeout

When `onclick` handler triggers a navigation from a `setTimeout`, use an explicit [`waitForNavigation()`](api.md#pagewaitfornavigationoptions) call as a last resort.
```js
await Promise.all([
  page.waitForNavigation(), // Waits for the next navigation.
  page.click('a'), // Triggers a navigation after a timeout.
]);
```

Notice the `Promise.all` to click and wait for navigation. Awaiting these methods one after the other is racy, because navigation could happen too fast.

### Unpredictable patterns

When the page has a complex loading pattern, the custom waiting function is most reliable.
```js
await page.goto('http://example.com');
await page.waitForFunction(() => window.amILoadedYet());
// Ready to take a screenshot, according to the page itself.
await page.screenshot();
```

When clicking on a button triggers some asynchronous processing, issues a couple GET requests and pushes a new history state multiple times, explicit [`waitForNavigation()`](api.md#pagewaitfornavigationoptions) to a specific url is the most reliable option.
```js
await Promise.all([
  page.waitForNavigation({ url: '**/invoice#processed' }),
  page.click('text=Process the invoice'), // Triggers some complex handling.
]);
```

### Lazy loading, hydration

TBD
