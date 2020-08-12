# Authentication
Playwright can be used to automate scenarios that require authentication.

Tests written with Playwright execute in isolated clean-slate environments called
[browser contexts](./core-concepts.md#browser-contexts). This isolation model
improves reproducibility and prevents cascading test failures. New browser
contexts can load existing authentication state. This eliminates the need to
login in every context and speeds up test execution.

> Note: This guide covers cookie/token-based authentication (logging in via the
app UI). For [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication)
use [`browser.newContext`](./network.md#http-authentication).

<!-- GEN:toc -->
- [Automate logging in](#automate-logging-in)
- [Reuse authentication state](#reuse-authentication-state)
  * [Cookies](#cookies)
  * [Local storage](#local-storage)
  * [Session storage](#session-storage)
  * [Lifecycle](#lifecycle)
  * [Example](#example)
  * [API reference](#api-reference)
- [Multi-factor authentication](#multi-factor-authentication)
  * [Persistent authentication](#persistent-authentication)
  * [Lifecycle](#lifecycle-1)
  * [API reference](#api-reference-1)
<!-- GEN:stop -->

## Automate logging in

The Playwright API can automate interaction with a login form. See
[Input guide](./input.md) for more details.

The following example automates login on GitHub. Once these steps are executed,
the browser context will be authenticated.

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

These steps can be executed for every browser context. However, redoing login
for every test can slow down test execution. To prevent that, we will reuse
existing authentication state in new browser contexts.

## Reuse authentication state

Web apps use cookie-based or token-based authentication, where authenticated
state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
or in [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage).
The Playwright API can be used to retrieve this state from authenticated contexts
and then load it into new contexts.

Cookies and local storage state can be used across different browsers. They depend
on your application's authentication model: some apps might require both cookies
and local storage.

The following code snippets retrieve state from an authenticated page/context and
load them into a new context.

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
Local storage ([`window.localStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage))
is specific to a particular domain.

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
Session storage ([`window.sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage))
is specific to a particular domain.

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

Logging in via the UI and then reusing authentication state can be combined to
implement **login once and run multiple scenarios**. The lifecycle looks like:

1. Run tests (for example, with `npm run test`).
2. Login via UI and retrieve authentication state.
    * In Jest, this can be executed in [`globalSetup`](https://jestjs.io/docs/en/configuration#globalsetup-string).
3. In each test, load authentication state in `beforeEach` or `beforeAll` step.

This approach will also **work in CI environments**, since it does not rely
on any external state.

### Example

[This example script](examples/authentication.js) logs in on GitHub.com with
Chromium, and then reuses the logged in cookie state in WebKit.

### API reference
- [class `BrowserContext`](./api.md#class-browsercontext)
- [`browserContext.cookies`](./api.md#browsercontextcookiesurls)
- [`browserContext.addCookies`](./api.md#browsercontextaddcookiescookies)
- [`page.evaluate`](./api.md#pageevaluatepagefunction-arg)
- [`browserContext.addInitScript`](./api.md#browsercontextaddinitscriptscript-arg)

## Multi-factor authentication
Accounts with multi-factor authentication (MFA) cannot be fully automated, and need
manual intervention. Persistent authentication can be used to partially automate
MFA scenarios.

### Persistent authentication
Web browsers use a directory on disk to store user history, cookies, IndexedDB
and other local state. This disk location is called the [User data directory](https://chromium.googlesource.com/chromium/src/+/master/docs/user_data_dir.md).

Note that persistent authentication is not suited for CI environments since it
relies on a disk location. User data directories are specific to browser types
and cannot be shared across browser types.

User data directories can be used with the `launchPersistentContext` API.

```js
const { chromium } = require('playwright');

const userDataDir = '/path/to/directory';
const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
// Execute login steps manually in the browser window
```

### Lifecycle

1. Create a user data directory on disk
2. Launch a persistent context with the user data directory and login the MFA account.
3. Reuse user data directory to run automation scenarios.

### API reference
- [class `BrowserContext`](./api.md#class-browsercontext)
- [`browserType.launchPersistentContext`](./api.md#browsertypelaunchpersistentcontextuserdatadir-options)
