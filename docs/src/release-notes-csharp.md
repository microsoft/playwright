---
id: release-notes
title: "Release notes"
toc_max_heading_level: 2
---

## Version 1.46

### TLS Client Certificates

Playwright now allows to supply client-side certificates, so that server can verify them, as specified by TLS Client Authentication.

You can provide client certificates as a parameter of [`method: Browser.newContext`] and [`method: APIRequest.newContext`]. The following snippet sets up a client certificate for `https://example.com`:

```csharp
var context = await Browser.NewContextAsync(new() {
  ClientCertificates = [
    new() {
      Origin = "https://example.com",
      CertPath = "client-certificates/cert.pem",
      KeyPath = "client-certificates/key.pem",
    }
  ]
});
```

### Trace Viewer Updates

- Content of text attachments is now rendered inline in the attachments pane.
- New setting to show/hide routing actions like [`method: Route.continue`].
- Request method and status are shown in the network details tab.
- New button to copy source file location to clipboard.
- Metadata pane now displays the `BaseURL`.

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

```csharp
// Initialize clock with some time before the test time and let the page load naturally.
// `Date.now` will progress as the timers fire.
await Page.Clock.InstallAsync(new()
{
  TimeDate = new DateTime(2024, 2, 2, 8, 0, 0)
});
await Page.GotoAsync("http://localhost:3333");

// Pretend that the user closed the laptop lid and opened it again at 10am.
// Pause the time once reached that point.
await Page.Clock.PauseAtAsync(new DateTime(2024, 2, 2, 10, 0, 0));

// Assert the page state.
await Expect(Page.GetByTestId("current-time")).ToHaveTextAsync("2/2/2024, 10:00:00 AM");

// Close the laptop lid again and open it at 10:30am.
await Page.Clock.FastForwardAsync("30:00");
await Expect(Page.GetByTestId("current-time")).ToHaveTextAsync("2/2/2024, 10:30:00 AM");
```

See [the clock guide](./clock.md) for more details.

### Miscellaneous

- Method [`method: Locator.setInputFiles`] now supports uploading a directory for `<input type=file webkitdirectory>` elements.
  ```csharp
  await page.GetByLabel("Upload directory").SetInputFilesAsync("mydir");
  ```

- Multiple methods like [`method: Locator.click`] or [`method: Locator.press`] now support a `ControlOrMeta` modifier key. This key maps to `Meta` on macOS and maps to `Control` on Windows and Linux.
  ```csharp
  // Press the common keyboard shortcut Control+S or Meta+S to trigger a "Save" operation.
  await page.Keyboard.PressAsync("ControlOrMeta+S");
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
  ```csharp
  var locator = Page.GetByRole(AriaRole.Button);
  await Expect(locator).ToHaveAccessibleNameAsync("Submit");
  ```

- [`method: LocatorAssertions.toHaveAccessibleDescription`] checks if the element has the specified accessible description:
  ```csharp
  var locator = Page.GetByRole(AriaRole.Button);
  await Expect(locator).ToHaveAccessibleDescriptionAsync("Upload a photo");
  ```

- [`method: LocatorAssertions.toHaveRole`] checks if the element has the specified ARIA role:
  ```csharp
  var locator = Page.GetByTestId("save-button");
  await Expect(locator).ToHaveRoleAsync(AriaRole.Button);
  ```

**Locator handler**

- After executing the handler added with [`method: Page.addLocatorHandler`], Playwright will now wait until the overlay that triggered the handler is not visible anymore. You can opt-out of this behavior with the new `NoWaitAfter` option.
- You can use new `Times` option in [`method: Page.addLocatorHandler`] to specify maximum number of times the handler should be run.
- The handler in [`method: Page.addLocatorHandler`] now accepts the locator as argument.
- New [`method: Page.removeLocatorHandler`] method for removing previously added locator handlers.

```csharp
var locator = Page.GetByText("This interstitial covers the button");
await Page.AddLocatorHandlerAsync(locator, async (overlay) =>
{
    await overlay.Locator("#close").ClickAsync();
}, new() { Times = 3, NoWaitAfter = true });
// Run your tests that can be interrupted by the overlay.
// ...
await Page.RemoveLocatorHandlerAsync(locator);
```

**Miscellaneous options**

- New method [`method: FormData.append`] allows to specify repeating fields with the same name in [`Multipart`](./api/class-apirequestcontext#api-request-context-fetch-option-multipart) option in `APIRequestContext.FetchAsync()`:
  ```csharp
  var formData = Context.APIRequest.CreateFormData();
  formData.Append("file", new FilePayload()
  {
      Name = "f1.js",
      MimeType = "text/javascript",
      Buffer = System.Text.Encoding.UTF8.GetBytes("var x = 2024;")
  });
  formData.Append("file", new FilePayload()
  {
      Name = "f2.txt",
      MimeType = "text/plain",
      Buffer = System.Text.Encoding.UTF8.GetBytes("hello")
  });
  var response = await Context.APIRequest.PostAsync("https://example.com/uploadFiles", new() { Multipart = formData });
  ```

- [`method: PageAssertions.toHaveURL`] now supports `IgnoreCase` [option](./api/class-pageassertions#page-assertions-to-have-url-option-ignore-case).

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

  ```csharp
  // Clear all cookies.
  await Context.ClearCookiesAsync();
  // New: clear cookies with a particular name.
  await Context.ClearCookiesAsync(new() { Name = "session-id" });
  // New: clear cookies for a particular domain.
  await Context.ClearCookiesAsync(new() { Domain = "my-origin.com" });
  ```

- New property [`method: Locator.contentFrame`] converts a [Locator] object to a [FrameLocator]. This can be useful when you have a [Locator] object obtained somewhere, and later on would like to interact with the content inside the frame.

  ```csharp
  var locator = Page.Locator("iframe[name='embedded']");
  // ...
  var frameLocator = locator.ContentFrame;
  await frameLocator.GetByRole(AriaRole.Button).ClickAsync();
  ```

- New property [`method: FrameLocator.owner`] converts a [FrameLocator] object to a [Locator]. This can be useful when you have a [FrameLocator] object obtained somewhere, and later on would like to interact with the `iframe` element.

  ```csharp
  var frameLocator = page.FrameLocator("iframe[name='embedded']");
  // ...
  var locator = frameLocator.Owner;
  await Expect(locator).ToBeVisibleAsync();
  ```

### Browser Versions

* Chromium 124.0.6367.8
* Mozilla Firefox 124.0
* WebKit 17.4

This version was also tested against the following stable channels:

* Google Chrome 123
* Microsoft Edge 123

## Version 1.42

### New Locator Handler

New method [`method: Page.addLocatorHandler`] registers a callback that will be invoked when specified element becomes visible and may block Playwright actions. The callback can get rid of the overlay. Here is an example that closes a cookie dialog when it appears.

```csharp
// Setup the handler.
await Page.AddLocatorHandlerAsync(
    Page.GetByRole(AriaRole.Heading, new() { Name = "Hej! You are in control of your cookies." }),
    async () =>
    {
        await Page.GetByRole(AriaRole.Button, new() { Name = "Accept all" }).ClickAsync();
    });
// Write the test as usual.
await Page.GotoAsync("https://www.ikea.com/");
await Page.GetByRole(AriaRole.Link, new() { Name = "Collection of blue and white" }).ClickAsync();
await Expect(Page.GetByRole(AriaRole.Heading, new() { Name = "Light and easy" })).ToBeVisibleAsync();
```

### New APIs

- [`method: Page.pdf`] accepts two new options [`option: tagged`] and [`option: outline`].

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

- New method [`method: Page.unrouteAll`] removes all routes registered by [`method: Page.route`] and [`method: Page.routeFromHAR`]. Optionally allows to wait for ongoing routes to finish, or ignore any errors from them.
- New method [`method: BrowserContext.unrouteAll`] removes all routes registered by [`method: BrowserContext.route`] and [`method: BrowserContext.routeFromHAR`]. Optionally allows to wait for ongoing routes to finish, or ignore any errors from them.
- New option [`option: style`] in [`method: Page.screenshot`] and [`method: Locator.screenshot`] to add custom CSS to the page before taking a screenshot.

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

```csharp
await Page.GotoAsync("https://playwright.dev/");
await Page.GetByRole(AriaRole.Link, new() { Name = "Get started" }).ClickAsync();
await Expect(Page.GetByLabel("Breadcrumbs").GetByRole(AriaRole.List)).ToContainTextAsync("Installation");
await Expect(Page.GetByLabel("Search")).ToBeVisibleAsync();
await Page.GetByLabel("Search").ClickAsync();
await Page.GetByPlaceholder("Search docs").FillAsync("locator");
await Expect(Page.GetByPlaceholder("Search docs")).ToHaveValueAsync("locator");
```

### New APIs

- Option [`option: reason`] in [`method: Page.close`], [`method: BrowserContext.close`] and [`method: Browser.close`]. Close reason is reported for all operations interrupted by the closure.
- Option [`option: firefoxUserPrefs`] in [`method: BrowserType.launchPersistentContext`].

### Other Changes

- Methods [`method: Download.path`] and [`method: Download.createReadStream`] throw an error for failed and cancelled downloads.
- Playwright [docker image](./docker.md) now comes with .NET 8 (new LTS).

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

* New option `MaskColor` for methods [`method: Page.screenshot`] and [`method: Locator.screenshot`] to change default masking color.

* New `uninstall` CLI command to uninstall browser binaries:
  ```bash
  $ pwsh bin/Debug/netX/playwright.ps1 uninstall # remove browsers installed by this installation
  $ pwsh bin/Debug/netX/playwright.ps1 uninstall --all # remove all ever-install Playwright browsers
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

    ```csharp
    var button = page.GetByRole(AriaRole.BUTTON).And(page.GetByTitle("Subscribe"));
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
  Consider a scenario where   you'd like to click on a "New email" button, but sometimes a security settings dialog shows up instead.
  In this case, you can wait for either a "New email" button, or a dialog and act accordingly:

    ```csharp
    var newEmail = Page.GetByRole(AriaRole.Button, new() { Name = "New email" });
    var dialog = Page.GetByText("Confirm security settings");
    await Expect(newEmail.Or(dialog)).ToBeVisibleAsync();
    if (await dialog.IsVisibleAsync())
      await Page.GetByRole(AriaRole.Button, new() { Name = "Dismiss" }).ClickAsync();
    await newEmail.ClickAsync();
    ```
* Use new options [`option: hasNot`] and [`option: hasNotText`] in [`method: Locator.filter`]
  to find elements that **do not match** certain conditions.

    ```csharp
    var rowLocator = Page.Locator("tr");
    await rowLocator
        .Filter(new() { HasNotText = "text in column 1" })
        .Filter(new() { HasNot = Page.GetByRole(AriaRole.Button, new() { Name = "column 2 button" })})
        .ScreenshotAsync();
    ```
* Use new web-first assertion [`method: LocatorAssertions.toBeAttached`] to ensure that the element
  is present in the page's DOM. Do not confuse with the [`method: LocatorAssertions.toBeVisible`] that ensures that
  element is both attached & visible.

### New APIs

- [`method: Locator.or`]
- New option [`option: hasNot`] in [`method: Locator.filter`]
- New option [`option: hasNotText`] in [`method: Locator.filter`]
- [`method: LocatorAssertions.toBeAttached`]
- New option [`option: timeout`] in [`method: Route.fetch`]

### ⚠️ Breaking change

* The `mcr.microsoft.com/playwright/dotnet:v1.33.0` now serves a Playwright image based on Ubuntu Jammy.
  To use the focal-based image, please use `mcr.microsoft.com/playwright/dotnet:v1.33.0-focal` instead.

### Browser Versions

* Chromium 113.0.5672.53
* Mozilla Firefox 112.0
* WebKit 16.4

This version was also tested against the following stable channels:

* Google Chrome 112
* Microsoft Edge 112


## Version 1.32

### New APIs

- New options [`option: updateMode`] and [`option: updateContent`] in [`method: Page.routeFromHAR`] and [`method: BrowserContext.routeFromHAR`].
- Chaining existing locator objects, see [locator docs](./locators.md#matching-inside-a-locator) for details.
- New option [`option: name`] in method [`method: Tracing.startChunk`].

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


  ```csharp
  var locator = Page.GetByRole(AriaRole.Button);

  // Make sure at least some part of element intersects viewport.
  await Expect(locator).ToBeInViewportAsync();

  // Make sure element is fully outside of viewport.
  await Expect(locator).Not.ToBeInViewportAsync();

  // Make sure that at least half of the element intersects viewport.
  await Expect(locator).ToBeInViewportAsync(new() { Ratio = 0.5 });
  ```

- New methods [`method: BrowserContext.newCDPSession`] and [`method: Browser.newBrowserCDPSession`] create a [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) session for the page and browser respectively.


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

- New method [`method: Route.fetch`] and new option `Json` for [`method: Route.fulfill`]:

    ```csharp
    await Page.RouteAsync("**/api/settings", async route => {
      // Fetch original settings.
      var response = await route.FetchAsync();

      // Force settings theme to a predefined value.
      var json = await response.JsonAsync<MyDataType>();
      json.Theme = "Solarized";

      // Fulfill with modified data.
      await route.FulfillAsync(new() {
        Json = json
      });
    });
    ```

- New method [`method: Locator.all`] to iterate over all matching elements:

  ```csharp
  // Check all checkboxes!
  var checkboxes = Page.GetByRole(AriaRole.Checkbox);
  foreach (var checkbox in await checkboxes.AllAsync())
    await checkbox.CheckAsync();
  ```

- [`method: Locator.selectOption`] matches now by value or label:

  ```html
  <select multiple>
    <option value="red">Red</div>
    <option value="green">Green</div>
    <option value="blue">Blue</div>
  </select>
  ```

  ```csharp
  await element.SelectOptionAsync("Red");
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

![Locator Explorer](https://user-images.githubusercontent.com/9798949/202293757-2e3ec0ac-1feb-4d6f-9935-73e08658b76d.png)

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

```csharp
await page.GetByLabel("User Name").FillAsync("John");

await page.GetByLabel("Password").FillAsync("secret-password");

await page.GetByRole(AriaRole.Button, new() { NameString = "Sign in" }).ClickAsync();

await Expect(Page.GetByText("Welcome, John!")).ToBeVisibleAsync();
```

All the same methods are also available on [Locator], [FrameLocator] and [Frame] classes.

### Other highlights

- As announced in v1.25, Ubuntu 18 will not be supported as of Dec 2022. In addition to that, there will be no WebKit updates on Ubuntu 18 starting from the next Playwright release.

### Behavior Changes

- [`method: LocatorAssertions.toHaveAttribute`] with an empty value does not match missing attribute anymore. For example, the following snippet will succeed when `button` **does not** have a `disabled` attribute.

   ```csharp
   await Expect(Page.GetByRole(AriaRole.Button)).ToHaveAttribute("disabled", "");
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

- New option `Enabled` for [`method: LocatorAssertions.toBeEnabled`].
- [`method: LocatorAssertions.toHaveText`] now pierces open shadow roots.
- New option `Editable` for [`method: LocatorAssertions.toBeEditable`].
- New option `Visible` for [`method: LocatorAssertions.toBeVisible`].
- [`method: APIResponseAssertions.toBeOK`] is now available.

### Other highlights

- New option `MaxRedirects` for [`method: APIRequestContext.get`] and others to limit redirect count.
- Codegen now supports MSTest and NUnit frameworks.
- ASP .NET is now supported.

### Behavior Change

A bunch of Playwright APIs already support the `WaitUntil: WaitUntilState.DOMContentLoaded` option.
For example:

```csharp
await Page.GotoAsync("https://playwright.dev", new() { WaitUntil = WaitUntilState.DOMContentLoaded });
```

Prior to 1.26, this would wait for all iframes to fire the `DOMContentLoaded`
event.

To align with web specification, the `WaitUntilState.DOMContentLoaded` value only waits for
the target frame to fire the `'DOMContentLoaded'` event. Use `WaitUntil: WaitUntilState.Load` to wait for all iframes.

### Browser Versions

* Chromium 106.0.5249.30
* Mozilla Firefox 104.0
* WebKit 16.0

This version was also tested against the following stable channels:

* Google Chrome 105
* Microsoft Edge 105

## Version 1.25

### New .runsettings file support

`Microsoft.Playwright.NUnit` and `Microsoft.Playwright.MSTest` will now consider the `.runsettings` file and passed settings via the CLI when running end-to-end tests. See in the [documentation](./test-runners) for a full list of supported settings.

The following does now work:

```xml
<?xml version="1.0" encoding="utf-8"?>
<RunSettings>
  <!-- Playwright -->
  <Playwright>
    <BrowserName>chromium</BrowserName>
    <ExpectTimeout>5000</ExpectTimeout>
    <LaunchOptions>
      <Headless>true</Headless>
      <Channel>msedge</Channel>
    </LaunchOptions>
  </Playwright>
  <!-- General run configuration -->
  <RunConfiguration>
    <EnvironmentVariables>
      <!-- For debugging selectors, it's recommend to set the following environment variable -->
      <DEBUG>pw:api</DEBUG>
    </EnvironmentVariables>
  </RunConfiguration>
</RunSettings>
```

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

### New introduction docs

We rewrote our Getting Started docs to be more end-to-end testing focused. Check them out on [playwright.dev](./intro).

## Version 1.23

### API Testing

Playwright for .NET 1.23 introduces new [API Testing](./api/class-apirequestcontext) that lets you send requests to the server directly from .NET!
Now you can:

- test your server API
- prepare server side state before visiting the web application in a test
- validate server side post-conditions after running some actions in the browser

To do a request on behalf of Playwright's Page, use **new [`property: Page.request`] API**:

```csharp
// Do a GET request on behalf of page
var response = await Page.APIRequest.GetAsync("http://example.com/foo.json");
Console.WriteLine(response.Status);
Console.WriteLine(response.StatusText);
Console.WriteLine(response.Ok);
Console.WriteLine(response.Headers["Content-Type"]);
Console.WriteLine(await response.TextAsync());
Console.WriteLine((await response.JsonAsync())?.GetProperty("foo").GetString());
```

Read more about it in our [API testing guide](./api-testing).

### Network Replay

Now you can record network traffic into a HAR file and re-use this traffic in your tests.

To record network into HAR file:

```bash
pwsh bin/Debug/netX/playwright.ps1 open --save-har=example.har --save-har-glob="**/api/**" https://example.com
```

Alternatively, you can record HAR programmatically:

```csharp
var context = await browser.NewContextAsync(new()
{
  RecordHarPath = harPath,
  RecordHarUrlFilterString = "**/api/**",
});

// ... Perform actions ...

// Close context to ensure HAR is saved to disk.
context.CloseAsync();
```

Use the new methods [`method: Page.routeFromHAR`] or [`method: BrowserContext.routeFromHAR`] to serve matching responses from the [HAR](http://www.softwareishard.com/blog/har-12-spec/) file:


```csharp
await context.RouteFromHARAsync("example.har");
```

Read more in [our documentation](./mock.md#mocking-with-har-files).


### Advanced Routing

You can now use [`method: Route.fallback`] to defer routing to other handlers.

Consider the following example:

```csharp
// Remove a header from all requests.
await page.RouteAsync("**/*", async route =>
{
    var headers = route.Request.Headers;
    headers.Remove("X-Secret");
    await route.ContinueAsync(new() { Headers = headers });
});

// Abort all images.
await page.RouteAsync("**/*", async route =>
{
    if (route.Request.ResourceType == "image")
    {
        await route.AbortAsync();
    }
    else
    {
        await route.FallbackAsync();
    }
});
```

Note that the new methods [`method: Page.routeFromHAR`] and [`method: BrowserContext.routeFromHAR`] also participate in routing and could be deferred to.

### Web-First Assertions Update

* New method [`method: LocatorAssertions.toHaveValues`] that asserts all selected values of `<select multiple>` element.
* Methods [`method: LocatorAssertions.toContainText`] and [`method: LocatorAssertions.toHaveText`] now accept `ignoreCase` option.

### Miscellaneous

* If there's a service worker that's in your way, you can now easily disable it with a new context option `serviceWorkers`:
  ```csharp
  var context = await Browser.NewContextAsync(new()
  {
      ServiceWorkers = ServiceWorkerPolicy.Block
  });
  ```
* Using `.zip` path for `recordHar` context option automatically zips the resulting HAR:
  ```csharp
  var context = await Browser.NewContextAsync(new() { RecordHarPath = "example.har.zip" });
  ```
* If you intend to edit HAR by hand, consider using the `"minimal"` HAR recording mode
  that only records information that is essential for replaying:
  ```csharp
  var context = await Browser.NewContextAsync(new() { RecordHarPath = "example.har", RecordHarMode = HarMode.Minimal });
  ```
* Playwright now runs on Ubuntu 22 amd64 and Ubuntu 22 arm64.
* Playwright for .NET now supports **linux-arm64** and provides a **arm64 Ubuntu 20.04 Docker image** for it.

## Version 1.22

### Highlights

- Role selectors that allow selecting elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

  ```csharp
  // Click a button with accessible name "log in"
  await page.Locator("role=button[name='log in']").ClickAsync();
  ```

  Read more in [our documentation](./locators.md#locate-by-role).

- New [`method: Locator.filter`] API to filter an existing locator

  ```csharp
  var buttons = page.Locator("role=button");
  // ...
  var submitLocator = buttons.Filter(new() { HasText = "Sign up" });
  await submitLocator.ClickAsync();
  ```

## Version 1.21

### Highlights

- New role selectors that allow selecting elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

  ```csharp
  // Click a button with accessible name "log in"
  await page.Locator("role=button[name='log in']").ClickAsync();
  ```

  Read more in [our documentation](./locators.md#locate-by-role).
- New `scale` option in [`method: Page.screenshot`] for smaller sized screenshots.
- New `caret` option in [`method: Page.screenshot`] to control text caret. Defaults to `"hide"`.
- We now ship a designated .NET docker image `mcr.microsoft.com/playwright/dotnet`. Read more in [our documentation](./docker).

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

### Web-First Assertions

Playwright for .NET 1.20 introduces [Web-First Assertions](./test-assertions).

Consider the following example:

```csharp
using System.Threading.Tasks;
using Microsoft.Playwright.NUnit;
using NUnit.Framework;

namespace PlaywrightTests;

[TestFixture]
public class ExampleTests : PageTest
{
    [Test]
    public async Task StatusBecomesSubmitted()
    {
        await Expect(Page.Locator(".status")).ToHaveTextAsync("Submitted");
    }
}
```

Playwright will be re-testing the node with the selector `.status` until
fetched Node has the `"Submitted"` text. It will be re-fetching the node and
checking it over and over, until the condition is met or until the timeout is
reached. You can pass this timeout as an option.

Read more in [our documentation](./test-assertions).

### Other Updates

- New options for methods [`method: Page.screenshot`], [`method: Locator.screenshot`] and [`method: ElementHandle.screenshot`]:
  * Option `ScreenshotAnimations.Disabled` rewinds all CSS animations and transitions to a consistent state
  * Option `mask: Locator[]` masks given elements, overlaying them with pink `#FF00FF` boxes.
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

  ```csharp
  await Page.Locator("article", new() { Has = Page.Locator(".highlight") }).ClickAsync();
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

### Locator Improvements

- [`method: Locator.dragTo`]
- Each locator can now be optionally filtered by the text it contains:
    ```csharp
    await Page.Locator("li", new() { HasTextString = "My Item" })
              .Locator("button").click();
    ```
    Read more in [locator documentation](./api/class-locator#locator-locator)


### New APIs & changes

- [`AcceptDownloads`](./api/class-browser#browser-new-context-option-accept-downloads) option now defaults to `true`.
- [`Sources`](./api/class-tracing#tracing-start-option-sources) option to embed sources into traces.

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

```csharp
var locator = page.FrameLocator("#my-frame").Locator("text=Submit");
await locator.ClickAsync();
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
    pwsh bin/Debug/netX/playwright.ps1 install msedge
    ```


### New APIs

- Tracing now supports a [`'title'`](./api/class-tracing#tracing-start-option-title) option
- Page navigations support a new [`'commit'`](./api/class-page#page-goto) waiting option

## Version 1.16

### 🎭 Playwright Library

#### Locator.WaitForAsync

Wait for a locator to resolve to a single element with a given state.
Defaults to the `state: 'visible'`.

```csharp
var orderSent = page.Locator("#order-sent");
orderSent.WaitForAsync();
```

Read more about [`method: Locator.waitFor`].

### 🎭 Playwright Trace Viewer

- run trace viewer with `pwsh bin/Debug/netX/playwright.ps1 show-trace` and drop trace files to the trace viewer PWA
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

### Important ⚠
* ⬆ .NET Core Apps 2.1 are **no longer** supported for our CLI tooling. As of August 31st, 2021, .NET Core 2.1 is no [longer supported](https://devblogs.microsoft.com/dotnet/net-core-2-1-will-reach-end-of-support-on-august-21-2021/) and will not receive any security updates. We've decided to move the CLI forward and require .NET Core 3.1 as a minimum.

### Browser Versions

- Chromium 96.0.4641.0
- Mozilla Firefox 92.0
- WebKit 15.0

## Version 1.14

#### ⚡️ New "strict" mode

Selector ambiguity is a common problem in automation testing. **"strict" mode**
ensures that your selector points to a single element and throws otherwise.

Set `setStrict(true)` in your action calls to opt in.

```csharp
// This will throw if you have more than one button!
await page.Locator("button", new() { Strict = true });
```

#### 📍 New [**Locators API**](./api/class-locator)

Locator represents a view to the element(s) on the page. It captures the logic sufficient to retrieve the element at any given moment.

The difference between the [Locator](./api/class-locator) and [ElementHandle](./api/class-elementhandle) is that the latter points to a particular element, while [Locator](./api/class-locator) captures the logic of how to retrieve that element.

Also, locators are **"strict" by default**!

```csharp
var locator = page.Locator("button");
await locator.ClickAsync();
```

Learn more in the [documentation](./api/class-locator).

#### 🧩 Experimental [**React**](./other-locators.md#react-locator) and [**Vue**](./other-locators.md#vue-locator) selector engines

React and Vue selectors allow selecting elements by its component name and/or property values. The syntax is very similar to [attribute selectors](https://developer.mozilla.org/en-US/docs/Web/CSS/Attribute_selectors) and supports all attribute selector operators.

```csharp
await page.Locator("_react=SubmitButton[enabled=true]").ClickAsync();
await page.Locator("_vue=submit-button[enabled=true]").ClickAsync();
```

Learn more in the [react selectors documentation](./other-locators.md#react-locator) and the [vue selectors documentation](./other-locators.md#vue-locator).

#### ✨ New [**`nth`**](./other-locators.md#n-th-element-locator) and [**`visible`**](./other-locators.md#css-matching-only-visible-elements) selector engines

- [`nth`](./other-locators.md#n-th-element-locator) selector engine is equivalent to the `:nth-match` pseudo class, but could be combined with other selector engines.
- [`visible`](./other-locators.md#css-matching-only-visible-elements) selector engine is equivalent to the `:visible` pseudo class, but could be combined with other selector engines.

```csharp
// select the first button among all buttons
await button.ClickAsync("button >> nth=0");
// or if you are using locators, you can use First, Nth() and Last
await page.Locator("button").First.ClickAsync();

// click a visible button
await button.ClickAsync("button >> visible=true");
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

#### Highlights

- Playwright for .NET v1.12 is now stable!
- Ships with the [codegen](./codegen.md) and [trace viewer](./trace-viewer.md) tools out-of-the-box

#### Browser Versions

- Chromium 93.0.4530.0
- Mozilla Firefox 89.0
- WebKit 14.2

This version of Playwright was also tested against the following stable channels:

- Google Chrome 91
- Microsoft Edge 91


