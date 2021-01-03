---
id: auth
title: "Authentication"
---

Playwright can be used to automate scenarios that require authentication.

Tests written with Playwright execute in isolated clean-slate environments called [browser contexts](./core-concepts.md#browser-contexts). This isolation model improves reproducibility and prevents cascading test failures. New browser contexts can load existing authentication state. This eliminates the need to login in every context and speeds up test execution.

> Note: This guide covers cookie/token-based authentication (logging in via the app UI). For [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication) use [`browser.newContext`](./network.md#http-authentication).

- [Automate logging in](#automate-logging-in)
- [Reuse authentication state](#reuse-authentication-state)
- [Multi-factor authentication](#multi-factor-authentication)

## Automate logging in

The Playwright API can automate interaction with a login form. See [Input guide](./input.md) for more details.

The following example automates login on GitHub. Once these steps are executed, the browser context will be authenticated.

```js
const page = await context.newPage();
await page.goto('https://github.com/login');

// Interact with login form
await page.click('text=Login');
await page.fill('input[name="login"]', USERNAME);
await page.fill('input[name="password"]', PASSWORD);
await page.click('text=Submit');
// Verify app is logged in
```

These steps can be executed for every browser context. However, redoing login for every test can slow down test execution. To prevent that, we will reuse existing authentication state in new browser contexts.

## Reuse authentication state

Web apps use cookie-based or token-based authentication, where authenticated state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or in [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage). The Playwright API can be used to retrieve this state from authenticated contexts and then load it into new contexts.

Cookies and local storage state can be used across different browsers. They depend on your application's authentication model: some apps might require both cookies and local storage.

The following code snippets retrieve state from an authenticated page/context and load them into a new context.

### Cookies

```js
// Get cookies and store as an env variable
const cookies = await context.cookies();
process.env.COOKIES = JSON.stringify(cookies);

// Set cookies in a new context
const deserializedCookies = JSON.parse(process.env.COOKIES)
await context.addCookies(deserializedCookies);
```

### Local storage

Local storage ([`window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)) is specific to a particular domain.

```js
// Get local storage and store as env variable
const localStorage = await page.evaluate(() => JSON.stringify(window.localStorage));
process.env.LOCAL_STORAGE = localStorage;

// Set local storage in a new context
const localStorage = process.env.LOCAL_STORAGE;
await context.addInitScript(storage => {
  if (window.location.hostname === 'example.com') {
    const entries = JSON.parse(storage);
    Object.keys(entries).forEach(key => {
      window.localStorage.setItem(key, entries[key]);
    });
  }
}, localStorage);
```

### Session storage

Session storage ([`window.sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)) is specific to a particular domain.

```js
// Get session storage and store as env variable
const sessionStorage = await page.evaluate(() => JSON.stringify(sessionStorage));
process.env.SESSION_STORAGE = sessionStorage;

// Set session storage in a new context
const sessionStorage = process.env.SESSION_STORAGE;
await context.addInitScript(storage => {
  if (window.location.hostname === 'example.com') {
    const entries = JSON.parse(storage);
    Object.keys(entries).forEach(key => {
      window.sessionStorage.setItem(key, entries[key]);
    });
  }
}, sessionStorage);
```

### Lifecycle

Logging in via the UI and then reusing authentication state can be combined to implement **login once and run multiple scenarios**. The lifecycle looks like:
1. Run tests (for example, with `npm run test`).
1. Login via UI and retrieve authentication state.
   * In Jest, this can be executed in [`globalSetup`](https://jestjs.io/docs/en/configuration#globalsetup-string).
1. In each test, load authentication state in `beforeEach` or `beforeAll` step.

This approach will also **work in CI environments**, since it does not rely on any external state.

### Example

[This example script](examples/authentication.js) logs in on GitHub.com with Chromium, and then reuses the logged in cookie state in WebKit.

### API reference
- [BrowserContext]
- [browserContext.cookies([urls])](api/class-browsercontext.md#browsercontextcookiesurls)
- [browserContext.addCookies(cookies)](api/class-browsercontext.md#browsercontextaddcookiescookies)
- [page.evaluate(pageFunction[, arg])](api/class-page.md#pageevaluatepagefunction-arg)
- [browserContext.addInitScript(script[, arg])](api/class-browsercontext.md#browsercontextaddinitscriptscript-arg)

## Multi-factor authentication

Accounts with multi-factor authentication (MFA) cannot be fully automated, and need manual intervention. Persistent authentication can be used to partially automate MFA scenarios.

### Persistent authentication

Web browsers use a directory on disk to store user history, cookies, IndexedDB and other local state. This disk location is called the [User data directory](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md).

Note that persistent authentication is not suited for CI environments since it relies on a disk location. User data directories are specific to browser types and cannot be shared across browser types.

User data directories can be used with the `launchPersistentContext` API.

```js
const { chromium } = require('playwright');

const userDataDir = '/path/to/directory';
const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
// Execute login steps manually in the browser window
```

### Lifecycle
1. Create a user data directory on disk 2. Launch a persistent context with the user data directory and login the MFA account. 3. Reuse user data directory to run automation scenarios.

### API reference
- [BrowserContext]
- [browserType.launchPersistentContext(userDataDir[, options])](api/class-browsertype.md#browsertypelaunchpersistentcontextuserdatadir-options)

[Playwright]: api/class-playwright.md "Playwright"
[Browser]: api/class-browser.md "Browser"
[BrowserContext]: api/class-browsercontext.md "BrowserContext"
[Page]: api/class-page.md "Page"
[Frame]: api/class-frame.md "Frame"
[ElementHandle]: api/class-elementhandle.md "ElementHandle"
[JSHandle]: api/class-jshandle.md "JSHandle"
[ConsoleMessage]: api/class-consolemessage.md "ConsoleMessage"
[Dialog]: api/class-dialog.md "Dialog"
[Download]: api/class-download.md "Download"
[Video]: api/class-video.md "Video"
[FileChooser]: api/class-filechooser.md "FileChooser"
[Keyboard]: api/class-keyboard.md "Keyboard"
[Mouse]: api/class-mouse.md "Mouse"
[Touchscreen]: api/class-touchscreen.md "Touchscreen"
[Request]: api/class-request.md "Request"
[Response]: api/class-response.md "Response"
[Selectors]: api/class-selectors.md "Selectors"
[Route]: api/class-route.md "Route"
[WebSocket]: api/class-websocket.md "WebSocket"
[TimeoutError]: api/class-timeouterror.md "TimeoutError"
[Accessibility]: api/class-accessibility.md "Accessibility"
[Worker]: api/class-worker.md "Worker"
[BrowserServer]: api/class-browserserver.md "BrowserServer"
[BrowserType]: api/class-browsertype.md "BrowserType"
[Logger]: api/class-logger.md "Logger"
[ChromiumBrowser]: api/class-chromiumbrowser.md "ChromiumBrowser"
[ChromiumBrowserContext]: api/class-chromiumbrowsercontext.md "ChromiumBrowserContext"
[ChromiumCoverage]: api/class-chromiumcoverage.md "ChromiumCoverage"
[CDPSession]: api/class-cdpsession.md "CDPSession"
[FirefoxBrowser]: api/class-firefoxbrowser.md "FirefoxBrowser"
[WebKitBrowser]: api/class-webkitbrowser.md "WebKitBrowser"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[Evaluation Argument]: ./core-concepts.md#evaluationargument "Evaluation Argument"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[RegExp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp "RegExp"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[URL]: https://nodejs.org/api/url.html "URL"
[USKeyboardLayout]: ../src/usKeyboardLayout.ts "USKeyboardLayout"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null "null"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "string"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
