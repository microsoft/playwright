---
id: test-runner-configuration
title: "Configuration"
---

<!-- TOC -->

## Modify options

You can modify browser launch options, context creation options and testing options either globally in the configuration file, or locally in the test file.

Playwright test runner is based on the [Folio] framework, so it supports any configuration available in Folio, and adds a lot of Playwright-specific options.

### Globally in the configuration file

You can specify different options for each browser using projects in the configuration file. Below is an example that changes some global testing options, and Chromium browser configuration.

```js
// config.ts
import { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  // Each test is given 90 seconds.
  timeout: 90000,
  // Failing tests will be retried at most two times.
  retries: 2,
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',

        // Launch options
        headless: false,
        slowMo: 50,

        // Context options
        viewport: { width: 800, height: 600 },
        ignoreHTTPSErrors: true,

        // Testing options
        video: 'retain-on-failure',
      },
    },
  ],
};
export default config;
```

### Locally in the test file

With `test.use()` you can override some options for a file, or a `describe` block.

```js
// my.spec.ts
import { test, expect } from "@playwright/test";

// Run tests in this file with portrait-like viewport.
test.use({ viewport: { width: 600, height: 900 } });

test('my test', async ({ page }) => {
  // Test code goes here.
});
```

### Available options

See the full list of launch options in [`browserType.launch()`](https://playwright.dev/docs/api/class-browsertype#browsertypelaunchoptions) documentation.

See the full list of context options in [`browser.newContext()`](https://playwright.dev/docs/api/class-browser#browsernewcontextoptions) documentation.

Available testing options:
- `screenshot: 'off' | 'on' | 'only-on-failure'` - Whether to capture a screenshot after each test, off by default.
  - `off` - Do not capture screenshots.
  - `on` - Capture screenshot after each test.
  - `only-on-failure` - Capture screenshot after each test failure.
- `video: 'off' | 'on' | 'retain-on-failure' | 'retry-with-video'` - Whether to record video for each test, off by default.
  - `off` - Do not record video.
  - `on` - Record video for each test.
  - `retain-on-failure`  - Record video for each test, but remove all videos from successful test runs.
  - `retry-with-video` - Record video only when retrying a test.

Most notable testing options from [Folio documentation][folio]:
- `reporter: 'dot' | 'line' | 'list'` - Choose a reporter: minimalist `dot`, concise `line` or detailed `list`. See [Folio reporters][folio-reporters] for more details.
- `retries: number` - Each failing test will be retried up to the certain number of times.
- `testDir: string` - Directory where test runner should search for test files.
- `timeout: number` - Timeout in milliseconds for each test.
- `workers: number` - The maximum number of worker processes to run in parallel.

## Skip tests with annotations

The Playwright test runner can annotate tests to skip under certain parameters. This is enabled by [Folio annotations][folio-annotations].

```js
test("should be skipped on firefox", async ({ page, browserName }) => {
  test.skip(browserName === "firefox", "optional description for the skip");
  // Test function
});
```

## Run tests in parallel

Tests are run in parallel by default, using multiple worker processes. You can control the parallelism with the `workers` option in the configuration file or from the command line.

```sh
# Run just a single test at a time - no parallelization
npx folio --workers=1

# Run up to 10 tests in parallel
npx folio --workers=10
```

```js
// config.ts
import { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  // No parallelization on CI, default value locally.
  worker: process.env.CI ? 1 : undefined,
  projects: [
    // Your projects go here
  ],
};
export default config;
```

By default, test runner chooses the number of workers based on available CPUs.

## Reporters

Playwright test runner comes with a few built-in reporters for different needs and ability to provide custom reporters. The easiest way to try out built-in reporters is to pass `--reporter` [command line option](#command-line). Built-in terminal reporters are minimalist `dot`, concise `line` and detailed `list`.

```sh
npx folio --reporter=line
npx folio --reporter=dot
npx folio --reporter=list
```

Alternatively, you can specify the reporter in the configuration file.
```js
// config.ts
import { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  // Concise 'dot' on CI, more interactive 'list' when running locally
  reporter: process.env.CI ? 'dot' : 'line',
  projects: [
    // Your projects go here
  ],
};
export default config;
```

### Export JUnit or JSON report

The Playwright test runner includes reporters that produce a JUnit compatible XML file or a JSON file with test results.

```js
// config.ts
import { PlaywrightTestConfig } from "@playwright/test";

const config: PlaywrightTestConfig = {
  reporter: [
    // Live output to the terminal
    'list',
    // JUnit compatible xml report
    { name: 'junit', outputFile: 'report.xml' },
    // JSON file with test results
    { name: 'json', outputFile: 'report.json' },
  ]
  projects: [
    // Your projects go here
  ],
};
export default config;
```

[folio]: https://github.com/microsoft/folio
[folio-annotations]: https://github.com/microsoft/folio#annotations
[folio-cli]: https://github.com/microsoft/folio#command-line
[folio-reporters]: https://github.com/microsoft/folio#reporters
