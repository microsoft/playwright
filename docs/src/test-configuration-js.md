---
id: test-configuration
title: "Configuration"
---

Playwright Test provides options to configure the default `browser`, `context` and `page` fixtures. For example there are options for `headless`, `viewport` and `ignoreHTTPSErrors`. You can also record a video or a trace for the test or capture a screenshot at the end.

There are plenty of testing options like `timeout` or `testDir` that configure how your tests are collected and executed.

You can specify any options globally in the configuration file, and most of them locally in a test file.

See the full list of [test options][TestOptions] and all [configuration properties][TestConfig].

## Global configuration

Create a `playwright.config.js` (or `playwright.config.ts`) and specify options in the [`property: TestConfig.use`] section.

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
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
  },
});
```

Now run tests as usual, Playwright Test will pick up the configuration file automatically.

```bash
npx playwright test
```

If you put your configuration file in a different place, pass it with `--config` option.

```bash
npx playwright test --config=tests/my.config.js
```

## Local configuration

You can override some options for a file or describe block.

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

The same works inside describe.

```js tab=js-js
// example.spec.js
const { test, expect } = require('@playwright/test');
test.describe('locale block', () => {
  // Run tests in this describe block with portrait-like viewport.
  test.use({ viewport: { width: 600, height: 900 } });
  test('my portrait test', async ({ page }) => {
    // ...
  });
});
```

```js tab=js-ts
// example.spec.ts
import { test, expect } from '@playwright/test';
test.describe('locale block', () => {
  // Run tests in this describe block with portrait-like viewport.
  test.use({ viewport: { width: 600, height: 900 } });
  test('my portrait test', async ({ page }) => {
    // ...
  });
});
```

## Basic options

Normally you would start with emulating a device, for example Desktop Chromium. See our [Emulation](./emulation.md) guide to learn more.

Here are some of the commonly used options for various scenarios. You usually set them globally in the [configuration file](#global-configuration).

- `actionTimeout` - Timeout for each Playwright action in milliseconds. Defaults to `0` (no timeout). Learn more about [various timeouts](./test-timeouts.md).
- `baseURL` - Base URL used for all pages in the context. Allows navigating by using just the path, for example `page.goto('/settings')`.
- `browserName` - Name of the browser that will run the tests, one of `chromium`, `firefox`, or `webkit`.
- `bypassCSP` - Toggles bypassing Content-Security-Policy. Useful when CSP includes the production origin.
- `channel` - Browser channel to use. [Learn more](./browsers.md) about different browsers and channels.
- `headless` - Whether to run the browser in headless mode.
- `viewport` - Viewport used for all pages in the context.
- `storageState` - Populates context with given storage state. Useful for easy authentication, [learn more](./auth.md).
- `colorScheme` - Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`.
- `geolocation` - Context geolocation.
- `locale` - [Emulates](./emulation.md) the user locale, for example `en-GB`, `de-DE`, etc.
- `permissions` - A list of permissions to grant to all pages in the context.
- `timezoneId` - Changes the timezone of the context.

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'firefox',
    headless: true,
  },
});
```

```js tab=js-ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'firefox',
    headless: true,
  },
});
```

## Multiple browsers

Playwright Test supports multiple "projects" that can run your tests in multiple browsers and configurations. Here is an example that runs every test in Chromium, Firefox and WebKit, by creating a project for each.

```js tab=js-js
// playwright.config.js
// @ts-check
const { devices } = require('@playwright/test');

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

You can specify [different options][TestProject] for each project, for example set specific command-line arguments for Chromium.

Playwright Test will run all projects by default.

```bash
npx playwright test

Running 5 tests using 5 workers

  ✓ [chromium] › example.spec.ts:3:1 › basic test (2s)
  ✓ [firefox] › example.spec.ts:3:1 › basic test (2s)
  ✓ [webkit] › example.spec.ts:3:1 › basic test (2s)
```

Use `--project` command line option to run a single project.

```bash
npx playwright test --project=firefox

Running 1 test using 1 worker

  ✓ [firefox] › example.spec.ts:3:1 › basic test (2s)
```

## Network

Available options to configure networking:

- `acceptDownloads` - Whether to automatically download all the attachments, defaults to `true`. [Learn more](./downloads.md) about working with downloads.
- `extraHTTPHeaders` - An object containing additional HTTP headers to be sent with every request. All header values must be strings.
- `httpCredentials` - Credentials for [HTTP authentication](./network.md#http-authentication).
- `ignoreHTTPSErrors` - Whether to ignore HTTPS errors during navigation.
- `offline` - Whether to emulate network being offline.
- `proxy` - [Proxy settings](./network.md#http-proxy) used for all pages in the test.

### Network mocking

You don't have to configure anything to mock network requests. Just define a custom [Route] that mocks network for a browser context.

```js tab=js-js
// example.spec.js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ context }) => {
  // Block any css requests for each test in this file.
  await context.route(/.css/, route => route.abort());
});

test('loads page without css', async ({ page }) => {
  await page.goto('https://playwright.dev');
  // ... test goes here
});
```

```js tab=js-ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  // Block any css requests for each test in this file.
  await context.route(/.css/, route => route.abort());
});

test('loads page without css', async ({ page }) => {
  await page.goto('https://playwright.dev');
  // ... test goes here
});
```

Alternatively, you can use [`method: Page.route`] to mock network in a single test.

```js tab=js-js
// example.spec.js
const { test, expect } = require('@playwright/test');

test('loads page without images', async ({ page }) => {
  // Block png and jpeg images.
  await page.route(/(png|jpeg)$/, route => route.abort());

  await page.goto('https://playwright.dev');
  // ... test goes here
});
```

```js tab=js-ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test('loads page without images', async ({ page }) => {
  // Block png and jpeg images.
  await page.route(/(png|jpeg)$/, route => route.abort());

  await page.goto('https://playwright.dev');
  // ... test goes here
});
```

## Automatic screenshots

You can make Playwright Test capture screenshots for you - control it with the `screenshot` option. By default screenshots are off.

- `'off'` - Do not capture screenshots.
- `'on'` - Capture screenshot after each test.
- `'only-on-failure'` - Capture screenshot after each test failure.

Screenshots will appear in the test output directory, typically `test-results`.

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    screenshot: 'only-on-failure',
  },
});
```

```js tab=js-ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    screenshot: 'only-on-failure',
  },
});
```

## Record video

Playwright Test can record videos for your tests, controlled by the `video` option. By default videos are off.

- `'off'` - Do not record video.
- `'on'` - Record video for each test.
- `'retain-on-failure'` - Record video for each test, but remove all videos from successful test runs.
- `'on-first-retry'` - Record video only when retrying a test for the first time.

Video files will appear in the test output directory, typically `test-results`. See [`property: TestOptions.video`] for advanced video configuration.

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    video: 'on-first-retry',
  },
});
```

```js tab=js-ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    video: 'on-first-retry',
  },
});
```

## Record test trace

Playwright Test can produce test traces while running the tests. Later on, you can view the trace and get detailed information about Playwright execution by opening [Trace Viewer](./trace-viewer.md). By default tracing is off, controlled by the `trace` option.

- `'off'` - Do not record trace.
- `'on'` - Record trace for each test.
- `'retain-on-failure'` - Record trace for each test, but remove it from successful test runs.
- `'on-first-retry'` - Record trace only when retrying a test for the first time.

Trace files will appear in the test output directory, typically `test-results`. See [`property: TestOptions.trace`] for advanced configuration.

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    trace: 'retain-on-failure',
  },
});
```

```js tab=js-ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    trace: 'retain-on-failure',
  },
});
```

## More browser and context options

Any options accepted by [`method: BrowserType.launch`] or [`method: Browser.newContext`] can be put into `launchOptions` or `contextOptions` respectively in the `use` section. Take a look at the [full list of available options][TestOptions].

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    launchOptions: {
      slowMo: 50,
    },
  },
});
```

```js tab=js-ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    launchOptions: {
      slowMo: 50,
    },
  },
});
```

However, most common ones like `headless` or `viewport` are available directly in the `use` section - see [basic options](#basic-options), [emulation](./emulation.md) or [network](#network).

## Explicit Context Creation and Option Inheritance

If using the built-in `browser` fixture, calling [`method: Browser.newContext`] will create a context with options inherited from the config:

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    userAgent: 'some custom ua',
    viewport: { width: 100, height: 100 },
  },
});
```

```js tab=js-js
// @ts-check
// example.spec.js

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    userAgent: 'some custom ua',
    viewport: { width: 100, height: 100 },
  },
});
```

An example test illustrating the initial context options are set:

```js tab=js-ts
// example.spec.ts
import { test, expect } from "@playwright/test";

test('should inherit use options on context when using built-in browser fixture', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  expect(await page.evaluate(() => navigator.userAgent)).toBe('some custom ua');
  expect(await page.evaluate(() => window.innerWidth)).toBe(100);
  await context.close();
});
```

```js tab=js-js
// @ts-check
// example.spec.ts
const { test, expect } = require("@playwright/test");

test('should inherit use options on context when using built-in browser fixture', async ({
  browser,
}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  expect(await page.evaluate(() => navigator.userAgent)).toBe('some custom ua');
  expect(await page.evaluate(() => window.innerWidth)).toBe(100);
  await context.close();
});
```

## Testing options

In addition to configuring [Browser] or [BrowserContext], videos or screenshots, Playwright Test has many options to configure how your tests are run. Below are the most common ones, see [TestConfig] for the full list.

- `forbidOnly`: Whether to exit with an error if any tests are marked as `test.only`. Useful on CI.
- `globalSetup`: Path to the global setup file. This file will be required and run before all the tests. It must export a single function.
- `globalTeardown`: Path to the global teardown file. This file will be required and run after all the tests. It must export a single function.
- `retries`: The maximum number of retry attempts per test.
- `testDir`: Directory with the test files.
- `testIdAttribute`: Set a custom data attribute for your [`method: Page.getByTestId`] locators.
- `testIgnore`: Glob patterns or regular expressions that should be ignored when looking for the test files. For example, `'**/test-assets'`.
- `testMatch`: Glob patterns or regular expressions that match test files. For example, `'**/todo-tests/*.spec.ts'`. By default, Playwright Test runs `.*(test|spec)\.(js|ts|mjs)` files.
- `timeout`: Time in milliseconds given to each test. Learn more about [various timeouts](./test-timeouts.md).
- `webServer: { command: string, port?: number, url?: string, ignoreHTTPSErrors?: boolean, timeout?: number, reuseExistingServer?: boolean, cwd?: string, env?: object }` - Launch a process and wait that it's ready before the tests will start. See [launch web server](./test-advanced.md#launching-a-development-web-server-during-the-tests) configuration for examples.
- `workers`: The maximum number of concurrent worker processes to use for parallelizing tests. Can also be set as percentage of logical CPU cores, e.g. `'50%'.`

You can specify these options in the configuration file. Note that testing options are **top-level**, do not put them into the `use` section.

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file
  testDir: 'tests',

  // change the default data-testid to a custom attribute
  testIdAttribute: 'data-pw'

  // Each test is given 30 seconds
  timeout: 30000,

  // Forbid test.only on CI
  forbidOnly: !!process.env.CI,

  // Two retries for each test
  retries: 2,

  // Limit the number of workers on CI, use default locally
  workers: process.env.CI ? 2 : undefined,

  use: {
    // Configure browser and context here
  },
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Look for test files in the "tests" directory, relative to this configuration file
  testDir: 'tests',

  // Each test is given 30 seconds
  timeout: 30000,

  // Forbid test.only on CI
  forbidOnly: !!process.env.CI,

  // Two retries for each test
  retries: 2,

  // Limit the number of workers on CI, use default locally
  workers: process.env.CI ? 2 : undefined,

  use: {
    // Configure browser and context here
  },
});
```
