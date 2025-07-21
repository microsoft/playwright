---
id: release-notes
title: "Release notes"
toc_max_heading_level: 2
---

## Version 1.54

### Highlights

- New cookie property `partitionKey` in [`method: BrowserContext.cookies`] and [`method: BrowserContext.addCookies`]. This property allows to save and restore partitioned cookies. See [CHIPS MDN article](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Privacy_sandbox/Partitioned_cookies) for more information. Note that browsers have different support and defaults for cookie partitioning.

- New option `--user-data-dir` in multiple commands. You can specify the same user data dir to reuse browsing state, like authentication, between sessions.
  ```bash
  mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen --user-data-dir=./user-data"
  ```

- `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args=open` command does not open the test recorder anymore. Use `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args=codegen` instead.

### Browser Versions

- Chromium 139.0.7258.5
- Mozilla Firefox 140.0.2
- WebKit 26.0

This version was also tested against the following stable channels:

- Google Chrome 140
- Microsoft Edge 140

## Version 1.53

### Trace Viewer and HTML Reporter Updates

- New Steps in Trace Viewer:
  ![New Trace Viewer Steps](https://github.com/user-attachments/assets/1963ff7d-4070-41be-a79b-4333176921a2)
- New method [`method: Locator.describe`] to describe a locator. Used for trace viewer.
  ```java
  Locator button = page.getByTestId("btn-sub").describe("Subscribe button");
  button.click();
  ```
- `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --list"` will now list all installed browsers, versions and locations.

### Browser Versions

- Chromium 138.0.7204.4
- Mozilla Firefox 139.0
- WebKit 18.5

This version was also tested against the following stable channels:

- Google Chrome 137
- Microsoft Edge 137

## Version 1.52

### Highlights

- New method [`method: LocatorAssertions.toContainClass`] to ergonomically assert individual class names on the element.

  ```java
    assertThat(page.getByRole(AriaRole.LISTITEM, new Page.GetByRoleOptions().setName("Ship v1.52"))).containsClass("done");
  ```

- [Aria Snapshots](./aria-snapshots.md) got two new properties: [`/children`](./aria-snapshots.md#strict-matching) for strict matching and `/url` for links.

  ```java
  assertThat(locator).toMatchAriaSnapshot("""
    - list
      - /children: equal
      - listitem: Feature A
      - listitem:
        - link "Feature B":
          - /url: "https://playwright.dev"
  """);
  ```

### Miscellaneous

- New option [`option: APIRequest.newContext.maxRedirects`] in [`method: APIRequest.newContext`] to control the maximum number of redirects.
- New option `ref` in [`method: Locator.ariaSnapshot`] to generate reference for each element in the snapshot which can later be used to locate the element.

### Breaking Changes

- Glob URL patterns in methods like [`method: Page.route`] do not support `?` and `[]` anymore. We recommend using regular expressions instead.
- Method [`method: Route.continue`] does not allow to override the `Cookie` header anymore. If a `Cookie` header is provided, it will be ignored, and the cookie will be loaded from the browser's cookie store. To set custom cookies, use [`method: BrowserContext.addCookies`].
- macOS 13 is now deprecated and will no longer receive WebKit updates. Please upgrade to a more recent macOS version to continue benefiting from the latest WebKit improvements.

### Browser Versions

- Chromium 136.0.7103.25
- Mozilla Firefox 137.0
- WebKit 18.4

This version was also tested against the following stable channels:

- Google Chrome 135
- Microsoft Edge 135

## Version 1.51

### Highlights

* New option [`option: BrowserContext.storageState.indexedDB`] for [`method: BrowserContext.storageState`] allows to save and restore IndexedDB contents. Useful when your application uses [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) to store authentication tokens, like Firebase Authentication.

  Here is an example following the [authentication guide](./auth.md#reusing-signed-in-state):

  ```java
  // Save storage state into the file. Make sure to include IndexedDB.
  context.storageState(new BrowserContext.StorageStateOptions()
      .setPath(Paths.get("state.json"))
      .setIndexedDB(true));

  // Create a new context with the saved storage state.
  BrowserContext context = browser.newContext(new Browser.NewContextOptions()
      .setStorageStatePath(Paths.get("state.json")));
  ```

* New option [`option: Locator.filter.visible`] for [`method: Locator.filter`] allows matching only visible elements.

  ```java
  // Ignore invisible todo items.
  Locator todoItems = page.getByTestId("todo-item")
      .filter(new Locator.FilterOptions().setVisible(true));
  // Check there are exactly 3 visible ones.
  assertThat(todoItems).hasCount(3);
  ```

* New option `setContrast` for methods [`method: Page.emulateMedia`] and [`method: Browser.newContext`] allows to emulate the `prefers-contrast` media feature.

* New option [`option: APIRequest.newContext.failOnStatusCode`] makes all fetch requests made through the [APIRequestContext] throw on response codes other than 2xx and 3xx.

### Browser Versions

* Chromium 134.0.6998.35
* Mozilla Firefox 135.0
* WebKit 18.4

This version was also tested against the following stable channels:

* Google Chrome 133
* Microsoft Edge 133


## Version 1.50

### Miscellaneous

* Added method [`method: LocatorAssertions.toHaveAccessibleErrorMessage`] to assert the Locator points to an element with a given [aria errormessage](https://w3c.github.io/aria/#aria-errormessage).

### UI updates

* New button in Codegen for picking elements to produce aria snapshots.
* Additional details (such as keys pressed) are now displayed alongside action API calls in traces.
* Display of `canvas` content in traces is error-prone. Display is now disabled by default, and can be enabled via the `Display canvas content` UI setting.
* `Call` and `Network` panels now display additional time information.

### Breaking

* [`method: LocatorAssertions.toBeEditable`] and [`method: Locator.isEditable`] now throw if the target element is not `<input>`, `<select>`, or a number of other editable elements.

### Browser Versions

* Chromium 133.0.6943.16
* Mozilla Firefox 134.0
* WebKit 18.2

This version was also tested against the following stable channels:

* Google Chrome 132
* Microsoft Edge 132

## Version 1.49

### Aria snapshots

New assertion [`method: LocatorAssertions.toMatchAriaSnapshot`] verifies page structure by comparing to an expected accessibility tree, represented as YAML.

```java
page.navigate("https://playwright.dev");
assertThat(page.locator("body")).matchesAriaSnapshot("""
  - banner:
    - heading /Playwright enables reliable/ [level=1]
    - link "Get started"
    - link "Star microsoft/playwright on GitHub"
  - main:
    - img "Browsers (Chromium, Firefox, WebKit)"
    - heading "Any browser • Any platform • One API"
""");
```

You can generate this assertion with [Test Generator](./codegen) or by calling [`method: Locator.ariaSnapshot`].

Learn more in the [aria snapshots guide](./aria-snapshots).

### Tracing groups

New method [`method: Tracing.group`] allows you to visually group actions in the trace viewer.

```java
// All actions between group and groupEnd
// will be shown in the trace viewer as a group.
page.context().tracing().group("Open Playwright.dev > API");
page.navigate("https://playwright.dev/");
page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("API")).click();
page.context().tracing().groupEnd();
```

### Breaking: `chrome` and `msedge` channels switch to new headless mode

This change affects you if you're using one of the following channels in your `playwright.config.ts`:
- `chrome`, `chrome-dev`, `chrome-beta`, or `chrome-canary`
- `msedge`, `msedge-dev`, `msedge-beta`, or `msedge-canary`

After updating to Playwright v1.49, run your test suite. If it still passes, you're good to go. If not, you will probably need to update your snapshots, and adapt some of your test code around PDF viewers and extensions. See [issue #33566](https://github.com/microsoft/playwright/issues/33566) for more details.

### Try new Chromium headless

You can opt into the new headless mode by using `'chromium'` channel. As [official Chrome documentation puts it](https://developer.chrome.com/blog/chrome-headless-shell):

> New Headless on the other hand is the real Chrome browser, and is thus more authentic, reliable, and offers more features. This makes it more suitable for high-accuracy end-to-end web app testing or browser extension testing.

See [issue #33566](https://github.com/microsoft/playwright/issues/33566) for the list of possible breakages you could encounter and more details on Chromium headless. Please file an issue if you see any problems after opting in.

```java
Browser browser = playwright.chromium().launch(new BrowserType.LaunchOptions().setChannel("chromium"));
```

### Miscellaneous

- There will be no more updates for WebKit on Ubuntu 20.04 and Debian 11. We recommend updating your OS to a later version.
- `<canvas>` elements inside a snapshot now draw a preview.

### Browser Versions

- Chromium 131.0.6778.33
- Mozilla Firefox 132.0
- WebKit 18.2

This version was also tested against the following stable channels:

- Google Chrome 130
- Microsoft Edge 130


## Version 1.48

### WebSocket routing

New methods [`method: Page.routeWebSocket`] and [`method: BrowserContext.routeWebSocket`] allow to intercept, modify and mock WebSocket connections initiated in the page. Below is a simple example that mocks WebSocket communication by responding to a `"request"` with a `"response"`.

```java
page.routeWebSocket("/ws", ws -> {
  ws.onMessage(frame -> {
    if ("request".equals(frame.text()))
      ws.send("response");
  });
});
```

See [WebSocketRoute] for more details.

### UI updates

- New "copy" buttons for annotations and test location in the HTML report.
- Route method calls like [`method: Route.fulfill`] are not shown in the report and trace viewer anymore. You can see which network requests were routed in the network tab instead.
- New "Copy as cURL" and "Copy as fetch" buttons for requests in the network tab.

### Miscellaneous

- New method [`method: Page.requestGC`] may help detect memory leaks.
- Requests made by [APIRequestContext] now record detailed timing and security information in the HAR.

### Browser Versions

- Chromium 130.0.6723.19
- Mozilla Firefox 130.0
- WebKit 18.0

This version was also tested against the following stable channels:

- Google Chrome 129
- Microsoft Edge 129


## Version 1.47

### Network Tab improvements

The Network tab in the trace viewer has several nice improvements:

- filtering by asset type and URL
- better display of query string parameters
- preview of font assets

![Network tab now has filters](https://github.com/user-attachments/assets/4bd1b67d-90bd-438b-a227-00b9e86872e2)

### Miscellaneous

- The `mcr.microsoft.com/playwright/java:v1.47.0` now serves a Playwright image based on Ubuntu 24.04 Noble.
  To use the 22.02 jammy-based image, please use `mcr.microsoft.com/playwright/java:v1.47.0-jammy` instead.
- The `:latest`/`:focal`/`:jammy` tag for Playwright Docker images is no longer being published. Pin to a specific version for better stability and reproducibility.
- TLS client certificates can now be passed from memory by passing [`option: Browser.newContext.clientCertificates.cert`] and [`option: Browser.newContext.clientCertificates.key`] as byte arrays instead of file paths.
- [`option: Locator.selectOption.noWaitAfter`] in [`method: Locator.selectOption`] was deprecated.
- We've seen reports of WebGL in Webkit misbehaving on GitHub Actions `macos-13`. We recommend upgrading GitHub Actions to `macos-14`.

### Browser Versions

- Chromium 129.0.6668.29
- Mozilla Firefox 130.0
- WebKit 18.0

This version was also tested against the following stable channels:

- Google Chrome 128
- Microsoft Edge 128

## Version 1.46

### TLS Client Certificates

Playwright now allows to supply client-side certificates, so that server can verify them, as specified by TLS Client Authentication.

You can provide client certificates as a parameter of [`method: Browser.newContext`] and [`method: APIRequest.newContext`]. The following snippet sets up a client certificate for `https://example.com`:

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
    .setClientCertificates(asList(new ClientCertificate("https://example.com")
          .setCertPath(Paths.get("client-certificates/cert.pem"))
          .setKeyPath(Paths.get("client-certificates/key.pem")))));
```

### Trace Viewer Updates

- Content of text attachments is now rendered inline in the attachments pane.
- New setting to show/hide routing actions like [`method: Route.continue`].
- Request method and status are shown in the network details tab.
- New button to copy source file location to clipboard.
- Metadata pane now displays the `baseURL`.

### Miscellaneous

- New `maxRetries` option in [`method: APIRequestContext.fetch`] which retries on the `ECONNRESET` network error.

### Browser Versions

- Chromium 128.0.6613.18
- Mozilla Firefox 128.0
- WebKit 18.0

This version was also tested against the following stable channels:

- Google Chrome 127
- Microsoft Edge 127


## Version 1.45

### Clock

Utilizing the new [Clock] API allows to manipulate and control time within tests to verify time-related behavior. This API covers many common scenarios, including:
* testing with predefined time;
* keeping consistent time and timers;
* monitoring inactivity;
* ticking through time manually.

```java
// Initialize clock with some time before the test time and let the page load
// naturally. `Date.now` will progress as the timers fire.
page.clock().install(new Clock.InstallOptions().setTime("2024-02-02T08:00:00"));
page.navigate("http://localhost:3333");
Locator locator = page.getByTestId("current-time");

// Pretend that the user closed the laptop lid and opened it again at 10am.
// Pause the time once reached that point.
page.clock().pauseAt("2024-02-02T10:00:00");

// Assert the page state.
assertThat(locator).hasText("2/2/2024, 10:00:00 AM");

// Close the laptop lid again and open it at 10:30am.
page.clock().fastForward("30:00");
assertThat(locator).hasText("2/2/2024, 10:30:00 AM");
```

See [the clock guide](./clock.md) for more details.

### Miscellaneous

- Method [`method: Locator.setInputFiles`] now supports uploading a directory for `<input type=file webkitdirectory>` elements.
  ```java
  page.getByLabel("Upload directory").setInputFiles(Paths.get("mydir"));
  ```

- Multiple methods like [`method: Locator.click`] or [`method: Locator.press`] now support a `ControlOrMeta` modifier key. This key maps to `Meta` on macOS and maps to `Control` on Windows and Linux.
  ```java
  // Press the common keyboard shortcut Control+S or Meta+S to trigger a "Save" operation.
  page.keyboard.press("ControlOrMeta+S");
  ```

- New property `httpCredentials.send` in [`method: APIRequest.newContext`] that allows to either always send the `Authorization` header or only send it in response to `401 Unauthorized`.

- Playwright now supports Chromium, Firefox and WebKit on Ubuntu 24.04.

- v1.45 is the last release to receive WebKit update for macOS 12 Monterey. Please update macOS to keep using the latest WebKit.

### Browser Versions

* Chromium 127.0.6533.5
* Mozilla Firefox 127.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 126
* Microsoft Edge 126

## Version 1.44

### New APIs

**Accessibility assertions**

- [`method: LocatorAssertions.toHaveAccessibleName`] checks if the element has the specified accessible name:
  ```java
  Locator locator = page.getByRole(AriaRole.BUTTON);
  assertThat(locator).hasAccessibleName("Submit");
  ```

- [`method: LocatorAssertions.toHaveAccessibleDescription`] checks if the element has the specified accessible description:
  ```java
  Locator locator = page.getByRole(AriaRole.BUTTON);
  assertThat(locator).hasAccessibleDescription("Upload a photo");
  ```

- [`method: LocatorAssertions.toHaveRole`] checks if the element has the specified ARIA role:
  ```java
  Locator locator = page.getByTestId("save-button");
  assertThat(locator).hasRole(AriaRole.BUTTON);
  ```

**Locator handler**

- After executing the handler added with [`method: Page.addLocatorHandler`], Playwright will now wait until the overlay that triggered the handler is not visible anymore. You can opt-out of this behavior with the new `setNoWaitAfter` option.
- You can use new `setTimes` option in [`method: Page.addLocatorHandler`] to specify maximum number of times the handler should be run.
- The handler in [`method: Page.addLocatorHandler`] now accepts the locator as argument.
- New [`method: Page.removeLocatorHandler`] method for removing previously added locator handlers.

```java
Locator locator = page.getByText("This interstitial covers the button");
page.addLocatorHandler(locator, overlay -> {
  overlay.locator("#close").click();
}, new Page.AddLocatorHandlerOptions().setTimes(3).setNoWaitAfter(true));
// Run your tests that can be interrupted by the overlay.
// ...
page.removeLocatorHandler(locator);
```

**Miscellaneous options**

- New method [`method: FormData.append`] allows to specify repeating fields with the same name in [`setMultipart`](./api/class-requestoptions#request-options-set-multipart) option in `RequestOptions`:
  ```java
  FormData formData = FormData.create();
  formData.append("file", new FilePayload("f1.js", "text/javascript",
  "var x = 2024;".getBytes(StandardCharsets.UTF_8)));
  formData.append("file", new FilePayload("f2.txt", "text/plain",
    "hello".getBytes(StandardCharsets.UTF_8)));
  APIResponse response = context.request().post("https://example.com/uploadFile", RequestOptions.create().setMultipart(formData));
  ```

- `expect(page).toHaveURL(url)` now supports `setIgnoreCase` [option](./api/class-pageassertions#page-assertions-to-have-url-option-ignore-case).

### Browser Versions

* Chromium 125.0.6422.14
* Mozilla Firefox 125.0.1
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 124
* Microsoft Edge 124

## Version 1.43

### New APIs

- Method [`method: BrowserContext.clearCookies`] now supports filters to remove only some cookies.

  ```java
  // Clear all cookies.
  context.clearCookies();
  // New: clear cookies with a particular name.
  context.clearCookies(new BrowserContext.ClearCookiesOptions().setName("session-id"));
  // New: clear cookies for a particular domain.
  context.clearCookies(new BrowserContext.ClearCookiesOptions().setDomain("my-origin.com"));
  ```

- New method [`method: Locator.contentFrame`] converts a [Locator] object to a [FrameLocator]. This can be useful when you have a [Locator] object obtained somewhere, and later on would like to interact with the content inside the frame.

  ```java
  Locator locator = page.locator("iframe[name='embedded']");
  // ...
  FrameLocator frameLocator = locator.contentFrame();
  frameLocator.getByRole(AriaRole.BUTTON).click();
  ```

- New method [`method: FrameLocator.owner`] converts a [FrameLocator] object to a [Locator]. This can be useful when you have a [FrameLocator] object obtained somewhere, and later on would like to interact with the `iframe` element.

  ```java
  FrameLocator frameLocator = page.frameLocator("iframe[name='embedded']");
  // ...
  Locator locator = frameLocator.owner();
  assertThat(locator).isVisible();
  ```

### Browser Versions

* Chromium 124.0.6367.8
* Mozilla Firefox 124.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 123
* Microsoft Edge 123

## Version 1.42

### Experimental JUnit integration

Add new [`@UsePlaywright`](./junit.md) annotation to your test classes to start using Playwright
fixtures for [Page], [BrowserContext], [Browser], [APIRequestContext] and [Playwright] in the
test methods.

```java
package org.example;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.junit.UsePlaywright;
import org.junit.jupiter.api.Test;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

@UsePlaywright
public class TestExample {
  void shouldNavigateToInstallationGuide(Page page) {
    page.navigate("https://playwright.dev/java/");
    page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("Docs")).click();
    assertThat(page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName("Installation"))).isVisible();
  }

  @Test
  void shouldCheckTheBox(Page page) {
    page.setContent("<input id='checkbox' type='checkbox'></input>");
    page.locator("input").check();
    assertEquals(true, page.evaluate("window['checkbox'].checked"));
  }

  @Test
  void shouldSearchWiki(Page page) {
    page.navigate("https://www.wikipedia.org/");
    page.locator("input[name=\"search\"]").click();
    page.locator("input[name=\"search\"]").fill("playwright");
    page.locator("input[name=\"search\"]").press("Enter");
    assertThat(page).hasURL("https://en.wikipedia.org/wiki/Playwright");
  }
}
```

In the example above, all three test methods use the same [Browser]. Each test
uses its own [BrowserContext] and [Page].

**Custom options**

Implement your own `OptionsFactory` to initialize the fixtures with custom configuration.

```java
import com.microsoft.playwright.junit.Options;
import com.microsoft.playwright.junit.OptionsFactory;
import com.microsoft.playwright.junit.UsePlaywright;

@UsePlaywright(MyTest.CustomOptions.class)
public class MyTest {

  public static class CustomOptions implements OptionsFactory {
    @Override
    public Options getOptions() {
      return new Options()
          .setHeadless(false)
          .setContextOption(new Browser.NewContextOptions()
              .setBaseURL("https://github.com"))
          .setApiRequestOptions(new APIRequest.NewContextOptions()
              .setBaseURL("https://playwright.dev"));
    }
  }

  @Test
  public void testWithCustomOptions(Page page, APIRequestContext request) {
    page.navigate("/");
    assertThat(page).hasURL(Pattern.compile("github"));

    APIResponse response = request.get("/");
    assertTrue(response.text().contains("Playwright"));
  }
}
```

Learn more about the fixtures in our [JUnit guide](./junit.md).

### New Locator Handler

New method [`method: Page.addLocatorHandler`] registers a callback that will be invoked when specified element becomes visible and may block Playwright actions. The callback can get rid of the overlay. Here is an example that closes a cookie dialog when it appears.

```java
// Setup the handler.
page.addLocatorHandler(
    page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Hej! You are in control of your cookies.")),
    () -> {
        page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Accept all")).click();
    });
// Write the test as usual.
page.navigate("https://www.ikea.com/");
page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("Collection of blue and white")).click();
assertThat(page.getByRole(AriaRole.HEADING, new Page.GetByRoleOptions().setName("Light and easy"))).isVisible();
```

### New APIs

- [`method: Page.pdf`] accepts two new options [`option: Page.pdf.tagged`] and [`option: Page.pdf.outline`].

### Announcements

* ⚠️ Ubuntu 18 is not supported anymore.

### Browser Versions

* Chromium 123.0.6312.4
* Mozilla Firefox 123.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 122
* Microsoft Edge 123

## Version 1.41

### New APIs

- New method [`method: Page.unrouteAll`] removes all routes registered by [`method: Page.route`] and [`method: Page.routeFromHAR`].
- New method [`method: BrowserContext.unrouteAll`] removes all routes registered by [`method: BrowserContext.route`] and [`method: BrowserContext.routeFromHAR`].
- New options [`option: Page.screenshot.style`] in [`method: Page.screenshot`] and [`option: Locator.screenshot.style`] in [`method: Locator.screenshot`] to add custom CSS to the page before taking a screenshot.

### Browser Versions

* Chromium 121.0.6167.57
* Mozilla Firefox 121.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 120
* Microsoft Edge 120

## Version 1.40

### Test Generator Update

![Playwright Test Generator](https://github.com/microsoft/playwright/assets/9881434/e8d67e2e-f36d-4301-8631-023948d3e190)

New tools to generate assertions:
- "Assert visibility" tool generates [`method: LocatorAssertions.toBeVisible`].
- "Assert value" tool generates [`method: LocatorAssertions.toHaveValue`].
- "Assert text" tool generates [`method: LocatorAssertions.toContainText`].

Here is an example of a generated test with assertions:

```java
page.navigate("https://playwright.dev/");
page.getByRole(AriaRole.LINK, new Page.GetByRoleOptions().setName("Get started")).click();
assertThat(page.getByLabel("Breadcrumbs").getByRole(AriaRole.LIST)).containsText("Installation");
assertThat(page.getByLabel("Search")).isVisible();
page.getByLabel("Search").click();
page.getByPlaceholder("Search docs").fill("locator");
assertThat(page.getByPlaceholder("Search docs")).hasValue("locator");
```

### New APIs

- Options [`option: Page.close.reason`] in [`method: Page.close`], [`option: BrowserContext.close.reason`] in [`method: BrowserContext.close`] and [`option: Browser.close.reason`] in [`method: Browser.close`]. Close reason is reported for all operations interrupted by the closure.
- Option [`option: BrowserType.launchPersistentContext.firefoxUserPrefs`] in [`method: BrowserType.launchPersistentContext`].

### Other Changes

- Methods [`method: Download.path`] and [`method: Download.createReadStream`] throw an error for failed and cancelled downloads.

### Browser Versions

* Chromium 120.0.6099.28
* Mozilla Firefox 119.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 119
* Microsoft Edge 119

## Version 1.39

Evergreen browsers update.

### Browser Versions

* Chromium 119.0.6045.9
* Mozilla Firefox 118.0.1
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 118
* Microsoft Edge 118

## Version 1.38

### Trace Viewer Updates

![Playwright Trace Viewer](https://github.com/microsoft/playwright/assets/746130/0c41e20d-c54b-4600-8ca8-1cbb6393ddef)

1. Zoom into time range.
1. Network panel redesign.

### New APIs

- [`event: BrowserContext.webError`]
- [`method: Locator.pressSequentially`]

### Deprecations

* The following methods were deprecated: [`method: Page.type`], [`method: Frame.type`],
  [`method: Locator.type`] and [`method: ElementHandle.type`].
  Please use [`method: Locator.fill`] instead which is much faster. Use
  [`method: Locator.pressSequentially`] only if there is a special keyboard
  handling on the page, and you need to press keys one-by-one.

### Browser Versions

* Chromium 117.0.5938.62
* Mozilla Firefox 117.0
* WebKit 17.0

This version was also tested against the following stable channels:

* Google Chrome 116
* Microsoft Edge 116

## Version 1.37

### New APIs

- New methods [`method: BrowserContext.newCDPSession`] and [`method: Browser.newBrowserCDPSession`] create a [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) session for the page and browser respectively.

  ```java
  CDPSession cdpSession = page.context().newCDPSession(page);
  cdpSession.send("Runtime.enable");

  JsonObject params = new JsonObject();
  params.addProperty("expression", "window.foo = 'bar'");
  cdpSession.send("Runtime.evaluate", params);

  Object foo = page.evaluate("window['foo']");
  assertEquals("bar", foo);
  ```

### 📚 Debian 12 Bookworm Support

Playwright now supports Debian 12 Bookworm on both x86_64 and arm64 for Chromium, Firefox and WebKit.
Let us know if you encounter any issues!

Linux support looks like this:

|          | Ubuntu 20.04 | Ubuntu 22.04 | Debian 11 | Debian 12 |
| :--- | :---: | :---: | :---: | :---: |
| Chromium | ✅ | ✅ | ✅ | ✅ |
| WebKit | ✅ | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ | ✅ |

### Browser Versions

* Chromium 116.0.5845.82
* Mozilla Firefox 115.0
* WebKit 17.0

This version was also tested against the following stable channels:

* Google Chrome 115
* Microsoft Edge 115

## Version 1.36

🏝️ Summer maintenance release.

### Browser Versions

* Chromium 115.0.5790.75
* Mozilla Firefox 115.0
* WebKit 17.0

This version was also tested against the following stable channels:

* Google Chrome 114
* Microsoft Edge 114

## Version 1.35

### Highlights

* New option `maskColor` for methods [`method: Page.screenshot`] and [`method: Locator.screenshot`] to change default masking color.

* New `uninstall` CLI command to uninstall browser binaries:
  ```bash
  $ mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="uninstall" # remove browsers installed by this installation
  $ mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="uninstall --all" # remove all ever-install Playwright browsers
  ```

### Browser Versions

* Chromium 115.0.5790.13
* Mozilla Firefox 113.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 114
* Microsoft Edge 114

## Version 1.34

### Highlights

* New [`method: Locator.and`] to create a locator that matches both locators.

    ```java
    Locator button = page.getByRole(AriaRole.BUTTON).and(page.getByTitle("Subscribe"));
    ```

* New events [`event: BrowserContext.console`] and [`event: BrowserContext.dialog`] to subscribe to any dialogs
  and console messages from any page from the given browser context. Use the new methods [`method: ConsoleMessage.page`]
  and [`method: Dialog.page`] to pin-point event source.

### Browser Versions

* Chromium 114.0.5735.26
* Mozilla Firefox 113.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 113
* Microsoft Edge 113

## Version 1.33

### Locators Update

* Use [`method: Locator.or`] to create a locator that matches either of the two locators.
  Consider a scenario where you'd like to click on a "New email" button, but sometimes a security settings dialog shows up instead.
  In this case, you can wait for either a "New email" button, or a dialog and act accordingly:

    ```java
    Locator newEmail = page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("New email"));
    Locator dialog = page.getByText("Confirm security settings");
    assertThat(newEmail.or(dialog)).isVisible();
    if (dialog.isVisible())
      page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Dismiss")).click();
    newEmail.click();
    ```
* Use new options [`option: Locator.filter.hasNot`] and [`option: Locator.filter.hasNotText`] in [`method: Locator.filter`]
  to find elements that **do not match** certain conditions.

    ```java
    Locator rowLocator = page.locator("tr");
    rowLocator
        .filter(new Locator.FilterOptions().setHasNotText("text in column 1"))
        .filter(new Locator.FilterOptions().setHasNot(
          page.getByRole(AriaRole.BUTTON,
            new Page.GetByRoleOptions().setName("column 2 button" ))))
        .screenshot();
    ```
* Use new web-first assertion [`method: LocatorAssertions.toBeAttached`] to ensure that the element
  is present in the page's DOM. Do not confuse with the [`method: LocatorAssertions.toBeVisible`] that ensures that
  element is both attached & visible.

### New APIs

- [`method: Locator.or`]
- New option [`option: Locator.filter.hasNot`] in [`method: Locator.filter`]
- New option [`option: Locator.filter.hasNotText`] in [`method: Locator.filter`]
- [`method: LocatorAssertions.toBeAttached`]
- New option [`option: Route.fetch.timeout`] in [`method: Route.fetch`]

### Other highlights

- Native support for Apple Silicon - Playwright now runs without Rosetta
- Added Ubuntu 22.04 (Jammy) Docker image

### ⚠️ Breaking change

* The `mcr.microsoft.com/playwright/java:v1.33.0` now serves a Playwright image based on Ubuntu Jammy.
  To use the focal-based image, please use `mcr.microsoft.com/playwright/java:v1.33.0-focal` instead.

### Browser Versions

* Chromium 113.0.5672.53
* Mozilla Firefox 112.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 112
* Microsoft Edge 112

## Version 1.32

### New APIs

- New options [`option: Page.routeFromHAR.updateMode`] and [`option: Page.routeFromHAR.updateContent`] in [`method: Page.routeFromHAR`] and [`method: BrowserContext.routeFromHAR`].
- Chaining existing locator objects, see [locator docs](./locators.md#matching-inside-a-locator) for details.
- New option [`option: Tracing.startChunk.name`] in method [`method: Tracing.startChunk`].

### Browser Versions

* Chromium 112.0.5615.29
* Mozilla Firefox 111.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 111
* Microsoft Edge 111


## Version 1.31

### New APIs

- New assertion [`method: LocatorAssertions.toBeInViewport`] ensures that locator points to an element that intersects viewport, according to the [intersection observer API](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).


  ```java
  Locator locator = page.getByRole(AriaRole.BUTTON);

  // Make sure at least some part of element intersects viewport.
  assertThat(locator).isInViewport();

  // Make sure element is fully outside of viewport.
  assertThat(locator).not().isInViewport();

  // Make sure that at least half of the element intersects viewport.
  assertThat(locator).isInViewport(new LocatorAssertions.IsInViewportOptions().setRatio(0.5));
  ```


### Miscellaneous

- DOM snapshots in trace viewer can be now opened in a separate window.
- New option [`option: Route.fetch.maxRedirects`] for method [`method: Route.fetch`].
- Playwright now supports Debian 11 arm64.
- Official [docker images](./docker.md) now include Node 18 instead of Node 16.

### Browser Versions

* Chromium 111.0.5563.19
* Mozilla Firefox 109.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 110
* Microsoft Edge 110


## Version 1.30

### Browser Versions

* Chromium 110.0.5481.38
* Mozilla Firefox 108.0.2
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 109
* Microsoft Edge 109


## Version 1.29

### New APIs

- New method [`method: Route.fetch`]:

    ```java
    page.route("**/api/settings", route -> {
      // Fetch original settings.
      APIResponse response = route.fetch();
      // Force settings theme to a predefined value.
      String body = response.text().replace("\"theme\":\"default\"",
        "\"theme\":\"Solorized\"");
      // Fulfill with modified data.
      route.fulfill(new Route.FulfillOptions().setResponse(response).setBody(body));
    });
    ```

- New method [`method: Locator.all`] to iterate over all matching elements:

    ```java
    // Check all checkboxes!
    Locator checkboxes = page.getByRole(AriaRole.CHECKBOX);
    for (Locator checkbox : checkboxes.all())
      checkbox.check();
    ```

- [`method: Locator.selectOption`] matches now by value or label:

  ```html
  <select multiple>
    <option value="red">Red</option>
    <option value="green">Green</option>
    <option value="blue">Blue</option>
  </select>
  ```

  ```java
  element.selectOption("Red");
  ```

### Browser Versions

* Chromium 109.0.5414.46
* Mozilla Firefox 107.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 108
* Microsoft Edge 108

## Version 1.28

### Playwright Tools

* **Live Locators in CodeGen.** Generate a locator for any element on the page using "Explore" tool.

![Locator Explorer](https://user-images.githubusercontent.com/9798949/202293631-2f402cc2-35fb-4877-8ea1-82265fbbc232.png)

### New APIs

- [`method: Locator.blur`]
- [`method: Locator.clear`]

### Browser Versions

* Chromium 108.0.5359.29
* Mozilla Firefox 106.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 107
* Microsoft Edge 107


## Version 1.27

### Locators

With these new APIs writing locators is a joy:
- [`method: Page.getByText`] to locate by text content.
- [`method: Page.getByRole`] to locate by [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).
- [`method: Page.getByLabel`] to locate a form control by associated label's text.
- [`method: Page.getByTestId`] to locate an element based on its `data-testid` attribute (other attribute can be configured).
- [`method: Page.getByPlaceholder`] to locate an input by placeholder.
- [`method: Page.getByAltText`] to locate an element, usually image, by its text alternative.
- [`method: Page.getByTitle`] to locate an element by its title.

```java
page.getByLabel("User Name").fill("John");

page.getByLabel("Password").fill("secret-password");

page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in")).click();

assertThat(page.getByText("Welcome, John!")).isVisible();
```

All the same methods are also available on [Locator], [FrameLocator] and [Frame] classes.

### Other highlights

- As announced in v1.25, Ubuntu 18 will not be supported as of Dec 2022. In addition to that, there will be no WebKit updates on Ubuntu 18 starting from the next Playwright release.

### Behavior Changes

- [`method: LocatorAssertions.toHaveAttribute`] with an empty value does not match missing attribute anymore. For example, the following snippet will succeed when `button` **does not** have a `disabled` attribute.

   ```java
   assertThat(page.getByRole(AriaRole.BUTTON)).hasAttribute("disabled", "");
   ```

### Browser Versions

* Chromium 107.0.5304.18
* Mozilla Firefox 105.0.1
* WebKit 16.0

This version was also tested against the following stable channels:

* Google Chrome 106
* Microsoft Edge 106


## Version 1.26

### Assertions

- New option `enabled` for [`method: LocatorAssertions.toBeEnabled`].
- [`method: LocatorAssertions.toHaveText`] now pierces open shadow roots.
- New option `editable` for [`method: LocatorAssertions.toBeEditable`].
- New option `visible` for [`method: LocatorAssertions.toBeVisible`].

### Other highlights

- New option `setMaxRedirects` for [`method: APIRequestContext.get`] and others to limit redirect count.
- Docker images are now using OpenJDK 17.

### Behavior Change

A bunch of Playwright APIs already support the `setWaitUntil(WaitUntilState.DOMCONTENTLOADED)` option.
For example:

```java
page.navigate("https://playwright.dev", new Page.NavigateOptions().setWaitUntil(WaitUntilState.DOMCONTENTLOADED));
```

Prior to 1.26, this would wait for all iframes to fire the `DOMContentLoaded`
event.

To align with web specification, the `WaitUntilState.DOMCONTENTLOADED` value only waits for
the target frame to fire the `'DOMContentLoaded'` event. Use `setWaitUntil(WaitUntilState.LOAD)` to wait for all iframes.

### Browser Versions

* Chromium 106.0.5249.30
* Mozilla Firefox 104.0
* WebKit 16.0

This version was also tested against the following stable channels:

* Google Chrome 105
* Microsoft Edge 105

## Version 1.25

### New APIs & changes

- Default assertions timeout now can be changed with [`setDefaultAssertionTimeout`](./api/class-playwrightassertions#playwright-assertions-set-default-assertion-timeout).

### Announcements

* 🪦 This is the last release with macOS 10.15 support (deprecated as of 1.21).
* ⚠️ Ubuntu 18 is now deprecated and will not be supported as of Dec 2022.

### Browser Versions

* Chromium 105.0.5195.19
* Mozilla Firefox 103.0
* WebKit 16.0

This version was also tested against the following stable channels:

* Google Chrome 104
* Microsoft Edge 104

## Version 1.24

<div className="embed-youtube">
<iframe width="560" height="315" src="https://www.youtube-nocookie.com/embed/9F05o1shxcY" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
</div>

### 🐂 Debian 11 Bullseye Support

Playwright now supports Debian 11 Bullseye on x86_64 for Chromium, Firefox and WebKit. Let us know
if you encounter any issues!

Linux support looks like this:

|          | Ubuntu 20.04 | Ubuntu 22.04 | Debian 11
| :--- | :---: | :---: | :---: | :---: |
| Chromium | ✅ | ✅ | ✅ |
| WebKit | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |

## Version 1.23

### Network Replay

Now you can record network traffic into a HAR file and re-use this traffic in your tests.

To record network into HAR file:

```bash
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="open --save-har=example.har --save-har-glob='**/api/**' https://example.com"
```

Alternatively, you can record HAR programmatically:

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
    .setRecordHarPath(Paths.get("example.har"))
    .setRecordHarUrlFilter("**/api/**"));

// ... Perform actions ...

// Close context to ensure HAR is saved to disk.
context.close();
```

Use the new methods [`method: Page.routeFromHAR`] or [`method: BrowserContext.routeFromHAR`] to serve matching responses from the [HAR](http://www.softwareishard.com/blog/har-12-spec/) file:


```java
context.routeFromHAR(Paths.get("example.har"));
```

Read more in [our documentation](./mock.md#mocking-with-har-files).


### Advanced Routing

You can now use [`method: Route.fallback`] to defer routing to other handlers.

Consider the following example:

```java
// Remove a header from all requests.
page.route("**/*", route -> {
  Map<String, String> headers = new HashMap<>(route.request().headers());
  headers.remove("X-Secret");
  route.resume(new Route.ResumeOptions().setHeaders(headers));
});

// Abort all images.
page.route("**/*", route -> {
  if ("image".equals(route.request().resourceType()))
    route.abort();
  else
    route.fallback();
});
```

Note that the new methods [`method: Page.routeFromHAR`] and [`method: BrowserContext.routeFromHAR`] also participate in routing and could be deferred to.

### Web-First Assertions Update

* New method [`method: LocatorAssertions.toHaveValues`] that asserts all selected values of `<select multiple>` element.
* Methods [`method: LocatorAssertions.toContainText`] and [`method: LocatorAssertions.toHaveText`] now accept `ignoreCase` option.

### Miscellaneous

* If there's a service worker that's in your way, you can now easily disable it with a new context option `serviceWorkers`:
  ```java
  BrowserContext context = browser.newContext(new Browser.NewContextOptions()
      .setServiceWorkers(ServiceWorkerPolicy.BLOCK));
  ```
* Using `.zip` path for `recordHar` context option automatically zips the resulting HAR:
  ```java
  BrowserContext context = browser.newContext(new Browser.NewContextOptions()
      .setRecordHarPath(Paths.get("example.har.zip")));
  ```
* If you intend to edit HAR by hand, consider using the `"minimal"` HAR recording mode
  that only records information that is essential for replaying:
  ```java
  BrowserContext context = browser.newContext(new Browser.NewContextOptions()
      .setRecordHarPath(Paths.get("example.har"))
      .setRecordHarMode(HarMode.MINIMAL));
  ```
* Playwright now runs on Ubuntu 22 amd64 and Ubuntu 22 arm64.


## Version 1.22

### Highlights

- Role selectors that allow selecting elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

  ```java
  // Click a button with accessible name "log in"
  page.locator("role=button[name='log in']").click();
  ```

  Read more in [our documentation](./locators.md#locate-by-role).

- New [`method: Locator.filter`] API to filter an existing locator

  ```java
  Locator buttonsLocator = page.locator("role=button");
  // ...
  Locator submitButton = buttonsLocator.filter(new Locator.FilterOptions().setHasText("Submit"));
  submitButton.click();
  ```

- Playwright for Java now supports **Ubuntu 20.04 ARM64** and **Apple M1**.
  You can now run Playwright for Java tests on Apple M1, inside Docker on Apple M1, and on Raspberry Pi.


## Version 1.21

### Highlights

- New role selectors that allow selecting elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

  ```java
  // Click a button with accessible name "log in"
  page.locator("role=button[name='log in']").click();
  ```

  Read more in [our documentation](./locators.md#locate-by-role).
- New `scale` option in [`method: Page.screenshot`] for smaller sized screenshots.
- New `caret` option in [`method: Page.screenshot`] to control text caret. Defaults to `"hide"`.

### Behavior Changes

- Playwright now supports large file uploads (100s of MBs) via [`method: Locator.setInputFiles`] API.

### Browser Versions

- Chromium 101.0.4951.26
- Mozilla Firefox 98.0.2
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 100
- Microsoft Edge 100


## Version 1.20

### Highlights

- New options for methods [`method: Page.screenshot`], [`method: Locator.screenshot`] and [`method: ElementHandle.screenshot`]:
  * Option `ScreenshotAnimations.DISABLED` rewinds all CSS animations and transitions to a consistent state
  * Option `mask: Locator[]` masks given elements, overlaying them with pink `#FF00FF` boxes.
- [Trace Viewer](./trace-viewer) now shows [API testing requests](./api-testing).
- [`method: Locator.highlight`] visually reveals element(s) for easier debugging.

### Announcements

- v1.20 is the last release to receive WebKit update for macOS 10.15 Catalina. Please update macOS to keep using latest & greatest WebKit!

### Browser Versions

- Chromium 101.0.4921.0
- Mozilla Firefox 97.0.1
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 99
- Microsoft Edge 99


## Version 1.19

### Highlights

- Locator now supports a `has` option that makes sure it contains another locator inside:

  ```java
  page.locator("article", new Page.LocatorOptions().setHas(page.locator(".highlight"))).click();
  ```

  Read more in [locator documentation](./api/class-locator#locator-locator)

- New [`method: Locator.page`]
- [`method: Page.screenshot`] and [`method: Locator.screenshot`] now automatically hide blinking caret
- Playwright Codegen now generates locators and frame locators

### Browser Versions

- Chromium 100.0.4863.0
- Mozilla Firefox 96.0.1
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 98
- Microsoft Edge 98

## Version 1.18

### API Testing

Playwright for Java 1.18 introduces new [API Testing](./api/class-apirequestcontext) that lets you send requests to the server directly from Java!
Now you can:

- test your server API
- prepare server side state before visiting the web application in a test
- validate server side post-conditions after running some actions in the browser

To do a request on behalf of Playwright's Page, use **new [`property: Page.request`] API**:

```java
// Do a GET request on behalf of page
APIResponse res = page.request().get("http://example.com/foo.json");
```

Read more about it in our [API testing guide](./api-testing).

### Web-First Assertions

Playwright for Java 1.18 introduces [Web-First Assertions](./test-assertions).

Consider the following example:

```java
import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

public class TestExample {
  @Test
  void statusBecomesSubmitted() {
    // ...
    page.locator("#submit-button").click();
    assertThat(page.locator(".status")).hasText("Submitted");
  }
}
```

Playwright will be re-testing the node with the selector `.status` until
fetched Node has the `"Submitted"` text. It will be re-fetching the node and
checking it over and over, until the condition is met or until the timeout is
reached. You can pass this timeout as an option.

Read more in [our documentation](./test-assertions).

### Locator Improvements

- [`method: Locator.dragTo`]
- Each locator can now be optionally filtered by the text it contains:
    ```java
    page.locator("li", new Page.LocatorOptions().setHasText("my item"))
        .locator("button").click();
    ```
    Read more in [locator documentation](./api/class-locator#locator-locator)

### Tracing Improvements

[Tracing](./api/class-tracing.md) now can embed Java sources to recorded
traces, using new [`setSources`](./api/class-tracing#tracing-start-option-sources) option.

![tracing-java-sources](https://user-images.githubusercontent.com/746130/150180856-40a7df71-370c-4597-8665-40c77a5e06ad.png)

### New APIs & changes

- [`acceptDownloads`](./api/class-browser#browser-new-context-option-accept-downloads) option now defaults to `true`.



### Browser Versions

- Chromium 99.0.4812.0
- Mozilla Firefox 95.0
- WebKit 15.4

This version was also tested against the following stable channels:

- Google Chrome 97
- Microsoft Edge 97



## Version 1.17

### Frame Locators

Playwright 1.17 introduces [frame locators](./api/class-framelocator) - a locator to the iframe on the page. Frame locators capture the logic sufficient to retrieve the `iframe` and then locate elements in that iframe. Frame locators are strict by default, will wait for `iframe` to appear and can be used in Web-First assertions.

![Graphics](https://user-images.githubusercontent.com/746130/142082759-2170db38-370d-43ec-8d41-5f9941f57d83.png)

Frame locators can be created with either [`method: Page.frameLocator`] or [`method: Locator.frameLocator`] method.

```java
Locator locator = page.frameLocator("#my-frame").locator("text=Submit");
locator.click();
```

Read more at [our documentation](./api/class-framelocator).

### Trace Viewer Update

Playwright Trace Viewer is now **available online** at https://trace.playwright.dev! Just drag-and-drop your `trace.zip` file to inspect its contents.

> **NOTE**: trace files are not uploaded anywhere; [trace.playwright.dev](https://trace.playwright.dev) is a [progressive web application](https://web.dev/progressive-web-apps/) that processes traces locally.

- Playwright Test traces now include sources by default (these could be turned off with tracing option)
- Trace Viewer now shows test name
- New trace metadata tab with browser details
- Snapshots now have URL bar

![image](https://user-images.githubusercontent.com/746130/141877831-29e37cd1-e574-4bd9-aab5-b13a463bb4ae.png)

### HTML Report Update

- HTML report now supports dynamic filtering
- Report is now a **single static HTML file** that could be sent by e-mail or as a slack attachment.

![image](https://user-images.githubusercontent.com/746130/141877402-e486643d-72c7-4db3-8844-ed2072c5d676.png)

### Ubuntu ARM64 support + more

- Playwright now supports **Ubuntu 20.04 ARM64**. You can now run Playwright tests inside Docker on Apple M1 and on Raspberry Pi.
- You can now use Playwright to install stable version of Edge on Linux:
    ```bash
    mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install msedge"
    ```


### New APIs

- Tracing now supports a [`'title'`](./api/class-tracing#tracing-start-option-title) option
- Page navigations support a new [`'commit'`](./api/class-page#page-goto) waiting option

## Version 1.16

### 🎭 Playwright Library

#### Locator.waitFor

Wait for a locator to resolve to a single element with a given state.
Defaults to the `state: 'visible'`.

```java
Locator orderSent = page.locator("#order-sent");
orderSent.waitFor();
```

Read more about [`method: Locator.waitFor`].

### 🎭 Playwright Trace Viewer

- run trace viewer with `mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="show-trace"` and drop trace files to the trace viewer PWA
- better visual attribution of action targets

Read more about [Trace Viewer](./trace-viewer).

### Browser Versions

- Chromium 97.0.4666.0
- Mozilla Firefox 93.0
- WebKit 15.4

This version of Playwright was also tested against the following stable channels:

- Google Chrome 94
- Microsoft Edge 94

## Version 1.15

### 🖱️ Mouse Wheel

By using [`method: Mouse.wheel`] you are now able to scroll vertically or horizontally.

### 📜 New Headers API

Previously it was not possible to get multiple header values of a response. This is now possible and additional helper functions are available:

- [`method: Request.allHeaders`]
- [`method: Request.headersArray`]
- [`method: Request.headerValue`]
- [`method: Response.allHeaders`]
- [`method: Response.headersArray`]
- [`method: Response.headerValue`]
- [`method: Response.headerValues`]

### 🌈 Forced-Colors emulation

Its now possible to emulate the `forced-colors` CSS media feature by passing it in the [`method: Browser.newContext`] or calling [`method: Page.emulateMedia`].

### New APIs

- [`method: Page.route`] accepts new `times` option to specify how many times this route should be matched.
- [`method: Page.setChecked`] and [`method: Locator.setChecked`] were introduced to set the checked state of a checkbox.
- [`method: Request.sizes`] Returns resource size information for given http request.
- [`method: Tracing.startChunk`] - Start a new trace chunk.
- [`method: Tracing.stopChunk`] - Stops a new trace chunk.

### Browser Versions

- Chromium 96.0.4641.0
- Mozilla Firefox 92.0
- WebKit 15.0

## Version 1.14

#### ⚡️ New "strict" mode

Selector ambiguity is a common problem in automation testing. **"strict" mode**
ensures that your selector points to a single element and throws otherwise.

Set `setStrict(true)` in your action calls to opt in.

```java
// This will throw if you have more than one button!
page.click("button", new Page.ClickOptions().setStrict(true));
```

#### 📍 New [**Locators API**](./api/class-locator)

Locator represents a view to the element(s) on the page. It captures the logic sufficient to retrieve the element at any given moment.

The difference between the [Locator](./api/class-locator) and [ElementHandle](./api/class-elementhandle) is that the latter points to a particular element, while [Locator](./api/class-locator) captures the logic of how to retrieve that element.

Also, locators are **"strict" by default**!

```java
Locator locator = page.locator("button");
locator.click();
```

Learn more in the [documentation](./api/class-locator).

#### 🧩 Experimental [**React**](./other-locators.md#react-locator) and [**Vue**](./other-locators.md#vue-locator) selector engines

React and Vue selectors allow selecting elements by its component name and/or property values. The syntax is very similar to [attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all attribute selector operators.

```java
page.locator("_react=SubmitButton[enabled=true]").click();
page.locator("_vue=submit-button[enabled=true]").click();
```

Learn more in the [react selectors documentation](./other-locators.md#react-locator) and the [vue selectors documentation](./other-locators.md#vue-locator).

#### ✨ New [**`nth`**](./other-locators.md#n-th-element-locator) and [**`visible`**](./other-locators.md#css-matching-only-visible-elements) selector engines

- [`nth`](./other-locators.md#n-th-element-locator) selector engine is equivalent to the `:nth-match` pseudo class, but could be combined with other selector engines.
- [`visible`](./other-locators.md#css-matching-only-visible-elements) selector engine is equivalent to the `:visible` pseudo class, but could be combined with other selector engines.

```java
// select the first button among all buttons
button.click("button >> nth=0");
// or if you are using locators, you can use first(), nth() and last()
page.locator("button").first().click();

// click a visible button
button.click("button >> visible=true");
```

### Browser Versions

- Chromium 94.0.4595.0
- Mozilla Firefox 91.0
- WebKit 15.0


## Version 1.13

#### Playwright

- **🖖 Programmatic drag-and-drop support** via the [`method: Page.dragAndDrop`] API.
- **🔎 Enhanced HAR** with body sizes for requests and responses. Use via `recordHar` option in [`method: Browser.newContext`].

#### Tools

- Playwright Trace Viewer now shows parameters, returned values and `console.log()` calls.

#### New and Overhauled Guides

- [Intro](./intro.md)
- [Authentication](./auth.md)

#### Browser Versions

- Chromium 93.0.4576.0
- Mozilla Firefox 90.0
- WebKit 14.2

#### New Playwright APIs

- new `baseURL` option in [`method: Browser.newContext`] and [`method: Browser.newPage`]
- [`method: Response.securityDetails`] and [`method: Response.serverAddr`]
- [`method: Page.dragAndDrop`] and [`method: Frame.dragAndDrop`]
- [`method: Download.cancel`]
- [`method: Page.inputValue`], [`method: Frame.inputValue`] and [`method: ElementHandle.inputValue`]
- new `force` option in [`method: Page.fill`], [`method: Frame.fill`], and [`method: ElementHandle.fill`]
- new `force` option in [`method: Page.selectOption`], [`method: Frame.selectOption`], and [`method: ElementHandle.selectOption`]

## Version 1.12

#### 🧟‍♂️ Introducing Playwright Trace Viewer

[Playwright Trace Viewer](./trace-viewer.md) is a new GUI tool that helps exploring recorded Playwright traces after the script ran. Playwright traces let you examine:
- page DOM before and after each Playwright action
- page rendering before and after each Playwright action
- browser network during script execution

Traces are recorded using the new [`property: BrowserContext.tracing`] API:

```java
Browser browser = playwright.chromium().launch();
BrowserContext context = browser.newContext();

// Start tracing before creating / navigating a page.
context.tracing().start(new Tracing.StartOptions()
  .setScreenshots(true)
  .setSnapshots(true));

Page page = context.newPage();
page.navigate("https://playwright.dev");

// Stop tracing and export it into a zip archive.
context.tracing().stop(new Tracing.StopOptions()
  .setPath(Paths.get("trace.zip")));
```

Traces are examined later with the Playwright CLI:


```sh
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="show-trace trace.zip"
```

That will open the following GUI:

![image](https://user-images.githubusercontent.com/746130/121109654-d66c4480-c7c0-11eb-8d4d-eb70d2b03811.png)

👉 Read more in [trace viewer documentation](./trace-viewer.md).


#### Browser Versions

- Chromium 93.0.4530.0
- Mozilla Firefox 89.0
- WebKit 14.2

This version of Playwright was also tested against the following stable channels:

- Google Chrome 91
- Microsoft Edge 91

#### New APIs

- `reducedMotion` option in [`method: Page.emulateMedia`], [`method: BrowserType.launchPersistentContext`], [`method: Browser.newContext`] and [`method: Browser.newPage`]
- [`event: BrowserContext.request`]
- [`event: BrowserContext.requestFailed`]
- [`event: BrowserContext.requestFinished`]
- [`event: BrowserContext.response`]
- `tracesDir` option in [`method: BrowserType.launch`] and [`method: BrowserType.launchPersistentContext`]
- new [`property: BrowserContext.tracing`] API namespace
- new [`method: Download.page`] method

## Version 1.11

🎥  New video: [Playwright: A New Test Automation Framework for the Modern Web](https://youtu.be/_Jla6DyuEu4) ([slides](https://docs.google.com/presentation/d/1xFhZIJrdHkVe2CuMKOrni92HoG2SWslo0DhJJQMR1DI/edit?usp=sharing))
- We talked about Playwright
- Showed engineering work behind the scenes
- Did live demos with new features ✨
- **Special thanks** to [applitools](http://applitools.com/) for hosting the event and inviting us!

#### Browser Versions

- Chromium 92.0.4498.0
- Mozilla Firefox 89.0b6
- WebKit 14.2

#### New APIs

- support for **async predicates** across the API in methods such as [`method: Page.waitForRequest`] and others
- new **emulation devices**: Galaxy S8, Galaxy S9+, Galaxy Tab S4, Pixel 3, Pixel 4
- new methods:
    * [`method: Page.waitForURL`] to await navigations to URL
    * [`method: Video.delete`] and [`method: Video.saveAs`] to manage screen recording
- new options:
    * `screen` option in the [`method: Browser.newContext`] method to emulate `window.screen` dimensions
    * `position` option in [`method: Page.check`] and [`method: Page.uncheck`] methods
    * `trial` option to dry-run actions in [`method: Page.check`], [`method: Page.uncheck`], [`method: Page.click`], [`method: Page.dblclick`], [`method: Page.hover`] and [`method: Page.tap`]

## Version 1.10

- [Playwright for Java v1.10](https://github.com/microsoft/playwright-java) is **now stable**!
- Run Playwright against **Google Chrome** and **Microsoft Edge** stable channels with the [new channels API](./browsers).
- Chromium screenshots are **fast** on Mac & Windows.

#### Bundled Browser Versions

- Chromium 90.0.4430.0
- Mozilla Firefox 87.0b10
- WebKit 14.2

This version of Playwright was also tested against the following stable channels:

- Google Chrome 89
- Microsoft Edge 89

#### New APIs

- [`method: BrowserType.launch`] now accepts the new `'channel'` option. Read more in [our documentation](./browsers).


## Version 1.9

- [Playwright Inspector](./debug.md) is a **new GUI tool** to author and debug your tests.
  - **Line-by-line debugging** of your Playwright scripts, with play, pause and step-through.
  - Author new scripts by **recording user actions**.
  - **Generate element selectors** for your script by hovering over elements.
  - Set the `PWDEBUG=1` environment variable to launch the Inspector

- **Pause script execution** with [`method: Page.pause`] in headed mode. Pausing the page launches [Playwright Inspector](./debug.md) for debugging.

- **New has-text pseudo-class** for CSS selectors. `:has-text("example")` matches any element containing `"example"` somewhere inside, possibly in a child or a descendant element. See [more examples](./other-locators.md#css-matching-by-text).

- **Page dialogs are now auto-dismissed** during execution, unless a listener for `dialog` event is configured. [Learn more](./dialogs.md) about this.

- [Playwright for Python](https://github.com/microsoft/playwright-python) is **now stable** with an idiomatic snake case API and pre-built [Docker image](./docker.md) to run tests in CI/CD.

#### Browser Versions

- Chromium 90.0.4421.0
- Mozilla Firefox 86.0b10
- WebKit 14.1

#### New APIs
- [`method: Page.pause`].


## Version 1.8

- [Selecting elements based on layout](./other-locators.md#css-matching-elements-based-on-layout) with `:left-of()`, `:right-of()`, `:above()` and `:below()`.
- Playwright now includes command line interface, former playwright-cli.
  ```bash java
  mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="--help"
  ```
- [`method: Page.selectOption`] now waits for the options to be present.
- New methods to [assert element state](./actionability#assertions) like [`method: Page.isEditable`].

#### New APIs

- [`method: ElementHandle.isChecked`].
- [`method: ElementHandle.isDisabled`].
- [`method: ElementHandle.isEditable`].
- [`method: ElementHandle.isEnabled`].
- [`method: ElementHandle.isHidden`].
- [`method: ElementHandle.isVisible`].
- [`method: Page.isChecked`].
- [`method: Page.isDisabled`].
- [`method: Page.isEditable`].
- [`method: Page.isEnabled`].
- [`method: Page.isHidden`].
- [`method: Page.isVisible`].
- New option `'editable'` in [`method: ElementHandle.waitForElementState`].

#### Browser Versions

- Chromium 90.0.4392.0
- Mozilla Firefox 85.0b5
- WebKit 14.1

## Version 1.7

- **New Java SDK**: [Playwright for Java](https://github.com/microsoft/playwright-java) is now on par with [JavaScript](https://github.com/microsoft/playwright), [Python](https://github.com/microsoft/playwright-python) and [.NET bindings](https://github.com/microsoft/playwright-dotnet).
- **Browser storage API**: New convenience APIs to save and load browser storage state (cookies, local storage) to simplify automation scenarios with authentication.
- **New CSS selectors**: We heard your feedback for more flexible selectors and have revamped the selectors implementation. Playwright 1.7 introduces [new CSS extensions](./other-locators.md#css-locator) and there's more coming soon.
- **New website**: The docs website at [playwright.dev](https://playwright.dev/) has been updated and is now built with [Docusaurus](https://v2.docusaurus.io/).
- **Support for Apple Silicon**: Playwright browser binaries for WebKit and Chromium are now built for Apple Silicon.

#### New APIs

- [`method: BrowserContext.storageState`] to get current state for later reuse.
- `storageState` option in [`method: Browser.newContext`] and [`method: Browser.newPage`] to setup browser context state.

#### Browser Versions

- Chromium 89.0.4344.0
- Mozilla Firefox 84.0b9
- WebKit 14.1
