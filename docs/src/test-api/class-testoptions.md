# class: TestOptions
* since: v1.10
* langs: js

Playwright Test provides many options to configure test environment, [Browser], [BrowserContext] and more.

These options are usually provided in the [configuration file](../test-configuration.md) through [`property: TestConfig.use`] and [`property: TestProject.use`].

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
  },
});
```

```js tab=js-ts
import type { PlaywrightTestConfig } from '@playwright/test';
export default defineConfig({
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
  },
});
```

Alternatively, with [`method: Test.use`] you can override some options for a file.

```js tab=js-js
// example.spec.js
const { test, expect } = require('@playwright/test');

// Run tests in this file with portrait-like viewport.
test.use({ viewport: { width: 600, height: 900 } });

test('my portrait test', async ({ page }) => {
  // ...
});
```

```js tab=js-ts
// example.spec.ts
import { test, expect } from '@playwright/test';

// Run tests in this file with portrait-like viewport.
test.use({ viewport: { width: 600, height: 900 } });

test('my portrait test', async ({ page }) => {
  // ...
});
```

## property: TestOptions.acceptDownloads = %%-context-option-acceptdownloads-%%
* since: v1.10

## property: TestOptions.baseURL = %%-context-option-baseURL-%%
* since: v1.10

## property: TestOptions.browserName
* since: v1.10
- type: <[BrowserName]<"chromium"|"firefox"|"webkit">>

Name of the browser that runs tests. Defaults to `'chromium'`. Most of the time you should set `browserName` in your [TestConfig]:

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    browserName: 'firefox',
  },
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  use: {
    browserName: 'firefox',
  },
});
```

## property: TestOptions.actionTimeout
* since: v1.10
- type: <[int]>

Default timeout for each Playwright action in milliseconds, defaults to 0 (no timeout).

This is a default timeout for all Playwright actions, same as configured via [`method: Page.setDefaultTimeout`].

Learn more about [various timeouts](../test-timeouts.md).

## property: TestOptions.bypassCSP = %%-context-option-bypasscsp-%%
* since: v1.10

## property: TestOptions.channel = %%-browser-option-channel-%%
* since: v1.10

## property: TestOptions.colorScheme = %%-context-option-colorscheme-%%
* since: v1.10

## property: TestOptions.connectOptions
* since: v1.10
- type: <[void]|[Object]>
  - `wsEndpoint` <[string]> A browser websocket endpoint to connect to.
  - `headers` ?<[void]|[Object]<[string], [string]>> Additional HTTP headers to be sent with web socket connect request. Optional.
  - `timeout` ?<[int]> Timeout in milliseconds for the connection to be established. Optional, defaults to no timeout.

When connect options are specified, default [`property: Fixtures.browser`], [`property: Fixtures.context`] and [`property: Fixtures.page`] use the remote browser instead of launching a browser locally, and any launch options like [`property: TestOptions.headless`] or [`property: TestOptions.channel`] are ignored.

## property: TestOptions.contextOptions
* since: v1.10
- type: <[Object]>

Options used to create the context, as passed to [`method: Browser.newContext`]. Specific options like [`property: TestOptions.viewport`] take priority over this.

## property: TestOptions.deviceScaleFactor = %%-context-option-devicescalefactor-%%
* since: v1.10

## property: TestOptions.extraHTTPHeaders = %%-context-option-extrahttpheaders-%%
* since: v1.10

## property: TestOptions.geolocation = %%-context-option-geolocation-%%
* since: v1.10

## property: TestOptions.hasTouch = %%-context-option-hastouch-%%
* since: v1.10

## property: TestOptions.headless = %%-browser-option-headless-%%
* since: v1.10

## property: TestOptions.httpCredentials = %%-context-option-httpcredentials-%%
* since: v1.10

## property: TestOptions.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%
* since: v1.10

## property: TestOptions.isMobile = %%-context-option-ismobile-%%
* since: v1.10

## property: TestOptions.javaScriptEnabled = %%-context-option-javascriptenabled-%%
* since: v1.10

## property: TestOptions.launchOptions
* since: v1.10
- type: <[Object]>

Options used to launch the browser, as passed to [`method: BrowserType.launch`]. Specific options [`property: TestOptions.headless`] and [`property: TestOptions.channel`] take priority over this.

## property: TestOptions.locale = %%-context-option-locale-%%
* since: v1.10

## property: TestOptions.navigationTimeout
* since: v1.10
- type: <[int]>

Timeout for each navigation action in milliseconds. Defaults to 0 (no timeout).

This is a default navigation timeout, same as configured via [`method: Page.setDefaultNavigationTimeout`].

Learn more about [various timeouts](../test-timeouts.md).

## property: TestOptions.offline = %%-context-option-offline-%%
* since: v1.10

## property: TestOptions.permissions = %%-context-option-permissions-%%
* since: v1.10

## property: TestOptions.proxy = %%-browser-option-proxy-%%
* since: v1.10

## property: TestOptions.screenshot
* since: v1.10
- type: <[Object]|[ScreenshotMode]<"off"|"on"|"only-on-failure">>
  - `mode` <[ScreenshotMode]<"off"|"on"|"only-on-failure">> Automatic screenshot mode.
  - `fullPage` ?<[boolean]> When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to `false`.
  - `omitBackground` ?<[boolean]> Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.

Whether to automatically capture a screenshot after each test. Defaults to `'off'`.
* `'off'`: Do not capture screenshots.
* `'on'`: Capture screenshot after each test.
* `'only-on-failure'`: Capture screenshot after each test failure.

Learn more about [automatic screenshots](../test-configuration.md#automatic-screenshots).

## property: TestOptions.storageState = %%-js-python-context-option-storage-state-%%
* since: v1.10

## property: TestOptions.testIdAttribute
* since: v1.27

Custom attribute to be used in [`method: Page.getByTestId`]. `data-testid` is used by default.

## property: TestOptions.timezoneId = %%-context-option-timezoneid-%%
* since: v1.10

## property: TestOptions.trace
* since: v1.10
- type: <[Object]|[TraceMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">>
  - `mode` <[TraceMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">> Trace recording mode.
  - `screenshots` ?<[boolean]> Whether to capture screenshots during tracing. Screenshots are used to build a timeline preview. Defaults to true. Optional.
  - `snapshots` ?<[boolean]> Whether to capture DOM snapshot on every action. Defaults to true. Optional.
  - `sources` ?<[boolean]> Whether to include source files for trace actions. Defaults to true. Optional.

Whether to record trace for each test. Defaults to `'off'`.
* `'off'`: Do not record trace.
* `'on'`: Record trace for each test.
* `'retain-on-failure'`: Record trace for each test, but remove all traces from successful test runs.
* `'on-first-retry'`: Record trace only when retrying a test for the first time.

For more control, pass an object that specifies `mode` and trace features to enable.

Learn more about [recording trace](../test-configuration.md#record-test-trace).

## property: TestOptions.userAgent = %%-context-option-useragent-%%
* since: v1.10

## property: TestOptions.video
* since: v1.10
- type: <[Object]|[VideoMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">>
  - `mode` <[VideoMode]<"off"|"on"|"retain-on-failure"|"on-first-retry">> Video recording mode.
  - `size` ?<[Object]> Size of the recorded video. Optional.
    - `width` <[int]>
    - `height` <[int]>

Whether to record video for each test. Defaults to `'off'`.
* `'off'`: Do not record video.
* `'on'`: Record video for each test.
* `'retain-on-failure'`: Record video for each test, but remove all videos from successful test runs.
* `'on-first-retry'`: Record video only when retrying a test for the first time.

To control video size, pass an object with `mode` and `size` properties. If video size is not specified, it will be equal to [`property: TestOptions.viewport`] scaled down to fit into 800x800. If `viewport` is not configured explicitly the video size defaults to 800x450. Actual picture of each page will be scaled down if necessary to fit the specified size.

Learn more about [recording video](../test-configuration.md#record-video).

## property: TestOptions.viewport = %%-context-option-viewport-%%
* since: v1.10

## property: TestOptions.serviceWorkers = %%-context-option-service-worker-policy-%%
* since: v1.10
