# class: TestProject
* langs: js

Playwright Test supports running multiple test projects at the same time. This is useful for running tests in multiple configurations. For example, consider running tests against multiple browsers.

`TestProject` encapsulates configuration specific to a single project. Projects are configured in [`property: TestConfig.projects`] specified in the [configuration file](../test-configuration.md). Note that all properties of [TestProject] are available in the top-level [TestConfig], in which case they are shared between all projects.

Here is an example configuration that runs every test in Chromium, Firefox and WebKit, both Desktop and Mobile versions.

```js js-flavor=js
// playwright.config.js
// @ts-check
const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  // Options shared for all projects.
  timeout: 30000,
  use: {
    ignoreHTTPSErrors: true,
  },

  // Options specific to each project.
  projects: [
    {
      name: 'Desktop Chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Desktop Safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 1280, height: 720 },
      }
    },
    {
      name: 'Desktop Firefox',
      use: {
        browserName: 'firefox',
        viewport: { width: 1280, height: 720 },
      }
    },
    {
      name: 'Mobile Chrome',
      use: devices['Pixel 5'],
    },
    {
      name: 'Mobile Safari',
      use: devices['iPhone 12'],
    },
  ],
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // Options shared for all projects.
  timeout: 30000,
  use: {
    ignoreHTTPSErrors: true,
  },

  // Options specific to each project.
  projects: [
    {
      name: 'Desktop Chromium',
      use: {
        browserName: 'chromium',
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'Desktop Safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 1280, height: 720 },
      }
    },
    {
      name: 'Desktop Firefox',
      use: {
        browserName: 'firefox',
        viewport: { width: 1280, height: 720 },
      }
    },
    {
      name: 'Mobile Chrome',
      use: devices['Pixel 5'],
    },
    {
      name: 'Mobile Safari',
      use: devices['iPhone 12'],
    },
  ],
};
export default config;
```

## property: TestProject.expect
- type: ?<[Object]>
  - `timeout` ?<[int]> Default timeout for async expect matchers in milliseconds, defaults to 5000ms.
  - `toHaveScreenshot` ?<[Object]> Configuration for the [`method: PageAssertions.toHaveScreenshot#1`] method.
    - `threshold` ?<[float]> an acceptable perceived color difference in the [YIQ color space](https://en.wikipedia.org/wiki/YIQ) between the same pixel in compared images, between zero (strict) and one (lax). Defaults to `0.2`.
    - `maxDiffPixels` ?<[int]> an acceptable amount of pixels that could be different, unset by default.
    - `maxDiffPixelRatio` ?<[float]> an acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1` , unset by default.
    - `animations` ?<[ScreenshotAnimations]<"allow"|"disabled">> See [`option: animations`] in [`method: Page.screenshot`]. Defaults to `"disabled"`.
    - `caret` ?<[ScreenshotCaret]<"hide"|"initial">> See [`option: caret`] in [`method: Page.screenshot`]. Defaults to `"hide"`.
    - `scale` ?<[ScreenshotScale]<"css"|"device">> See [`option: scale`] in [`method: Page.screenshot`]. Defaults to `"css"`.
  - `toMatchSnapshot` ?<[Object]> Configuration for the [`method: ScreenshotAssertions.toMatchSnapshot#1`] method.
    - `threshold` ?<[float]> an acceptable perceived color difference in the [YIQ color space](https://en.wikipedia.org/wiki/YIQ) between the same pixel in compared images, between zero (strict) and one (lax). Defaults to `0.2`.
    - `maxDiffPixels` ?<[int]> an acceptable amount of pixels that could be different, unset by default.
    - `maxDiffPixelRatio` ?<[float]> an acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1` , unset by default.

Configuration for the `expect` assertion library.

Use [`property: TestConfig.expect`] to change this option for all projects.

## property: TestProject.fullyParallel
- type: ?<[boolean]>

Playwright Test runs tests in parallel. In order to achieve that, it runs several worker processes that run at the same time.
By default, **test files** are run in parallel. Tests in a single file are run in order, in the same worker process.

You can configure entire test project to concurrently run all tests in all files using this option.

## property: TestProject.grep
- type: ?<[RegExp]|[Array]<[RegExp]>>

Filter to only run tests with a title matching one of the patterns. For example, passing `grep: /cart/` should only run tests with "cart" in the title. Also available globally and in the [command line](../test-cli.md) with the `-g` option.

`grep` option is also useful for [tagging tests](../test-annotations.md#tag-tests).

## property: TestProject.grepInvert
- type: ?<[RegExp]|[Array]<[RegExp]>>

Filter to only run tests with a title **not** matching one of the patterns. This is the opposite of [`property: TestProject.grep`]. Also available globally and in the [command line](../test-cli.md) with the `--grep-invert` option.

`grepInvert` option is also useful for [tagging tests](../test-annotations.md#tag-tests).

## property: TestProject.metadata
- type: ?<[Metadata]>

Metadata that will be put directly to the test report serialized as JSON.

## property: TestProject.name
- type: ?<[string]>

Project name is visible in the report and during test execution.


## property: TestProject.screenshotsDir
* experimental
- type: ?<[string]>

The base directory, relative to the config file, for screenshot files created with `toHaveScreenshot`. Defaults to

```
<directory-of-configuration-file>/__screenshots__/<platform name>/<project name>
```

This path will serve as the base directory for each test file screenshot directory. For example, the following test structure:

```
smoke-tests/
└── basic.spec.ts
```

will result in the following screenshots folder structure:

```
__screenshots__/
└── darwin/
    ├── Mobile Safari/
    │   └── smoke-tests/
    │       └── basic.spec.ts/
    │           └── screenshot-expectation.png
    └── Desktop Chrome/
        └── smoke-tests/
            └── basic.spec.ts/
                └── screenshot-expectation.png
```

where:
* `darwin/` - a platform name folder
* `Mobile Safari` and `Desktop Chrome` - project names


## property: TestProject.snapshotDir
- type: ?<[string]>

The base directory, relative to the config file, for snapshot files created with `toMatchSnapshot`. Defaults to [`property: TestProject.testDir`].

The directory for each test can be accessed by [`property: TestInfo.snapshotDir`] and [`method: TestInfo.snapshotPath`].

This path will serve as the base directory for each test file snapshot directory. Setting `snapshotDir` to `'snapshots'`, the [`property: TestInfo.snapshotDir`] would resolve to `snapshots/a.spec.js-snapshots`.

## property: TestProject.outputDir
- type: ?<[string]>

The output directory for files created during test execution. Defaults to `<package.json-directory>/test-results`.

This directory is cleaned at the start. When running a test, a unique subdirectory inside the [`property: TestProject.outputDir`] is created, guaranteeing that test running in parallel do not conflict. This directory can be accessed by [`property: TestInfo.outputDir`] and [`method: TestInfo.outputPath`].

Here is an example that uses [`method: TestInfo.outputPath`] to create a temporary file.

```js js-flavor=js
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test('example test', async ({}, testInfo) => {
  const file = testInfo.outputPath('temporary-file.txt');
  await fs.promises.writeFile(file, 'Put some data to the file', 'utf8');
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';
import fs from 'fs';

test('example test', async ({}, testInfo) => {
  const file = testInfo.outputPath('temporary-file.txt');
  await fs.promises.writeFile(file, 'Put some data to the file', 'utf8');
});
```

Use [`property: TestConfig.outputDir`] to change this option for all projects.

## property: TestProject.repeatEach
- type: ?<[int]>

The number of times to repeat each test, useful for debugging flaky tests.

Use [`property: TestConfig.repeatEach`] to change this option for all projects.

## property: TestProject.retries
- type: ?<[int]>

The maximum number of retry attempts given to failed tests. Learn more about [test retries](../test-retries.md#retries).

Use [`property: TestConfig.retries`] to change this option for all projects.

## property: TestProject.testDir
- type: ?<[string]>

Directory that will be recursively scanned for test files. Defaults to the directory of the configuration file.

Each project can use a different directory. Here is an example that runs smoke tests in three browsers and all other tests in stable Chrome browser.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  projects: [
    {
      name: 'Smoke Chromium',
      testDir: './smoke-tests',
      use: {
        browserName: 'chromium',
      }
    },
    {
      name: 'Smoke WebKit',
      testDir: './smoke-tests',
      use: {
        browserName: 'webkit',
      }
    },
    {
      name: 'Smoke Firefox',
      testDir: './smoke-tests',
      use: {
        browserName: 'firefox',
      }
    },
    {
      name: 'Chrome Stable',
      testDir: './',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
      }
    },
  ],
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  projects: [
    {
      name: 'Smoke Chromium',
      testDir: './smoke-tests',
      use: {
        browserName: 'chromium',
      }
    },
    {
      name: 'Smoke WebKit',
      testDir: './smoke-tests',
      use: {
        browserName: 'webkit',
      }
    },
    {
      name: 'Smoke Firefox',
      testDir: './smoke-tests',
      use: {
        browserName: 'firefox',
      }
    },
    {
      name: 'Chrome Stable',
      testDir: './',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
      }
    },
  ],
};
export default config;
```

Use [`property: TestConfig.testDir`] to change this option for all projects.

## property: TestProject.testIgnore
- type: ?<[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Files matching one of these patterns are not executed as test files. Matching is performed against the absolute file path. Strings are treated as glob patterns.

For example, `'**/test-assets/**'` will ignore any files in the `test-assets` directory.

Use [`property: TestConfig.testIgnore`] to change this option for all projects.

## property: TestProject.testMatch
- type: ?<[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Only the files matching one of these patterns are executed as test files. Matching is performed against the absolute file path. Strings are treated as glob patterns.

By default, Playwright Test looks for files matching `.*(test|spec)\.(js|ts|mjs)`.

Use [`property: TestConfig.testMatch`] to change this option for all projects.

## property: TestProject.timeout
- type: ?<[int]>

Timeout for each test in milliseconds. Defaults to 30 seconds.

This is a base timeout for all tests. In addition, each test can configure its own timeout with [`method: Test.setTimeout`].

Use [`property: TestConfig.timeout`] to change this option for all projects.

## property: TestProject.use
- type: <[Fixtures]>

Options for all tests in this project, for example [`property: TestOptions.browserName`]. Learn more about [configuration](../test-configuration.md) and see [available options][TestOptions].

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  projects: [
    {
      name: 'Chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  projects: [
    {
      name: 'Chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
};
export default config;
```

Use [`property: TestConfig.use`] to change this option for all projects.
