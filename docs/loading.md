# Navigation and loading

Playwright logically splits the process of showing a new document in the page into **navigation** and **loading**.

**Navigation** starts with an intent, for example:
- loading a url with [`page.goto('http://example.com')`](api.md#pagegotourl-options);
- clicking a link with [`page.click('text="Continue"')`](api.md#pageclickselector-options);
- reloading with [`page.reload()`](api.md#pagereloadoptions);
- assiging to [location](https://developer.mozilla.org/en-US/docs/Web/API/Location) in the script like `location.href = 'http://example.com'`;
- using [history api](https://developer.mozilla.org/en-US/docs/Web/API/History) in the script like `history.pushState({}, 'title', '#deep-link')`.

This navigation intent may result in a navigation or get canceled, for example transformed into a download. When navigation succeeds, page starts **loading** the document.

**Loading** usually takes time, retrieving the response over the network, parsing, executing scripts and firing events. The typical loading scenario is:
- [`page.url()`](api.md#pageurl) is set to the loading url;
- document content is loaded over network and parsed;
- [`domcontentloaded`](api.md#event-domcontentloaded) event is fired;
- page executes some scripts and loads resources like stylesheets and images;
- `networkidle2` is triggered (no more than two network connections for at least `500` ms),
- [`load`](api.md#event-load) event is fired;
- page executes some more scripts;
- `networkidle0` is triggered (no network connections for at least `500` ms).

### Common scenarios

Playwright tries its best to handle **navigations** seamlessly, so that script does not have to worry about it:
- `page.goto()` waits for the navigation to happen;
- `page.click('a')` waits for synchronously triggered navigation to happen;
- history api calls are treated as navigations to make automating single-page applications easy.

Playwright reasonably handles **loading** by default - it waits for the `load` event in explicit navigations like `page.goto()`; and for the `domcontentloaded` event in the implicit navigations triggered by clicks, evaluations and popups.

In the typical scenario where navigation is followed by performing some action, the action will wait for the target element to appear. There is no need to explicitly wait for loading to finish.

Consider the following scenario, where everything is handled by Playwright behind the scenes:

```js
// The page does a client-side redirect to 'http://example.com/login'.
// Playwright automatically waits for the login page to load.
await page.goto('http://example.com');

// Playwright waits for the lazy loaded #username and #password inputs
// to appear before filling the values.
await page.fill('#username', 'John Doe');
await page.fill('#password', '********');

// Playwright waits for the login button to become enabled and clicks it.
// Clicking the button navigates to the logged-in page and Playwright
// automatically waits for that.
await page.click('text=Login');
```

However, depending on the page, an explicit loading handling may be required.

### Lazy loading, for example client side hydration

When the page loads essential content lazily (e.g. from the `onload`), loading stages like `networkidle0` or `networkidle2` can help.
```js
await page.goto('http://example.com', { waitUntil: 'networkidle0' });
// Hydration is done, all the lazy resources have been loaded, ready to take a screenshot.
await page.screenshot();
```

### Loading a popup

When popup is opened, explicitly calling [`page.waitForLoadState()`](#pagewaitforloadstatestate-options) ensures that popup is ready for evaluation.
```js
const {popup} = await page.click('a[target="_blank"]');  // Opens a popup.
await popup.waitForLoadState('load');
await popup.evaluate(() => window.globalVariableInitializedByOnLoadHandler);
```

### Unusual client-side redirects

Usually, the client-side redirect happens before the `load` event, and `page.goto()` method automatically waits for the redirect. However, when redirecting from a link click or after the `load` event, it would be easier to explicitly [`waitForNavigation()`](#pagewaitfornavigationoptions) to a specific url.
```js
await Promise.all([
  page.click('a'), // Triggers a navigation with a script redirect.
  page.waitForNavigation({ url: '**/login' }),
]);
```
Note the `Promise.all` to click and wait for navigation at the same time. Awaiting these methods one after the other is racy, because navigation could happen too fast.

### Click triggers navigation after a timeout

When `onclick` handler triggers a navigation from a `setTimeout`, use an explicit [`waitForNavigation()`](#pagewaitfornavigationoptions) call as a last resort.
```js
await Promise.all([
  page.click('a'), // Triggers a navigation after a timeout.
  page.waitForNavigation(), // Waits for the next navigation.
]);
```
Note the `Promise.all` to click and wait for navigation at the same time. Awaiting these methods one after the other is racy, because navigation could happen too fast.

### Unpredictable patterns

When the page has a complex loading pattern, the custom waiting function is most reliable.
```js
await page.goto('http://example.com');
await page.waitForFunction(() => window.amILoadedYet());
// Ready to take a screenshot, according to the page itself.
await page.screenshot();
```

When clicking on a button triggers some asynchronous processing, issues a couple GET requests and pushes a new history state multiple times, explicit [`waitForNavigation()`](#pagewaitfornavigationoptions) to a specific url is the most reliable option.
```js
await Promise.all([
  page.click('text=Process the invoice'), // Triggers some complex handling.
  page.waitForNavigation({ url: '**/invoice#processed' }),
]);
```
