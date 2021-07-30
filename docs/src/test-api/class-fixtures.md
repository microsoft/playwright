# class: Fixtures
* langs: js

Playwright Test is based on the concept of the [test fixtures](./test-fixtures.md). Test fixtures are used to establish environment for each test, giving the test everything it needs and nothing else.

Playwright Test looks at each test declaration, analyses the set of fixtures the test needs and prepares those fixtures specifically for the test. Values prepared by the fixtures are merged into a single object that is available to the `test`, hooks, annotations and other fixtures as a first parameter.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  // ...
});
```

Given the test above, Playwright Test will set up the `page` fixture before running the test, and tear it down after the test has finished. `page` fixture provides a [Page] object that is available to the test.

Playwright Test comes with builtin fixtures listed below, and you can add your own fixtures as well. Many fixtures are designed as "options" that you can set in your [`property: TestConfig.use`] section.

```js js-flavor=js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
  },
};

module.exports = config;
```

```js js-flavor=ts
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
  },
};
export default config;
```

Alternatively, with [`method: Test.use`] you can override some options for a file.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

// Run tests in this file with portrait-like viewport.
test.use({ viewport: { width: 600, height: 900 } });

test('my portrait test', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

// Run tests in this file with portrait-like viewport.
test.use({ viewport: { width: 600, height: 900 } });

test('my portrait test', async ({ page }) => {
  // ...
});
```

## property: Fixtures.acceptDownloads = %%-context-option-acceptdownloads-%%

## property: Fixtures.baseURL = %%-context-option-baseURL-%%

## property: Fixtures.browserName
- type: <[BrowserName]<"chromium"|"firefox"|"webkit">>

Name of the browser that runs tests. Defaults to `'chromium'`. Most of the time you should set `browserName` in your [TestConfig]:

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    browserName: 'firefox',
  },
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  use: {
    browserName: 'firefox',
  },
};
export default config;
```

## property: Fixtures.actionTimeout
- type: <[int]>

Timeout for each action and expect in milliseconds. Defaults to 0 (no timeout).

This is a default timeout for all Playwright actions, same as configured via [`method: Page.setDefaultTimeout`].

## property: Fixtures.bypassCSP = %%-context-option-bypasscsp-%%

## property: Fixtures.channel = %%-browser-option-channel-%%

## property: Fixtures.colorScheme = %%-context-option-colorscheme-%%

## property: Fixtures.context
- type: <[BrowserContext]>

Isolated [BrowserContext] instance, created for each test. Since contexts are isolated between each other, every test gets a fresh environment, even when multiple tests run in a single [Browser] for maximum efficiency.

Learn how to [configure context](./test-configuration.md) through other fixtures and options.

The [`property: Fixtures.page`] belongs to this context.

## property: Fixtures.createContext
- type: <[function]\([BrowserContextOptions]|[void]\):[BrowserContext]>

A function that creates a new context, taking into account all options set
through [configuration file](./test-configuration.md) or [`method: Test.use`] calls. All contexts created by this function are similar to the default [`property: Fixtures.context`].

This function is useful for multi-context scenarios, for example testing
two users talking over the chat application.

A single `options` argument will be merged with all the default options from [configuration file](./test-configuration.md) or [`method: Test.use`] calls and passed to [`method: Browser.newContext`]. If you'd like to undo some of these options, override them with some value or `undefined`. For example:

```js js-flavor=ts
// example.spec.ts

import { test } from '@playwright/test';

// All contexts will use this storage state.
test.use({ storageState: 'state.json' });

test('my test', async ({ createContext }) => {
  // An isolated context
  const context1 = await createContext();

  // Another isolated context with custom options
  const context2 = await createContext({
    // Undo 'state.json' from above
    storageState: undefined,
    // Set custom locale
    locale: 'en-US',
  });

  // ...
});
```

```js js-flavor=js
// example.spec.js
// @ts-check

const { test } = require('@playwright/test');

// All contexts will use this storage state.
test.use({ storageState: 'state.json' });

test('my test', async ({ createContext }) => {
  // An isolated context
  const context1 = await createContext();

  // Another isolated context with custom options
  const context2 = await createContext({
    // Undo 'state.json' from above
    storageState: undefined,
    // Set custom locale
    locale: 'en-US',
  });

  // ...
});
```

## property: Fixtures.contextOptions
- type: <[Object]>

Options used to create the context, as passed to [`method: Browser.newContext`]. Specific options like [`property: Fixtures.viewport`] take priority over this.

## property: Fixtures.deviceScaleFactor = %%-context-option-devicescalefactor-%%

## property: Fixtures.extraHTTPHeaders = %%-context-option-extrahttpheaders-%%

## property: Fixtures.geolocation = %%-context-option-geolocation-%%

## property: Fixtures.hasTouch = %%-context-option-hastouch-%%

## property: Fixtures.headless = %%-browser-option-headless-%%

## property: Fixtures.httpCredentials = %%-context-option-httpcredentials-%%

## property: Fixtures.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## property: Fixtures.isMobile = %%-context-option-ismobile-%%

## property: Fixtures.javaScriptEnabled = %%-context-option-javascriptenabled-%%

## property: Fixtures.launchOptions
- type: <[Object]>

Options used to launch the browser, as passed to [`method: BrowserType.launch`]. Specific options [`property: Fixtures.headless`] and [`property: Fixtures.channel`] take priority over this.

## property: Fixtures.locale = %%-context-option-locale-%%

## property: Fixtures.navigationTimeout
- type: <[int]>

Timeout for each navigation action in milliseconds. Defaults to 0 (no timeout).

This is a default navigation timeout, same as configured via [`method: Page.setDefaultNavigationTimeout`].

## property: Fixtures.offline = %%-context-option-offline-%%

## property: Fixtures.page
- type: <[Page]>

Isolated [Page] instance, created for each test. Pages are isolated between tests due to [`property: Fixtures.context`] isolation.

This is the most common fixture used in a test.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }) => {
  await page.goto('/signin');
  await page.fill('#username', 'User');
  await page.fill('#password', 'pwd');
  await page.click('text=Sign in');
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('/signin');
  await page.fill('#username', 'User');
  await page.fill('#password', 'pwd');
  await page.click('text=Sign in');
  // ...
});
```

## property: Fixtures.permissions = %%-context-option-permissions-%%

## property: Fixtures.proxy = %%-browser-option-proxy-%%

## property: Fixtures.screenshot
- type: <[Screenshot]<"off"|"on"|"only-on-failure">>

Whether to automatically capture a screenshot after each test. Defaults to `'off'`.
* `'off'`: Do not capture screenshots.
* `'on'`: Capture screenshot after each test.
* `'only-on-failure'`: Capture screenshot after each test failure.

Learn more about [automatic screenshots](./test-configuration.md#automatic-screenshots).

## property: Fixtures.storageState = %%-js-python-context-option-storage-state-%%

## property: Fixtures.timezoneId = %%-context-option-timezoneid-%%

## property: Fixtures.trace
- type: <[Screenshot]<"off"|"on"|"retain-on-failure"|"on-first-retry">>

Whether to record a trace for each test. Defaults to `'off'`.
* `'off'`: Do not record a trace.
* `'on'`: Record a trace for each test.
* `'retain-on-failure'`: Record a trace for each test, but remove it from successful test runs.
* `'on-first-retry'`: Record a trace only when retrying a test for the first time.

Learn more about [recording trace](./test-configuration.md#record-test-trace).

## property: Fixtures.userAgent = %%-context-option-useragent-%%

## property: Fixtures.video
- type: <[Object]|[VideoMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">>
  - `mode` <[VideoMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">> Video recording mode.
  - `size` <[Object]> Size of the recorded video.
    - `width` <[int]>
    - `height` <[int]>

Whether to record video for each test. Defaults to `'off'`.
* `'off'`: Do not record video.
* `'on'`: Record video for each test.
* `'retain-on-failure'`: Record video for each test, but remove all videos from successful test runs.
* `'on-first-retry'`: Record video only when retrying a test for the first time.

Learn more about [recording video](./test-configuration.md#record-video).

## property: Fixtures.viewport = %%-context-option-viewport-%%

