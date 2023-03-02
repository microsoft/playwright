---
id: test-configuration
title: "Configuration"
---

Playwright provides you with many options to configure the test environment, Browser, BrowserContext and more. These options are usually provided in the configuration file through `testConfig.use` and `testProject.use`. However, you can also override them in the test file using the `test.use()` method.

## Test Runner Options

Playwright has many options to configure how your tests are run. You can specify these options in the configuration file. Note that test runner options are **top-level**, do not put them into the `use` section.

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Forbid test.only on CI 
  forbidOnly: !!process.env.CI,

  // Run all tests in parallel
  fullyParallel: true,

  // path to the global setup and teardown files 
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  // Folder for test artifacts such as screenshots, videos, traces, etc. 
  outputDir: 'test-results/',

  // Reporter to use
  reporter: 'html',

  // Two retries for each test 
  retries: 2,

  // Look for test files in the "tests" directory, relative to this configuration file 
  testDir: 'tests',

  // Glob patterns or regular expressions to ignore test files. 
  testIgnore: '*test-assets',

  // Glob patterns or regular expressions that match test files. 
  testMatch: '*todo-tests/*.spec.ts',

  // Each test is given 30 seconds 
  timeout: 30000,

  // Run your local dev server before starting the tests 
  webServer: {
    command: 'npm run start',
    port: 3000,
  },

  // Limit the number of workers on CI, use default locally 
  workers: process.env.CI ? 2 : undefined,
});
```

| Option | Description |
| :- | :- |
| [`property: TestConfig.forbidOnly`] | Whether to exit with an error if any tests are marked as `test.only`. Useful on CI.|
| [`property: TestConfig.fullyParallel`] | have all tests in all files to run in parallel. See [/Parallelism and sharding](./test-parallel) for more details. |
| [`property: TestConfig.globalSetup`] | Path to the global setup file. This file will be required and run before all the tests. It must export a single function. |
| [`property: TestConfig.globalTeardown`] |Path to the global teardown file. This file will be required and run after all the tests. It must export a single function. |
| [`property: TestConfig.outputDir`] | Folder for test artifacts such as screenshots, videos, traces, etc. |
| [`property: TestConfig.reporter`] | Reporter to use. See [Test Reporters](/test-reporters.md) to learn more about which reporters are available. |
| [`property: TestConfig.retries`] | The maximum number of retry attempts per test.|
| [`property: TestConfig.testDir`] | Directory with the test files. |
| [`property: TestConfig.testIgnore`] | Glob patterns or regular expressions that should be ignored when looking for the test files. For example, `'*test-assets'` |
| [`property: TestConfig.testMatch`] | Glob patterns or regular expressions that match test files. For example, `'*todo-tests/*.spec.ts'`. By default, Playwright Test runs `.*(test|spec)\.(js|ts|mjs)` files. |
| [`property: TestConfig.timeout`] | Playwright Test enforces a [timeout](./test-timeouts.md) for each test, 30 seconds by default. Time spent by the test function, fixtures, beforeEach and afterEach hooks is included in the test timeout. |
| [`property: TestConfig.webServer`] | To launch a server during the tests, use the `webServer` option |
| [`property: TestConfig.workers`] | The maximum number of concurrent worker processes to use for parallelizing tests. Can also be set as percentage of logical CPU cores, e.g. `'50%'.`. See [/Parallelism and sharding](./test-parallel) for more details. |

### Expect Options

Configuration for the expect assertion library.

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: {
    // Maximum time expect() should wait for the condition to be met.
    timeout: 5000,

    toHaveScreenshot: {
      // An acceptable amount of pixels that could be different, unset by default.
      maxDiffPixels: 10,
    },

    toMatchSnapshot:  {
      // An acceptable ratio of pixels that are different to the total amount of pixels, between 0 and 1.
      maxDiffPixelRatio: 10,
    },
  },
  
});
```

| Option | Description |
| :- | :- |
| [`property: TestConfig.expect`] | [Web first assertions](./test-assertions.md) like `expect(locator).toHaveText()` have a separate timeout of 5 seconds by default. This is the maximum time the `expect()` should wait for the condition to be met. Learn more about [test and expect timeouts](./test-timeouts.md) and how to set them for a single test. |
| [`method: PageAssertions.toHaveScreenshot#1`] | Configuration for the `expect(locator).toHaveScreeshot()` method. |
| [`method: SnapshotAssertions.toMatchSnapshot#1`]| Configuration for the `expect(locator).toMatchSnapshot()` method.|

### Launch a development web server

Run your local dev server before starting the tests. If `port` is specified in the config, test runner will wait for `127.0.0.1:port` or `::1:port` to be available before running the tests. The `port` (but not the `url`) gets passed over to Playwright as a [`property: TestOptions.baseURL`]. For example port `3000` produces `baseURL` equal to `http://localhost:3000`.

```js
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm run start',
    port: 3000,
  },
});
```

#### Adding a server timeout

User applications can sometimes take a few minutes to boot up. In this case, you can increase the timeout to wait for the server to start.

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run start',
    port: 3000,
    timeout: 120 * 1000,
  },
});
```
#### Reuse existing server

If true, it will re-use an existing server on the port or url when available. If no server is running on that port or url, it will run the command to start a new server. If false, it will throw if an existing process is listening on the port or url. This should be set to `!process.env.CI` to allow the local dev server to reuse the existing server when running tests locally but does not use an existing server on the CI. To see the stdout, you can set the `DEBUG=pw:webserver` environment variable.

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run start',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
});
```

#### URL instead of port

If `url` is specified in the config, test runner will wait for that `url` to return a 2xx, 3xx, 400, 401, 402, or 403 response before running the tests. It is also recommended to specify [`property: TestOptions.baseURL`] in the config, so that tests could use relative urls.

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000/',
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000/',
  },
});
```

Multiple web servers (or background processes) can be launched simultaneously by providing an array of `webServer` configurations. See [`property: TestConfig.webServer`] for additional examples and documentation.


## Test Options with use:{}

In addition to configuring the test runner you can also configure the [Browser] or [BrowserContext], [Emulation](#emulation-options), [Networks](#network-options) and [Recordings](#network-options). These options are passed to the `use: {}` object in the Playwright config.

### Basic Options

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Base URL to use in actions like `await page.goto('/')`.
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000'

    // populates context with given storage state.
    storageState: 'state.json',
  },
});
```


| Option | Description |
| :- | :- |
| [`property: TestOptions.baseURL`] | Base URL used for all pages in the context. Allows navigating by using just the path, for example `page.goto('/settings')`. |
| [`property: TestOptions.storageState`] | Populates context with given storage state. Useful for easy authentication, [learn more](./auth.md). |

### Emulation Options

Normally you would start with emulating a device, for example Desktop Chromium. See our [Emulation](./emulation.md) guide to learn more.

Here are some of the commonly used options for various scenarios. You usually set them globally in the [configuration file](#global-configuration).


```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Emulates `'prefers-colors-scheme'` media feature.
    colorScheme: 'dark',

    // Context geolocation
    geolocation: { longitude: 12.492507, latitude: 41.889938 },

    // Emulates the user locale.
    locale: 'en-GB',

    // Grants specified permissions to the browser context.
    permissions: 'geolocation',

    // Emulates the user timezone.
    timezoneId: 'Europe/Paris',

    // Viewport used for all pages in the context.
    viewport: { width: 1280, height: 720 },
  },
});
```

| Option | Description |
| :- | :- |
| [`property: TestOptions.colorScheme`] | Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'` |
| [`property: TestOptions.geolocation`] | Context geolocation. |
| [`property: TestOptions.locale`] | [Emulates](./emulation.md) the user locale, for example `en-GB`, `de-DE`, etc. |
| [`property: TestOptions.permissions`] | A list of permissions to grant to all pages in the context. |
| [`property: TestOptions.timezoneId`] | Changes the timezone of the context. |
| [`property: TestOptions.viewport`] | Viewport used for all pages in the context. |

### Network Options

Available options to configure networking:

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Whether to automatically download all the attachments.
    acceptDownloads: false,

    // An object containing additional HTTP headers to be sent with every request.
    httpHeaders: {
      'X-My-Header': 'value',
    },

    // Credentials for HTTP authentication.
    httpCredentials: {
      username: 'user',
      password: 'pass',
    },

    // Whether to ignore HTTPS errors during navigation.
    ignoreHTTPSErrors: true,

    // Whether to emulate network being offline.
    offline: true,

    // Proxy settings used for all pages in the test.
    proxy: {
      server: 'http://myproxy.com:3128',
      bypass: 'localhost',
    },
  },
});
```
  
| Option | Description |
| :- | :- |
| [`property: TestOptions.acceptDownloads`] | Whether to automatically download all the attachments, defaults to `true`. [Learn more](./downloads.md) about working with downloads. |
| [`property: TestOptions.extraHTTPHeaders`] | An object containing additional HTTP headers to be sent with every request. All header values must be strings. |
| [`property: TestOptions.httpCredentials`] | Credentials for [HTTP authentication](./network.md#http-authentication). |
| [`property: TestOptions.ignoreHTTPSErrors`] | Whether to ignore HTTPS errors during navigation. |
| [`property: TestOptions.offline`] | Whether to emulate network being offline. |
| [`property: TestOptions.proxy`] | [Proxy settings](./network.md#http-proxy) used for all pages in the test. |


:::note
You don't have to configure anything to mock network requests. Just define a custom [Route] that mocks network for a browser context. See our network mocking guide to learn more.
:::

### Recording Options

With Playwright you can capture screenshots, record videos aswell as traces of your test. By default these are turned off but you can enable them by setting the `screenshot`, `video` and `trace` options in your `playwright.config.js` file. 

Trace files, screenshots and videos will appear in the test output directory, typically `test-results`.

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Capture screenshot after each test failure. 
    screenshot: 'only-on-failure'

    // Record trace only when retrying a test for the first time. 
    trace: 'on-first-retry',

    // Record video only when retrying a test for the first time. 
    video: 'on-first-retry'
  },
});
```
  
| Option | Description |
| :- | :- |
| [`property: TestOptions.screenshot`] | Capture screenshots of your test. Options include `'off'`, `'on'` and `'only-on-failure'` |
| [`property: TestOptions.trace`] | Playwright Test can produce test traces while running the tests. Later on, you can view the trace and get detailed information about Playwright execution by opening [Trace Viewer](./trace-viewer.md). Options include: `'off'`, `'on'`, `'retain-on-failure'` and `'on-first-retry'`  |
| [`property: TestOptions.video`] | Playwright Test can record videos for your tests. Options include: `'off'`, `'on'`, `'retain-on-failure'` and `'on-first-retry'` |


### Other Options

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,

    // Name of the browser that runs tests. For example `chromium`, `firefox`, `webkit`.
    browserName: 'chromium',

    // toggles bypassing Content-Security-Policy
    bypassCSP: true,

    // channel to use, for example "chrome", "chrome-beta", "msedge", "msedge-beta"
    channel: 'chrome',

    // run browser in headless mode
    headless: false,

    // change the default data-testid attribute
    testIdAttribute: 'pw-test-id',
  },
});
```

| Option | Description |
| :- | :- |
| [`property: TestOptions.actionTimeout`] | Timeout for each Playwright action in milliseconds. Defaults to `0` (no timeout). Learn more about [timeouts](./test-timeouts.md) and how to set them for a single test. |
| [`property: TestOptions.browserName`] | Name of the browser that runs tests. Defaults to 'chromium'. Options include `chromium`, `firefox`, or `webkit`. |
| [`property: TestOptions.bypassCSP`] |Toggles bypassing Content-Security-Policy. Useful when CSP includes the production origin. Defaults to `false`. |
| [`property: TestOptions.channel`] | Browser channel to use. [Learn more](./browsers.md) about different browsers and channels. |
| [`property: TestOptions.headless`] | Whether to run the browser in headless mode meaning no browser is shown when running tests. Defaults to `true`. |
| [`property: TestOptions.testIdAttribute`] | Changes the default `data-testid` attribute used by Playwright locators. |

### More browser and context options

Any options accepted by [`method: BrowserType.launch`] or [`method: Browser.newContext`] can be put into `launchOptions` or `contextOptions` respectively in the `use` section. Take a look at the [m list of available options][TestOptions].

```js
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

### Explicit Context Creation and Option Inheritance

If using the built-in `browser` fixture, calling [`method: Browser.newContext`] will create a context with options inherited from the config:

```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    userAgent: 'some custom ua',
    viewport: { width: 100, height: 100 },
  },
});
```

An example test illustrating the initial context options are set:

```js
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


### Configuration Scopes

You can configure Playwright globally, per project, or per test. For example, you can set the viewport to be used globally by adding `viewport` to the `use` option of the Playwright config, and then override it for a specific project using the `project` option in the config. You can also override it for a specific test by adding `test.use({})` in the test file and passing in the options.


```js
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    viewport: { width: 1280, height: 720 },
  },
});
```

Playwright Test supports multiple **projects** so you can run your tests in multiple browsers and configurations including mobile viewports and branded browsers. Each project is given a name and a set of options. 

You can also use projects to run the same tests in different configurations. For example, you can run the same tests in a logged-in and logged-out state. Learn more about [projects](#projects).


```js
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

    /* Test against mobile viewports. */
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    },
  ],
});
```

Playwright will run all projects by default.

```bash
npx playwright test

Running 7 tests using 5 workers

  ✓ [chromium] › example.spec.ts:3:1 › basic test (2s)
  ✓ [firefox] › example.spec.ts:3:1 › basic test (2s)
  ✓ [webkit] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Mobile Chrome] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Mobile Safari] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Microsoft Edge] › example.spec.ts:3:1 › basic test (2s)
  ✓ [Google Chrome] › example.spec.ts:3:1 › basic test (2s)
```

Use the `--project` command line option to run a single project.

```bash
npx playwright test --project=firefox

Running 1 test using 1 worker

  ✓ [firefox] › example.spec.ts:3:1 › basic test (2s)
```

You can override options for a specific test file by using the `test.use()` method and passing in the options. For example to run tests in a portrait-like viewport for a specific test:

```js
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 600, height: 900 } });

test('my portrait test', async ({ page }) => {
  // ...
});
```

The same works inside a describe block. For example to run tests in a describe block with portrait-like viewport:

```js
import { test, expect } from '@playwright/test';

test.describe('portrait block', () => {

  test.use({ portrait: { width: 600, height: 900 } });

  test('my portrait test', async ({ page }) => {
    // ...
  });
});
```


