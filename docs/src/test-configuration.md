---
id: test-configuration
title: "Configuration"
---

<!-- TOC -->

<br/>

## Configuration object

Configuration file exports a single configuration object.

You can modify browser launch options, context creation options and testing options either globally in the configuration file, or locally in the test file.

See the full list of launch options in [`browserType.launch()`](https://playwright.dev/docs/api/class-browsertype#browsertypelaunchoptions) documentation.

See the full list of context options in [`browser.newContext()`](https://playwright.dev/docs/api/class-browser#browsernewcontextoptions) documentation.

```js
// pwtest.config.ts
import { PlaywrightTestConfig } from 'playwright/test';

const config: PlaywrightTestConfig = {
  // 20 seconds per test.
  timeout: 20000,

  // Forbid test.only on CI.
  forbidOnly: !!process.env.CI,

  // Two retries for each test.
  retries: 2,
});
export default config;
```

## Global configuration

You can specify different options for each browser using projects in the configuration file. Below is an example that changes some global testing options, and Chromium browser configuration.

```js
// config.ts
import { PlaywrightTestConfig } from "playwright/test";

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

## Local configuration

With `test.use()` you can override some options for a file, or a `describe` block.

```js
// my.spec.ts
import { test, expect } from "playwright/test";

// Run tests in this file with portrait-like viewport.
test.use({ viewport: { width: 600, height: 900 } });

test('my test', async ({ page }) => {
  // Test code goes here.
});
```

## Test Options

- `metadata: any` - Any JSON-serializable metadata that will be put directly to the test report.
- `name: string` - Project name, useful when defining multiple [test projects](#projects).
- `outputDir: string` - Output directory for files created during the test run.
- `repeatEach: number` - The number of times to repeat each test, useful for debugging flaky tests. Overridden by `--repeat-each` command line option.
- `retries: number` - The maximum number of retry attempts given to failed tests. Overridden by `--retries` command line option.
- `screenshot: 'off' | 'on' | 'only-on-failure'` - Whether to capture a screenshot after each test, off by default.
  - `off` - Do not capture screenshots.
  - `on` - Capture screenshot after each test.
  - `only-on-failure` - Capture screenshot after each test failure.
- `snapshotDir: string` - [Snapshots](#snapshots) directory. Overridden by `--snapshot-dir` command line option.
- `testDir: string` - Directory that will be recursively scanned for test files.
- `testIgnore: string | RegExp | (string | RegExp)[]` - Files matching one of these patterns are not considered test files.
- `testMatch: string | RegExp | (string | RegExp)[]` - Only the files matching one of these patterns are considered test files.
- `timeout: number` - Timeout for each test in milliseconds. Overridden by `--timeout` command line option.
- `video: 'off' | 'on' | 'retain-on-failure' | 'retry-with-video'` - Whether to record video for each test, off by default.
  - `off` - Do not record video.
  - `on` - Record video for each test.
  - `retain-on-failure`  - Record video for each test, but remove all videos from successful test runs.
  - `retry-with-video` - Record video only when retrying a test.

## Test run options

These options would be typically different between local development and CI operation:

- `forbidOnly: boolean` - Whether to exit with an error if any tests are marked as `test.only`. Useful on CI. Overridden by `--forbid-only` command line option.
- `globalSetup: string` - Path to the global setup file. This file will be required and run before all the tests. It must export a single function.
- `globalTeardown: string` - Path to the global teardown file. This file will be required and run after all the tests. It must export a single function.
- `globalTimeout: number` - Total timeout in milliseconds for the whole test run. Overridden by `--global-timeout` command line option.
- `grep: RegExp | RegExp[]` - Patterns to filter tests based on their title. Overridden by `--grep` command line option.
- `maxFailures: number` - The maximum number of test failures for this test run. After reaching this number, testing will stop and exit with an error. Setting to zero (default) disables this behavior. Overridden by `--max-failures` and `-x` command line options.
- `preserveOutput: 'always' | 'never' | 'failures-only'` - Whether to preserve test output in the `outputDir`:
  - `'always'` - preserve output for all tests;
  - `'never'` - do not preserve output for any tests;
  - `'failures-only'` - only preserve output for failed tests.
- `projects: Project[]` - Multiple [projects](#projects) configuration.
- `reporter: 'list' | 'line' | 'dot' | 'json' | 'junit'` - The reporter to use. See [reporters](#reporters) for details.
- `quiet: boolean` - Whether to suppress stdout and stderr from the tests. Overridden by `--quiet` command line option.
- `shard: { total: number, current: number } | null` - [Shard](#shards) information. Overridden by `--shard` command line option.
- `updateSnapshots: boolean` - Whether to update expected snapshots with the actual results produced by the test run. Overridden by `--update-snapshots` command line option.
- `workers: number` - The maximum number of concurrent worker processes to use for parallelizing tests. Overridden by `--workers` command line option.