# class: TestProject
* since: v1.10
* langs: js

Playwright Test supports running multiple test projects at the same time. This is useful for running tests in multiple configurations. For example, consider running tests against multiple browsers. This type describes format of a project in the configuration file, to access resolved configuration parameters at run time use [FullProject].

`TestProject` encapsulates configuration specific to a single project. Projects are configured in [`property: TestConfig.projects`] specified in the [configuration file](../test-configuration.md). Note that all properties of [TestProject] are available in the top-level [TestConfig], in which case they are shared between all projects.

Here is an example configuration that runs every test in Chromium, Firefox and WebKit, both Desktop and Mobile versions.

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Options shared for all projects.
  timeout: 30000,
  use: {
    ignoreHTTPSErrors: true,
  },

  // Options specific to each project.
  projects: [
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
    },
    {
      name: 'firefox',
      use: devices['Desktop Firefox'],
    },
    {
      name: 'webkit',
      use: devices['Desktop Safari'],
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
});
```

## property: TestProject.dependencies
* since: v1.31
- type: ?<[Array]<[string]>>

List of projects that need to run before any test in this project runs. Dependencies can
be useful for configuring the global setup actions in a way that every action is
in a form of a test. Passing `--no-deps` argument ignores the dependencies and
behaves as if they were not specified.

Using dependencies allows global setup to produce traces and other artifacts,
see the setup steps in the test report, etc.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: /global.setup\.ts/,
    },
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: devices['Desktop Firefox'],
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: devices['Desktop Safari'],
      dependencies: ['setup'],
    },
  ],
});
```

## property: TestProject.expect
* since: v1.10
- type: ?<[Object]>
  - `timeout` ?<[int]> Default timeout for async expect matchers in milliseconds, defaults to 5000ms.
  - `toHaveScreenshot` ?<[Object]> Configuration for the [`method: PageAssertions.toHaveScreenshot#1`] method.
    - `threshold` ?<[float]> an acceptable perceived color difference between the same pixel in compared images, ranging from `0` (strict) and `1` (lax). `"pixelmatch"` comparator computes color difference in [YIQ color space](https://en.wikipedia.org/wiki/YIQ) and defaults `threshold` value to `0.2`.
    - `maxDiffPixels` ?<[int]> an acceptable amount of pixels that could be different, unset by default.
    - `maxDiffPixelRatio` ?<[float]> an acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1` , unset by default.
    - `animations` ?<[ScreenshotAnimations]<"allow"|"disabled">> See [`option: animations`] in [`method: Page.screenshot`]. Defaults to `"disabled"`.
    - `caret` ?<[ScreenshotCaret]<"hide"|"initial">> See [`option: caret`] in [`method: Page.screenshot`]. Defaults to `"hide"`.
    - `scale` ?<[ScreenshotScale]<"css"|"device">> See [`option: scale`] in [`method: Page.screenshot`]. Defaults to `"css"`.
    - `stylePath` ?<[string]|[Array]<[string]>> See [`option: style`] in [`method: Page.screenshot`].
  - `toMatchSnapshot` ?<[Object]> Configuration for the [`method: SnapshotAssertions.toMatchSnapshot#1`] method.
    - `threshold` ?<[float]> an acceptable perceived color difference between the same pixel in compared images, ranging from `0` (strict) and `1` (lax). `"pixelmatch"` comparator computes color difference in [YIQ color space](https://en.wikipedia.org/wiki/YIQ) and defaults `threshold` value to `0.2`.
    - `maxDiffPixels` ?<[int]> an acceptable amount of pixels that could be different, unset by default.
    - `maxDiffPixelRatio` ?<[float]> an acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1` , unset by default.
  - `toPass` ?<[Object]> Configuration for the [expect(value).toPass()](../test-assertions.md) method.
    - `timeout` ?<[int]> timeout for toPass method in milliseconds.
    - `intervals` ?<[Array]<[int]>> probe intervals for toPass method in milliseconds.

Configuration for the `expect` assertion library.

Use [`property: TestConfig.expect`] to change this option for all projects.

## property: TestProject.fullyParallel
* since: v1.10
- type: ?<[boolean]>

Playwright Test runs tests in parallel. In order to achieve that, it runs several worker processes that run at the same time.
By default, **test files** are run in parallel. Tests in a single file are run in order, in the same worker process.

You can configure entire test project to concurrently run all tests in all files using this option.

## property: TestProject.grep
* since: v1.10
- type: ?<[RegExp]|[Array]<[RegExp]>>

Filter to only run tests with a title matching one of the patterns. For example, passing `grep: /cart/` should only run tests with "cart" in the title. Also available globally and in the [command line](../test-cli.md) with the `-g` option. The regular expression will be tested against the string that consists of the project name, the test file name, the `test.describe` name (if any), the test name and the test tags divided by spaces, e.g. `chromium my-test.spec.ts my-suite my-test`.

`grep` option is also useful for [tagging tests](../test-annotations.md#tag-tests).

## property: TestProject.grepInvert
* since: v1.10
- type: ?<[RegExp]|[Array]<[RegExp]>>

Filter to only run tests with a title **not** matching one of the patterns. This is the opposite of [`property: TestProject.grep`]. Also available globally and in the [command line](../test-cli.md) with the `--grep-invert` option.

`grepInvert` option is also useful for [tagging tests](../test-annotations.md#tag-tests).

## property: TestProject.ignoreSnapshots
* since: v1.44
- type: ?<[boolean]>

Whether to skip snapshot expectations, such as `expect(value).toMatchSnapshot()` and `await expect(page).toHaveScreenshot()`.

**Usage**

The following example will only perform screenshot assertions on Chromium.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
    },
    {
      name: 'firefox',
      use: devices['Desktop Firefox'],
      ignoreSnapshots: true,
    },
    {
      name: 'webkit',
      use: devices['Desktop Safari'],
      ignoreSnapshots: true,
    },
  ],
});
```

## property: TestProject.metadata
* since: v1.10
- type: ?<[Metadata]>

Metadata that will be put directly to the test report serialized as JSON.

## property: TestProject.name
* since: v1.10
- type: ?<[string]>

Project name is visible in the report and during test execution.

## property: TestProject.snapshotDir
* since: v1.10
- type: ?<[string]>

The base directory, relative to the config file, for snapshot files created with `toMatchSnapshot`. Defaults to [`property: TestProject.testDir`].

The directory for each test can be accessed by [`property: TestInfo.snapshotDir`] and [`method: TestInfo.snapshotPath`].

This path will serve as the base directory for each test file snapshot directory. Setting `snapshotDir` to `'snapshots'`, the [`property: TestInfo.snapshotDir`] would resolve to `snapshots/a.spec.js-snapshots`.

## property: TestProject.snapshotPathTemplate = %%-test-config-snapshot-path-template-%%
* since: v1.28

## property: TestProject.outputDir
* since: v1.10
- type: ?<[string]>

The output directory for files created during test execution. Defaults to `<package.json-directory>/test-results`.

This directory is cleaned at the start. When running a test, a unique subdirectory inside the [`property: TestProject.outputDir`] is created, guaranteeing that test running in parallel do not conflict. This directory can be accessed by [`property: TestInfo.outputDir`] and [`method: TestInfo.outputPath`].

Here is an example that uses [`method: TestInfo.outputPath`] to create a temporary file.

```js
import { test, expect } from '@playwright/test';
import fs from 'fs';

test('example test', async ({}, testInfo) => {
  const file = testInfo.outputPath('temporary-file.txt');
  await fs.promises.writeFile(file, 'Put some data to the file', 'utf8');
});
```

Use [`property: TestConfig.outputDir`] to change this option for all projects.

## property: TestProject.repeatEach
* since: v1.10
- type: ?<[int]>

The number of times to repeat each test, useful for debugging flaky tests.

Use [`property: TestConfig.repeatEach`] to change this option for all projects.

## property: TestProject.respectGitIgnore
* since: v1.45
- type: ?<[boolean]>

Whether to skip entries from `.gitignore` when searching for test files. By default, if neither [`property: TestConfig.testDir`] nor [`property: TestProject.testDir`] are explicitly specified, Playwright will ignore any test files matching `.gitignore` entries. This option allows to override that behavior.

## property: TestProject.retries
* since: v1.10
- type: ?<[int]>

The maximum number of retry attempts given to failed tests. Learn more about [test retries](../test-retries.md#retries).

Use [`method: Test.describe.configure`] to change the number of retries for a specific file or a group of tests.

Use [`property: TestConfig.retries`] to change this option for all projects.


## property: TestProject.teardown
* since: v1.34
- type: ?<[string]>

Name of a project that needs to run after this and all dependent projects have finished. Teardown is useful to cleanup any resources acquired by this project.

Passing `--no-deps` argument ignores [`property: TestProject.teardown`] and behaves as if it was not specified.

**Usage**

A common pattern is a "setup" dependency that has a corresponding "teardown":

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'setup',
      testMatch: /global.setup\.ts/,
      teardown: 'teardown',
    },
    {
      name: 'teardown',
      testMatch: /global.teardown\.ts/,
    },
    {
      name: 'chromium',
      use: devices['Desktop Chrome'],
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: devices['Desktop Firefox'],
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: devices['Desktop Safari'],
      dependencies: ['setup'],
    },
  ],
});
```

## property: TestProject.testDir
* since: v1.10
- type: ?<[string]>

Directory that will be recursively scanned for test files. Defaults to the directory of the configuration file.

Each project can use a different directory. Here is an example that runs smoke tests in three browsers and all other tests in stable Chrome browser.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
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
});
```

Use [`property: TestConfig.testDir`] to change this option for all projects.

## property: TestProject.testIgnore
* since: v1.10
- type: ?<[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Files matching one of these patterns are not executed as test files. Matching is performed against the absolute file path. Strings are treated as glob patterns.

For example, `'**/test-assets/**'` will ignore any files in the `test-assets` directory.

Use [`property: TestConfig.testIgnore`] to change this option for all projects.

## property: TestProject.testMatch
* since: v1.10
- type: ?<[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Only the files matching one of these patterns are executed as test files. Matching is performed against the absolute file path. Strings are treated as glob patterns.

By default, Playwright looks for files matching the following glob pattern: `**/*.@(spec|test).?(c|m)[jt]s?(x)`. This means JavaScript or TypeScript files with `".test"` or `".spec"` suffix, for example `login-screen.wrong-credentials.spec.ts`.

Use [`property: TestConfig.testMatch`] to change this option for all projects.

## property: TestProject.timeout
* since: v1.10
- type: ?<[int]>

Timeout for each test in milliseconds. Defaults to 30 seconds.

This is a base timeout for all tests. Each test can configure its own timeout with [`method: Test.setTimeout`]. Each file or a group of tests can configure the timeout with [`method: Test.describe.configure`].

Use [`property: TestConfig.timeout`] to change this option for all projects.

## property: TestProject.use
* since: v1.10
- type: ?<[TestOptions]>

Options for all tests in this project, for example [`property: TestOptions.browserName`]. Learn more about [configuration](../test-configuration.md) and see [available options][TestOptions].

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'Chromium',
      use: {
        browserName: 'chromium',
      },
    },
  ],
});
```

Use [`property: TestConfig.use`] to change this option for all projects.
