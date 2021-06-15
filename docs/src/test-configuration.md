---
id: test-configuration
title: "Configuration"
---

<!-- TOC -->

## Configure browser, context, videos and screenshots

Playwright Tests supports browser and context options that you typically pass to [`method: BrowserType.launch`] and [`method: Browser.newContext`] methods, for example `headless`, `viewport` or `ignoreHTTPSErrors`. It also provides options to record video for the test or capture screenshot at the end.

You can specify any options either locally in a test file, or globally in the configuration file.

- `launchOptions` - Browser launch options match [`method: BrowserType.launch`] method.
- `contextOptions` - Context options match [`method: Browser.newContext`] method.
- `screenshot` option - whether to capture a screenshot after each test, off by default. Screenshot will appear in the test output directory, typically `test-results`.
  - `'off'` - Do not capture screenshots.
  - `'on'` - Capture screenshot after each test.
  - `'only-on-failure'` - Capture screenshot after each test failure.
- `trace` option - whether to record trace for each test, off by default. Trace will appear in the test output directory, typically `test-results`.
  - `'off'` - Do not record trace.
  - `'on'` - Record trace for each test.
  - `'retain-on-failure'` - Record trace for each test, but remove it from successful test runs.
  - `'retry-with-trace'` - Record trace only when retrying a test.
- `video` option - whether to record video for each test, off by default. Video will appear in the test output directory, typically `test-results`.
  - `'off'` - Do not record video.
  - `'on'` - Record video for each test.
  - `'retain-on-failure'` - Record video for each test, but remove all videos from successful test runs.
  - `'retry-with-video'` - Record video only when retrying a test.


### Global configuration

Create `playwright.config.js` (or `playwright.config.ts`) and specify options in the `use` section.

```js js-flavor=js
module.exports = {
  use: {
    // Browser options
    headless: false,
    launchOptions: {
      slowMo: 50,
    },
    // Context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Artifacts
    screenshot: 'only-on-failure',
    video: 'retry-with-video',
  },
};
```

```js js-flavor=ts
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  use: {
    // Browser options
    headless: false,
    launchOptions: {
      slowMo: 50,
    },

    // Context options
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    // Artifacts
    screenshot: 'only-on-failure',
    video: 'retry-with-video',
  },
};
export default config;
```

Now run tests as usual, Playwright Test will pick up the configuration file automatically.

```bash
npx playwright test --browser=firefox
```

If you put your configuration file in a different place, pass it with `--config` option.

```bash
npx playwright test --config=tests/my.config.js
```

### Local configuration

With `test.use()` you can override some options for a file or a `test.describe` block.

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

The same works inside describe.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test.describe('headed block', () => {
  // Run tests in this describe block in headed mode.
  test.use({ headless: false });

  test('my headed test', async ({ page }) => {
    // ...
  });
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test.describe('headed block', () => {
  // Run tests in this describe block in headed mode.
  test.use({ headless: false });

  test('my headed test', async ({ page }) => {
    // ...
  });
});
```

## Testing options

In addition to configuring [Browser] or [BrowserContext], videos or screenshots, Playwright Test has many options to configure how your tests are run. Below are the most common ones, see [advanced configuration](./test-advanced.md) for the full list.

- `forbidOnly`: Whether to exit with an error if any tests are marked as `test.only`. Useful on CI.
- `globalSetup`: Path to the global setup file. This file will be required and run before all the tests. It must export a single function.
- `globalTeardown`: Path to the global teardown file. This file will be required and run after all the tests. It must export a single function.
- `retries`: The maximum number of retry attempts per test.
- `testDir`: Directory with the test files.
- `testIgnore`: Glob patterns or regular expressions that should be ignored when looking for the test files. For example, `'**/test-assets'`.
- `testMatch`: Glob patterns or regular expressions that match test files. For example, `'**/todo-tests/*.spec.ts'`. By default, Playwright Test runs `.*(test|spec)\.(js|ts|mjs)` files.
- `timeout`: Time in milliseconds given to each test.
- `workers`: The maximum number of concurrent worker processes to use for parallelizing tests.

You can specify these options in the configuration file.

```js js-flavor=js
// playwright.config.js
module.exports = {
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
};
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
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
};
export default config;
```

## Different options for each browser

To specify different options per browser, for example command line arguments for Chromium, create multiple projects in your configuration file. Below is an example that runs all tests in three browsers, with different options.

```js js-flavor=js
// playwright.config.js
module.exports = {
  // Put any shared options on the top level.
  use: {
    headless: true,
  },

  projects: [
    {
      name: 'Chromium',
      use: {
        // Configure the browser to use.
        browserName: 'chromium',

        // Any Chromium-specific options.
        viewport: { width: 600, height: 800 },
      },
    },

    {
      name: 'Firefox',
      use: { browserName: 'firefox' },
    },

    {
      name: 'WebKit',
      use: { browserName: 'webkit' },
    },
  ],
};
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // Put any shared options on the top level.
  use: {
    headless: true,
  },

  projects: [
    {
      name: 'Chromium',
      use: {
        // Configure the browser to use.
        browserName: 'chromium',

        // Any Chromium-specific options.
        viewport: { width: 600, height: 800 },
      },
    },

    {
      name: 'Firefox',
      use: { browserName: 'firefox' },
    },

    {
      name: 'WebKit',
      use: { browserName: 'webkit' },
    },
  ],
};
export default config;
```

Playwright Test will run all projects by default.

```bash
$ npx playwright test

Running 3 tests using 3 workers

  ✓ example.spec.ts:3:1 › [Chromium] should work (2s)
  ✓ example.spec.ts:3:1 › [Firefox] should work (2s)
  ✓ example.spec.ts:3:1 › [WebKit] should work (2s)
```

Use `--project` command line option to run a single project.

```bash
$ npx playwright test --project=webkit

Running 1 test using 1 worker

  ✓ example.spec.ts:3:1 › [WebKit] should work (2s)
```

There are many more things you can do with projects:
- Run a subset of test by specifying different `testDir` for each project.
- Run tests in multiple configurations, for example with desktop Chromium and emulating Chrome for Android.
- Run "core" tests without retries to ensure stability of the core functionality, and use `retries` for other tests.
- And much more! See [advanced configuration](./test-advanced.md) for more details.

:::note
`--browser` command line option is not compatible with projects. Specify `browserName` in each project instead.
:::

## Mobile emulation

You can use configuration file to make default `context` emulate a mobile device.

Here is an example configuration that runs tests in "Pixel 4" and "iPhone 11" emulation modes. Note that it uses the [projects](./test-advanced.md#projects) feature to run the same set of tests in multiple configurations.

```js js-flavor=js
// playwright.config.js
const { devices } = require('playwright');

module.exports = {
  projects: [
    // "Pixel 4" tests use Chromium browser.
    {
      name: 'Pixel 4',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 4'],
      },
    },

    // "iPhone 11" tests use WebKit browser.
    {
      name: 'iPhone 11',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 11'],
      },
    },
  ],
};
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
import { devices } from 'playwright';

const config: PlaywrightTestConfig = {
  projects: [
    // "Pixel 4" tests use Chromium browser.
    {
      name: 'Pixel 4',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 4'],
      },
    },

    // "iPhone 11" tests use WebKit browser.
    {
      name: 'iPhone 11',
      use: {
        browserName: 'webkit',
        ...devices['iPhone 11'],
      },
    },
  ],
};
export default config;
```

## Network mocking

You don't have to configure anything to mock network requests. Just define a custom [Route] that mocks network for a browser context.

```js js-flavor=js
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

```js js-flavor=ts
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

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test('loads page without images', async ({ page }) => {
  // Block png and jpeg images.
  await page.route(/(png|jpeg)$/, route => route.abort());

  await page.goto('https://playwright.dev');
  // ... test goes here
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test('loads page without images', async ({ page }) => {
  // Block png and jpeg images.
  await page.route(/(png|jpeg)$/, route => route.abort());

  await page.goto('https://playwright.dev');
  // ... test goes here
});
```
