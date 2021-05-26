---
id: navigations
title: "Navigations"
---

Playwright can navigate to URLs and handle navigations caused by page interactions. This guide covers common scenarios
to wait for page navigations and loading to complete.

<!-- TOC -->

## Navigation lifecycle

Playwright splits the process of showing a new document in a page into **navigation** and **loading**.

**Navigations** can be initiated by changing the page URL or by interacting with the page (e.g., clicking a link).
Navigation ends when response headers have been parsed and session history is updated. The navigation intent may be
canceled, for example, on hitting an unresolved DNS address or transformed into a file download. Only after the
navigation succeeds, page starts **loading** the document.

**Loading** covers getting the remaining response body over the network, parsing, executing the scripts and firing load
events:
- [`method: Page.url`] is set to the new url
- document content is loaded over network and parsed
- [`event: Page.DOMContentLoaded`] event is fired
- page executes some scripts and loads resources like stylesheets and images
- [`event: Page.load`] event is fired
- page executes dynamically loaded scripts
- `networkidle` is fired when no new network requests are made for 500 ms

## Scenarios initiated by browser UI

Navigations can be initiated by changing the URL bar, reloading the page or going back or forward in session history.

### Auto-wait

Navigating to a URL auto-waits for the page to fire the `load` event. If the page does a client-side redirect before
`load`, `page.goto` will auto-wait for the redirected page to fire the `load` event.

```js
// Navigate the page
await page.goto('https://example.com');
```

```java
// Navigate the page
page.navigate("https://example.com");
```

```python async
# Navigate the page
await page.goto("https://example.com")
```

```python sync
# Navigate the page
page.goto("https://example.com")
```

```csharp
// Navigate the page
await page.GotoAsync("https://example.com");
```


### Custom wait

Override the default behavior to wait until a specific event, like `networkidle`.

```js
// Navigate and wait until network is idle
await page.goto('https://example.com', { waitUntil: 'networkidle' });
```

```java
// Navigate and wait until network is idle
page.navigate("https://example.com", new Page.NavigateOptions()
  .setWaitUntil(WaitUntilState.NETWORKIDLE));
```

```python async
# Navigate and wait until network is idle
await page.goto("https://example.com", wait_until="networkidle")
```

```python sync
# Navigate and wait until network is idle
page.goto("https://example.com", wait_until="networkidle")
```

```csharp
// Navigate and wait until network is idle
await page.GotoAsync("https://example.com", new PageGotoOptions { WaitUntil = WaitUntilState.NetworkIdle });
```

### Wait for element

In lazy-loaded pages, it can be useful to wait until an element is visible with [`method: Page.waitForSelector`].
Alternatively, page interactions like [`method: Page.click`] auto-wait for elements.

```js
// Navigate and wait for element
await page.goto('https://example.com');
await page.waitForSelector('text=Example Domain');

// Navigate and click element
// Click will auto-wait for the element
await page.goto('https://example.com');
await page.click('text=Example Domain');
```

```java
// Navigate and wait for element
page.navigate("https://example.com");
page.waitForSelector("text=Example Domain");

// Navigate and click element
// Click will auto-wait for the element
page.navigate("https://example.com");
page.click("text=Example Domain");
```

```python async
# Navigate and wait for element
await page.goto("https://example.com")
await page.wait_for_selector("text=example domain")

# Navigate and click element
# Click will auto-wait for the element
await page.goto("https://example.com")
await page.click("text=example domain")
```

```python sync
# Navigate and wait for element
page.goto("https://example.com")
page.wait_for_selector("text=example domain")

# Navigate and click element
# Click will auto-wait for the element
page.goto("https://example.com")
page.click("text=example domain")
```

```csharp
// Navigate and wait for element
await page.GotoAsync("https://example.com");
await page.WaitForSelectorAsync("text=Example Domain");

// Navigate and click element
// Click will auto-wait for the element
await page.GotoAsync("https://example.com");
await page.ClickAsync("text=Example Domain");
```

### API reference
- [`method: Page.goto`]
- [`method: Page.reload`]
- [`method: Page.goBack`]
- [`method: Page.goForward`]

## Scenarios initiated by page interaction

In the scenarios below, [`method: Page.click`] initiates a navigation and then waits for the navigation to complete.

### Auto-wait

By default, [`method: Page.click`] will wait for the navigation step to complete. This can be combined with a page interaction on
the navigated page which would auto-wait for an element.

```js
// Click will auto-wait for navigation to complete
await page.click('text=Login');

// Fill will auto-wait for element on navigated page
await page.fill('#username', 'John Doe');
```

```java
// Click will auto-wait for navigation to complete
page.click("text=Login");

// Fill will auto-wait for element on navigated page
page.fill("#username", "John Doe");
```

```python async
# Click will auto-wait for navigation to complete
await page.click("text=Login")

# Fill will auto-wait for element on navigated page
await page.fill("#username", "John Doe")
```

```python sync
# Click will auto-wait for navigation to complete
page.click("text=Login")

# Fill will auto-wait for element on navigated page
page.fill("#username", "John Doe")
```

```csharp
// Click will auto-wait for navigation to complete
await page.ClickAsync("text=Login");

// Fill will auto-wait for element on navigated page
await page.FillAsync("#username", "John Doe");
```

### Custom wait

`page.click` can be combined with [`method: Page.waitForLoadState`] to wait for a loading event.

```js
await page.click('button'); // Click triggers navigation
await page.waitForLoadState('networkidle'); // This resolves after 'networkidle'
```

```java
page.click("button"); // Click triggers navigation
page.waitForLoadState(LoadState.NETWORKIDLE); // This resolves after "networkidle"
```

```python async
await page.click("button"); # Click triggers navigation
await page.wait_for_load_state("networkidle"); # This waits for the "networkidle"
```

```python sync
page.click("button"); # Click triggers navigation
page.wait_for_load_state("networkidle"); # This waits for the "networkidle"
```

```csharp
await page.ClickAsync("button"); // Click triggers navigation
await page.WaitForLoadStateAsync(LoadState.NetworkIdle); // This resolves after "networkidle"
```

### Wait for element

In lazy-loaded pages, it can be useful to wait until an element is visible with [`method: Page.waitForSelector`].
Alternatively, page interactions like [`method: Page.click`] auto-wait for elements.

```js
// Click will auto-wait for the element and trigger navigation
await page.click('text=Login');
// Wait for the element
await page.waitForSelector('#username');

// Click triggers navigation
await page.click('text=Login');
// Fill will auto-wait for element
await page.fill('#username', 'John Doe');
```

```java
// Click will auto-wait for the element and trigger navigation
page.click("text=Login");
// Wait for the element
page.waitForSelector("#username");

// Click triggers navigation
page.click("text=Login");
// Fill will auto-wait for element
page.fill("#username", "John Doe");
```

```python async
# Click will auto-wait for the element and trigger navigation
await page.click("text=Login")
# Wait for the element
await page.wait_for_selector("#username")

# Click triggers navigation
await page.click("text=Login")
# Fill will auto-wait for element
await page.fill("#username", "John Doe")
```

```python sync
# Click triggers navigation
page.click("text=Login")
# Click will auto-wait for the element
page.wait_for_selector("#username", "John Doe")

# Click triggers navigation
page.click("text=Login")
# Fill will auto-wait for element
page.fill("#username", "John Doe")
```

```csharp
// Click will auto-wait for the element and trigger navigation
await page.ClickAsync("text=Login");
// Wait for the element
await page.WaitForSelectorAsync("#username");

// Click triggers navigation
await page.ClickAsync("text=Login");
// Fill will auto-wait for element
await page.FillAsync("#username", "John Doe");
```

### Asynchronous navigation

Clicking an element could trigger asynchronous processing before initiating the navigation. In these cases, it is
recommended to explicitly call [`method: Page.waitForNavigation`]. For example:
* Navigation is triggered from a `setTimeout`
* Page waits for network requests before navigation

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for a navigation.
await Promise.all([
  page.waitForNavigation(), // Waits for the next navigation
  page.click('div.delayed-navigation'), // Triggers a navigation after a timeout
]);
```

```java
// Using waitForNavigation with a callback prevents a race condition
// between clicking and waiting for a navigation.
page.waitForNavigation(() -> { // Waits for the next navigation
  page.click("div.delayed-navigation"); // Triggers a navigation after a timeout
});
```

```python async
# Waits for the next navigation. Using Python context manager
# prevents a race condition between clicking and waiting for a navigation.
async with page.expect_navigation():
    # Triggers a navigation after a timeout
    await page.click("div.delayed-navigation")
```

```python sync
# Waits for the next navigation. Using Python context manager
# prevents a race condition between clicking and waiting for a navigation.
with page.expect_navigation():
    # Triggers a navigation after a timeout
    page.click("a")
```

```csharp
// Using waitForNavigation with a callback prevents a race condition
// between clicking and waiting for a navigation.
await page.RunAndWaitForNavigationAsync(async () =>
{
    // Triggers a navigation after a timeout
    await page.ClickAsync("div.delayed-navigation");
});
```

### Multiple navigations

Clicking an element could trigger multiple navigations. In these cases, it is recommended to explicitly
[`method: Page.waitForNavigation`] to a specific url. For example:
* Client-side redirects issued after the `load` event
* Multiple pushes to history state

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for a navigation.
await Promise.all([
  page.waitForNavigation({ url: '**/login' }),
  page.click('a'), // Triggers a navigation with a script redirect
]);
```

```java
// Running action in the callback of waitForNavigation prevents a race
// condition between clicking and waiting for a navigation.
page.waitForNavigation(new Page.WaitForNavigationOptions().setUrl("**/login"), () -> {
  page.click("a"); // Triggers a navigation with a script redirect
});
```

```python async
# Using Python context manager prevents a race condition
# between clicking and waiting for a navigation.
async with page.expect_navigation(url="**/login"):
    # Triggers a navigation with a script redirect
    await page.click("a")
```

```python sync
# Using Python context manager prevents a race condition
# between clicking and waiting for a navigation.
with page.expect_navigation(url="**/login"):
    # Triggers a navigation with a script redirect
    page.click("a")
```

```csharp
// Running action in the callback of waitForNavigation prevents a race
// condition between clicking and waiting for a navigation.
await page.RunAndWaitForNavigationAsync(async () =>
{
    // Triggers a navigation with a script redirect.
    await page.ClickAsync("a");
}, new PageWaitForNavigationOptions
{
    UrlString = "**/login"
});
```

### Loading a popup

When popup is opened, explicitly calling [`method: Page.waitForLoadState`] ensures that popup is loaded to the desired
state.

```js
const [ popup ] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('a[target="_blank"]'),  // Opens popup
]);
await popup.waitForLoadState('load');
```

```java
Page popup = page.waitForPopup(() -> {
  page.click("a[target='_blank']"); // Opens popup
});
popup.waitForLoadState(LoadState.LOAD);
```

```python async
async with page.expect_popup() as popup_info:
    await page.click('a[target="_blank"]') # Opens popup
popup = await popup_info.value
await popup.wait_for_load_state("load")
```

```python sync
with page.expect_popup() as popup_info:
    page.click('a[target="_blank"]') # Opens popup
popup = popup_info.value
popup.wait_for_load_state("load")
```

```csharp
var popup = await page.RunAndWaitForPopupAsync(async () =>
{
    await page.ClickAsync("a[target='_blank']"); // Opens popup
});
popup.WaitForLoadStateAsync(LoadState.Load);
```

### API reference
- [`method: Page.click`]
- [`method: Page.waitForLoadState`]
- [`method: Page.waitForSelector`]
- [`method: Page.waitForNavigation`]
- [`method: Page.waitForFunction`]

## Advanced patterns

For pages that have complicated loading patterns, [`method: Page.waitForFunction`] is a powerful and extensible approach
to define a custom wait criteria.

```js
await page.goto('http://example.com');
await page.waitForFunction(() => window.amILoadedYet());
// Ready to take a screenshot, according to the page itself.
await page.screenshot();
```

```java
page.navigate("http://example.com");
page.waitForFunction("() => window.amILoadedYet()");
// Ready to take a screenshot, according to the page itself.
page.screenshot();
```

```python async
await page.goto("http://example.com")
await page.wait_for_function("() => window.amILoadedYet()")
# Ready to take a screenshot, according to the page itself.
await page.screenshot()
```

```python sync
page.goto("http://example.com")
page.wait_for_function("() => window.amILoadedYet()")
# Ready to take a screenshot, according to the page itself.
page.screenshot()
```

```csharp
await page.GotoAsync("http://example.com");
await page.WaitForFunctionAsync("() => window.amILoadedYet()");
// Ready to take a screenshot, according to the page itself.
await page.ScreenshotAsync();
```

### API reference
- [`method: Page.waitForFunction`]