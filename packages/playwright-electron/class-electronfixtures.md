# class: ElectronFixtures
* since: v1.60
* langs: js

The `@playwright/electron` package exposes a `test` object with a set of fixtures tailored for Electron automation. Fixtures are used to establish the environment for each test, giving the test everything it needs and nothing else.

```js
import { test, expect } from '@playwright/electron';

test('basic test', async ({ page }) => {
  // ...
});
```

Given the test above, Playwright Test will launch the Electron application, wait for its first window, and expose it as the `page` fixture. Underneath, the [`property: ElectronFixtures.app`] fixture launches the application via [`method: Electron.launch`] using [`property: ElectronFixtures.appOptions`]. The application is closed after the test finishes.

## property: ElectronFixtures.app
* since: v1.60
- type: <[ElectronApplication]>

[ElectronApplication] instance, created for each test by launching Electron with [`property: ElectronFixtures.appOptions`]. The application is closed after the test finishes.

**Usage**

```js
import { test, expect } from '@playwright/electron';

test.use({ appOptions: { args: ['main.js'] } });

test('scripts the main process', async ({ app }) => {
  const appPath = await app.evaluate(({ app }) => app.getAppPath());
  expect(appPath).toBeTruthy();
});
```

## property: ElectronFixtures.appOptions
* since: v1.60
- type: <[Object]>

Options passed to [`method: Electron.launch`] when creating the [`property: ElectronFixtures.app`]. Override via `use` in the config file or `test.use()` to point at your Electron entry point and configure the launch.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/electron';

export default defineConfig({
  use: {
    appOptions: {
      args: ['main.js'],
      env: { NODE_ENV: 'test' },
    },
  },
});
```

## property: ElectronFixtures.context
* since: v1.60
- type: <[BrowserContext]>

[BrowserContext] of the launched Electron app. All windows of the Electron application belong to this context.

**Usage**

```js
import { test, expect } from '@playwright/electron';

test('routes network', async ({ context, page }) => {
  await context.route('**/api/**', route => route.fulfill({ status: 200, body: '{}' }));
  await page.goto('https://example.com/api/data');
});
```

## property: ElectronFixtures.page
* since: v1.60
- type: <[Page]>

First window of the launched Electron app, as returned by [`method: ElectronApplication.firstWindow`]. This is the most common fixture used in an Electron test.

**Usage**

```js
import { test, expect } from '@playwright/electron';

test('interacts with the first window', async ({ page }) => {
  await page.setContent('<h1>Hello</h1>');
  await expect(page.locator('h1')).toHaveText('Hello');
});
```

## property: ElectronFixtures.playwright
* since: v1.60
- type: <[Object]>

The Playwright module re-exported as a worker-scoped fixture. Use it when you need programmatic access to the Playwright API without importing it directly.

**Usage**

```js
import { test, expect } from '@playwright/electron';

test('uses playwright module', async ({ playwright }) => {
  const request = await playwright.request.newContext();
  // ...
});
```

## property: ElectronFixtures.screenshot
* since: v1.60
- type: <[Object]|[ScreenshotMode]<"off"|"on"|"only-on-failure"|"on-first-failure">>
  - `mode` <[ScreenshotMode]<"off"|"on"|"only-on-failure"|"on-first-failure">> Automatic screenshot mode.
  - `fullPage` ?<[boolean]> When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to `false`.
  - `omitBackground` ?<[boolean]> Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`.

Whether to automatically capture a screenshot after each test. Defaults to `'off'`.
* `'off'`: Do not capture screenshots.
* `'on'`: Capture screenshot after each test.
* `'only-on-failure'`: Capture screenshot after each test failure.
* `'on-first-failure'`: Capture screenshot after each test's first failure.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/electron';

export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
  },
});
```

## property: ElectronFixtures.testIdAttribute
* since: v1.60

Custom attribute to be used in [`method: Page.getByTestId`]. `data-testid` is used by default.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/electron';

export default defineConfig({
  use: {
    testIdAttribute: 'pw-test-id',
  },
});
```

## property: ElectronFixtures.trace
* since: v1.60
- type: <[Object]|[TraceMode]<"off"|"on"|"retain-on-failure"|"on-first-retry"|"retain-on-first-failure"|"retain-on-failure-and-retries">>
  - `mode` <[TraceMode]<"off"|"on"|"retain-on-failure"|"on-first-retry"|"on-all-retries"|"retain-on-first-failure"|"retain-on-failure-and-retries">> Trace recording mode.
  - `attachments` ?<[boolean]> Whether to include test attachments. Defaults to true. Optional.
  - `screenshots` ?<[boolean]> Whether to capture screenshots during tracing. Screenshots are used to build a timeline preview. Defaults to true. Optional.
  - `snapshots` ?<[boolean]> Whether to capture DOM snapshot on every action. Defaults to true. Optional.
  - `sources` ?<[boolean]> Whether to include source files for trace actions. Defaults to true. Optional.

Whether to record trace for each test. Defaults to `'off'`.
* `'off'`: Do not record trace.
* `'on'`: Record trace for each test.
* `'on-first-retry'`: Record trace only when retrying a test for the first time.
* `'on-all-retries'`: Record trace only when retrying a test.
* `'retain-on-failure'`: Record trace for each test. When test run passes, remove the recorded trace.
* `'retain-on-first-failure'`: Record trace for the first run of each test, but not for retries. When test run passes, remove the recorded trace.
* `'retain-on-failure-and-retries'`: Record trace for each test run. Retains all traces when an attempt fails.

For more control, pass an object that specifies `mode` and trace features to enable.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/electron';

export default defineConfig({
  use: {
    trace: 'on-first-retry'
  },
});
```
