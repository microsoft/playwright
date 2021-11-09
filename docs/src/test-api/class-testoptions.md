# class: TestOptions
* langs: js

Playwright Test provides many options to configure test environment, [Browser], [BrowserContext] and more.

These options are usually provided in the [configuration file](./test-configuration.md) through [`property: TestConfig.use`] and [`property: TestProject.use`].

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

## property: TestOptions.acceptDownloads = %%-context-option-acceptdownloads-%%

## property: TestOptions.baseURL = %%-context-option-baseURL-%%

## property: TestOptions.browserName
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

## property: TestOptions.actionTimeout
- type: <[int]>

Default timeout for each Playwright action in milliseconds, defaults to 0 (no timeout).

This is a default timeout for all Playwright actions, same as configured via [`method: Page.setDefaultTimeout`].

## property: TestOptions.bypassCSP = %%-context-option-bypasscsp-%%

## property: TestOptions.channel = %%-browser-option-channel-%%

## property: TestOptions.colorScheme = %%-context-option-colorscheme-%%

## property: TestOptions.contextOptions
- type: <[Object]>

Options used to create the context, as passed to [`method: Browser.newContext`]. Specific options like [`property: TestOptions.viewport`] take priority over this.

## property: TestOptions.deviceScaleFactor = %%-context-option-devicescalefactor-%%

## property: TestOptions.extraHTTPHeaders = %%-context-option-extrahttpheaders-%%

## property: TestOptions.geolocation = %%-context-option-geolocation-%%

## property: TestOptions.hasTouch = %%-context-option-hastouch-%%

## property: TestOptions.headless = %%-browser-option-headless-%%

## property: TestOptions.httpCredentials = %%-context-option-httpcredentials-%%

## property: TestOptions.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## property: TestOptions.isMobile = %%-context-option-ismobile-%%

## property: TestOptions.javaScriptEnabled = %%-context-option-javascriptenabled-%%

## property: TestOptions.launchOptions
- type: <[Object]>

Options used to launch the browser, as passed to [`method: BrowserType.launch`]. Specific options [`property: TestOptions.headless`] and [`property: TestOptions.channel`] take priority over this.

## property: TestOptions.locale = %%-context-option-locale-%%

## property: TestOptions.navigationTimeout
- type: <[int]>

Timeout for each navigation action in milliseconds. Defaults to 0 (no timeout).

This is a default navigation timeout, same as configured via [`method: Page.setDefaultNavigationTimeout`].

## property: TestOptions.offline = %%-context-option-offline-%%

## property: TestOptions.permissions = %%-context-option-permissions-%%

## property: TestOptions.proxy = %%-browser-option-proxy-%%

## property: TestOptions.screenshot
- type: <[Screenshot]<"off"|"on"|"only-on-failure">>

Whether to automatically capture a screenshot after each test. Defaults to `'off'`.
* `'off'`: Do not capture screenshots.
* `'on'`: Capture screenshot after each test.
* `'only-on-failure'`: Capture screenshot after each test failure.

Learn more about [automatic screenshots](./test-configuration.md#automatic-screenshots).

## property: TestOptions.storageState = %%-js-python-context-option-storage-state-%%

## property: TestOptions.timezoneId = %%-context-option-timezoneid-%%

## property: TestOptions.trace
- type: <[Object]|[TraceMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">>
  - `mode` <[TraceMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">> Trace recording mode.
  - `screenshots` <[boolean]> Whether to capture screenshots during tracing. Screenshots are used to build a timeline preview. Defaults to true. Optional.
  - `snapshots` <[boolean]> Whether to capture DOM snapshot on every action. Defaults to true. Optional.
  - `sources` <[boolean]> Whether to include source files for trace actions. Defaults to true. Optional.

Whether to record trace for each test. Defaults to `'off'`.
* `'off'`: Do not record trace.
* `'on'`: Record trace for each test.
* `'retain-on-failure'`: Record trace for each test, but remove all traces from successful test runs.
* `'on-first-retry'`: Record trace only when retrying a test for the first time.

Learn more about [recording trace](./test-configuration.md#record-test-trace).

## property: TestOptions.userAgent = %%-context-option-useragent-%%

## property: TestOptions.video
- type: <[Object]|[VideoMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">>
  - `mode` <[VideoMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">> Video recording mode.
  - `size` <[Object]> Size of the recorded video. Optional.
    - `width` <[int]>
    - `height` <[int]>

Whether to record video for each test. Defaults to `'off'`.
* `'off'`: Do not record video.
* `'on'`: Record video for each test.
* `'retain-on-failure'`: Record video for each test, but remove all videos from successful test runs.
* `'on-first-retry'`: Record video only when retrying a test for the first time.

Learn more about [recording video](./test-configuration.md#record-video).

## property: TestOptions.viewport = %%-context-option-viewport-%%

