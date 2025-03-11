# class: TestConfig
* since: v1.10
* langs: js

Playwright Test provides many options to configure how your tests are collected and executed, for example `timeout` or `testDir`. These options are described in the [TestConfig] object in the [configuration file](../test-configuration.md). This type describes format of the configuration file, to access resolved configuration parameters at run time use [FullConfig].

Playwright Test supports running multiple test projects at the same time. Project-specific options should be put to [`property: TestConfig.projects`], but top-level [TestConfig] can also define base options shared between all projects.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 30000,
  globalTimeout: 600000,
  reporter: 'list',
  testDir: './tests',
});
```

## property: TestConfig.build
* since: v1.35
- type: ?<[Object]>
  - `external` ?<[Array]<[string]>> Paths to exclude from the transpilation expressed as a list of glob patterns. Typically heavy JS bundles that your test uses are listed here.

Playwright transpiler configuration.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  build: {
    external: ['**/*bundle.js'],
  },
});
```

## property: TestConfig.captureGitInfo
* since: v1.51
- type: ?<[Object]>
  - `commit` ?<boolean> Whether to capture commit and pull request information such as hash, author, timestamp.
  - `diff` ?<boolean> Whether to capture commit diff.

These settings control whether git information is captured and stored in the config [`property: TestConfig.metadata`].

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  captureGitInfo: { commit: true, diff: true }
});
```

**Details**

* Capturing `commit` information is useful when you'd like to see it in your HTML (or a third party) report.
* Capturing `diff` information is useful to enrich the report with the actual source diff. This information can be used to provide intelligent advice on how to fix the test.

:::note
Default values for these settings depend on the environment. When tests run as a part of CI where it is safe to obtain git information, the default value is `true`, `false` otherwise.
:::

:::note
The structure of the git commit metadata is subject to change.
:::


## property: TestConfig.expect
* since: v1.10
- type: ?<[Object]>
  - `timeout` ?<[int]> Default timeout for async expect matchers in milliseconds, defaults to 5000ms.
  - `toHaveScreenshot` ?<[Object]> Configuration for the [`method: PageAssertions.toHaveScreenshot#1`] method.
    - `animations` ?<[ScreenshotAnimations]<"allow"|"disabled">> See [`option: Page.screenshot.animations`] in [`method: Page.screenshot`]. Defaults to `"disabled"`.
    - `caret` ?<[ScreenshotCaret]<"hide"|"initial">> See [`option: Page.screenshot.caret`] in [`method: Page.screenshot`]. Defaults to `"hide"`.
    - `maxDiffPixels` ?<[int]> An acceptable amount of pixels that could be different, unset by default.
    - `maxDiffPixelRatio` ?<[float]> An acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1` , unset by default.
    - `scale` ?<[ScreenshotScale]<"css"|"device">> See [`option: Page.screenshot.scale`] in [`method: Page.screenshot`]. Defaults to `"css"`.
    - `stylePath` ?<[string]|[Array]<[string]>> See [`option: Page.screenshot.style`] in [`method: Page.screenshot`].
    - `threshold` ?<[float]> An acceptable perceived color difference between the same pixel in compared images, ranging from `0` (strict) and `1` (lax). `"pixelmatch"` comparator computes color difference in [YIQ color space](https://en.wikipedia.org/wiki/YIQ) and defaults `threshold` value to `0.2`.
    - `pathTemplate` ?<[string]> A template controlling location of the screenshots. See [`property: TestConfig.snapshotPathTemplate`] for details.
  - `toMatchAriaSnapshot` ?<[Object]> Configuration for the [`method: LocatorAssertions.toMatchAriaSnapshot#2`] method.
    - `pathTemplate` ?<[string]> A template controlling location of the aria snapshots. See [`property: TestConfig.snapshotPathTemplate`] for details.
  - `toMatchSnapshot` ?<[Object]> Configuration for the [`method: SnapshotAssertions.toMatchSnapshot#1`] method.
    - `maxDiffPixels` ?<[int]> An acceptable amount of pixels that could be different, unset by default.
    - `maxDiffPixelRatio` ?<[float]> An acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1` , unset by default.
    - `threshold` ?<[float]> An acceptable perceived color difference between the same pixel in compared images, ranging from `0` (strict) and `1` (lax). `"pixelmatch"` comparator computes color difference in [YIQ color space](https://en.wikipedia.org/wiki/YIQ) and defaults `threshold` value to `0.2`.
  - `toPass` ?<[Object]> Configuration for the [expect(value).toPass()](../test-assertions.md#expecttopass) method.
    - `intervals` ?<[Array]<[int]>> Probe intervals for toPass method in milliseconds.
    - `timeout` ?<[int]> Timeout for toPass method in milliseconds.

Configuration for the `expect` assertion library. Learn more about [various timeouts](../test-timeouts.md).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: {
    timeout: 10000,
    toMatchSnapshot: {
      maxDiffPixels: 10,
    },
  },
});
```

## property: TestConfig.failOnFlakyTests
* since: v1.52
- type: ?<[boolean]>

Whether to exit with an error if any tests are marked as flaky. Useful on CI.

Also available in the [command line](../test-cli.md) with the `--fail-on-flaky-tests` option.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  failOnFlakyTests: !!process.env.CI,
});
```

## property: TestConfig.forbidOnly
* since: v1.10
- type: ?<[boolean]>

Whether to exit with an error if any tests or groups are marked as [`method: Test.only`] or [`method: Test.describe.only`]. Useful on CI.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  forbidOnly: !!process.env.CI,
});
```

## property: TestConfig.fullyParallel
* since: v1.20
- type: ?<[boolean]>

Playwright Test runs tests in parallel. In order to achieve that, it runs several worker processes that run at the same time.
By default, **test files** are run in parallel. Tests in a single file are run in order, in the same worker process.

You can configure entire test run to concurrently execute all tests in all files using this option.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  fullyParallel: true,
});
```

## property: TestConfig.globalSetup
* since: v1.10
- type: ?<[string]|[Array]<[string]>>

Path to the global setup file. This file will be required and run before all the tests. It must export a single function that takes a [FullConfig] argument. Pass an array of paths to specify multiple global setup files.

Learn more about [global setup and teardown](../test-global-setup-teardown.md).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: './global-setup',
});
```

## property: TestConfig.globalTeardown
* since: v1.10
- type: ?<[string]|[Array]<[string]>>

Path to the global teardown file. This file will be required and run after all the tests. It must export a single function. See also [`property: TestConfig.globalSetup`]. Pass an array of paths to specify multiple global teardown files.

Learn more about [global setup and teardown](../test-global-setup-teardown.md).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalTeardown: './global-teardown',
});
```

## property: TestConfig.globalTimeout
* since: v1.10
- type: ?<[int]>

Maximum time in milliseconds the whole test suite can run. Zero timeout (default) disables this behavior. Useful on CI to prevent broken setup from running too long and wasting resources. Learn more about [various timeouts](../test-timeouts.md).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalTimeout: process.env.CI ? 60 * 60 * 1000 : undefined,
});
```

## property: TestConfig.grep
* since: v1.10
- type: ?<[RegExp]|[Array]<[RegExp]>>

Filter to only run tests with a title matching one of the patterns. For example, passing `grep: /cart/` should only run tests with "cart" in the title. Also available in the [command line](../test-cli.md) with the `-g` option. The regular expression will be tested against the string that consists of the project name, the test file name, the `test.describe` name (if any), the test name and the test tags divided by spaces, e.g. `chromium my-test.spec.ts my-suite my-test`.

`grep` option is also useful for [tagging tests](../test-annotations.md#tag-tests).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  grep: /smoke/,
});
```

## property: TestConfig.grepInvert
* since: v1.10
- type: ?<[RegExp]|[Array]<[RegExp]>>

Filter to only run tests with a title **not** matching one of the patterns. This is the opposite of [`property: TestConfig.grep`]. Also available in the [command line](../test-cli.md) with the `--grep-invert` option.

`grepInvert` option is also useful for [tagging tests](../test-annotations.md#tag-tests).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  grepInvert: /manual/,
});
```

## property: TestConfig.ignoreSnapshots
* since: v1.26
- type: ?<[boolean]>

Whether to skip snapshot expectations, such as `expect(value).toMatchSnapshot()` and `await expect(page).toHaveScreenshot()`.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  ignoreSnapshots: !process.env.CI,
});
```

## property: TestConfig.maxFailures
* since: v1.10
- type: ?<[int]>

The maximum number of test failures for the whole test suite run. After reaching this number, testing will stop and exit with an error. Setting to zero (default) disables this behavior.

Also available in the [command line](../test-cli.md) with the `--max-failures` and `-x` options.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  maxFailures: process.env.CI ? 1 : 0,
});
```

## property: TestConfig.metadata
* since: v1.10
- type: ?<[Metadata]>

Metadata contains key-value pairs to be included in the report. For example, HTML report will display it as key-value pairs, and JSON report will include metadata serialized as json.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  metadata: { title: 'acceptance tests' },
});
```

## property: TestConfig.name
* since: v1.10
- type: ?<[string]>

Config name is visible in the report and during test execution, unless overridden by [`property: TestProject.name`].

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  name: 'acceptance tests',
});
```

## property: TestConfig.outputDir
* since: v1.10
- type: ?<[string]>

The output directory for files created during test execution. Defaults to `<package.json-directory>/test-results`.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: './test-results',
});
```

**Details**

This directory is cleaned at the start. When running a test, a unique subdirectory inside the [`property: TestConfig.outputDir`] is created, guaranteeing that test running in parallel do not conflict. This directory can be accessed by [`property: TestInfo.outputDir`] and [`method: TestInfo.outputPath`].

Here is an example that uses [`method: TestInfo.outputPath`] to create a temporary file.

```js
import { test, expect } from '@playwright/test';
import fs from 'fs';

test('example test', async ({}, testInfo) => {
  const file = testInfo.outputPath('temporary-file.txt');
  await fs.promises.writeFile(file, 'Put some data to the file', 'utf8');
});
```


## property: TestConfig.snapshotDir
* since: v1.10
* discouraged: Use [`property: TestConfig.snapshotPathTemplate`] to configure snapshot paths.
- type: ?<[string]>

The base directory, relative to the config file, for snapshot files created with `toMatchSnapshot`. Defaults to [`property: TestConfig.testDir`].

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  snapshotDir: './snapshots',
});
```

**Details**

The directory for each test can be accessed by [`property: TestInfo.snapshotDir`] and [`method: TestInfo.snapshotPath`].

This path will serve as the base directory for each test file snapshot directory. Setting `snapshotDir` to `'snapshots'`, the [`property: TestInfo.snapshotDir`] would resolve to `snapshots/a.spec.js-snapshots`.

## property: TestConfig.snapshotPathTemplate = %%-test-config-snapshot-path-template-%%
* since: v1.28

## property: TestConfig.preserveOutput
* since: v1.10
- type: ?<[PreserveOutput]<"always"|"never"|"failures-only">>

Whether to preserve test output in the [`property: TestConfig.outputDir`]. Defaults to `'always'`.
* `'always'` - preserve output for all tests;
* `'never'` - do not preserve output for any tests;
* `'failures-only'` - only preserve output for failed tests.


**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  preserveOutput: 'always',
});
```

## property: TestConfig.projects
* since: v1.10
- type: ?<[Array]<[TestProject]>>

Playwright Test supports running multiple test projects at the same time. See [TestProject] for more information.


**Usage**

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] }
  ]
});
```

## property: TestConfig.quiet
* since: v1.10
- type: ?<[boolean]>

Whether to suppress stdio and stderr output from the tests.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  quiet: !!process.env.CI,
});
```

## property: TestConfig.repeatEach
* since: v1.10
- type: ?<[int]>

The number of times to repeat each test, useful for debugging flaky tests.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  repeatEach: 3,
});
```

## property: TestConfig.reporter
* since: v1.10
- type: ?<[string]|[Array]<[Object]>|[BuiltInReporter]<"list"|"dot"|"line"|"github"|"json"|"junit"|"null"|"html">>
  - `0` <[string]> Reporter name or module or file path
  - `1` <[Object]> An object with reporter options if any

The list of reporters to use. Each reporter can be:
* A builtin reporter name like `'list'` or `'json'`.
* A module name like `'my-awesome-reporter'`.
* A relative path to the reporter like `'./reporters/my-awesome-reporter.js'`.

You can pass options to the reporter in a tuple like `['json', { outputFile: './report.json' }]`.

Learn more in the [reporters guide](../test-reporters.md).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: 'line',
});
```

## property: TestConfig.reportSlowTests
* since: v1.10
- type: ?<[null]|[Object]>
  - `max` <[int]> The maximum number of slow test files to report. Defaults to `5`.
  - `threshold` <[float]> Test file duration in milliseconds that is considered slow. Defaults to 5 minutes.

Whether to report slow test files. Pass `null` to disable this feature.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reportSlowTests: null,
});
```

**Details**

Test files that took more than `threshold` milliseconds are considered slow, and the slowest ones are reported, no more than `max` number of them. Passing zero as `max` reports all test files that exceed the threshold.

## property: TestConfig.respectGitIgnore
* since: v1.45
- type: ?<[boolean]>

Whether to skip entries from `.gitignore` when searching for test files. By default, if neither [`property: TestConfig.testDir`] nor [`property: TestProject.testDir`] are explicitly specified, Playwright will ignore any test files matching `.gitignore` entries.

## property: TestConfig.retries
* since: v1.10
- type: ?<[int]>

The maximum number of retry attempts given to failed tests. By default failing tests are not retried. Learn more about [test retries](../test-retries.md#retries).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  retries: 2,
});
```

## property: TestConfig.shard
* since: v1.10
- type: ?<[null]|[Object]>
  - `current` <[int]> The index of the shard to execute, one-based.
  - `total` <[int]> The total number of shards.

Shard tests and execute only the selected shard. Specify in the one-based form like `{ total: 5, current: 2 }`.

Learn more about [parallelism and sharding](../test-parallel.md) with Playwright Test.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  shard: { total: 10, current: 3 },
});
```


## property: TestConfig.testDir
* since: v1.10
- type: ?<[string]>

Directory that will be recursively scanned for test files. Defaults to the directory of the configuration file.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/playwright',
});
```

## property: TestConfig.testIgnore
* since: v1.10
- type: ?<[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Files matching one of these patterns are not executed as test files. Matching is performed against the absolute file path. Strings are treated as glob patterns.

For example, `'**/test-assets/**'` will ignore any files in the `test-assets` directory.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testIgnore: '**/test-assets/**',
});
```

## property: TestConfig.testMatch
* since: v1.10
- type: ?<[string]|[RegExp]|[Array]<[string]|[RegExp]>>

Only the files matching one of these patterns are executed as test files. Matching is performed against the absolute file path. Strings are treated as glob patterns.

By default, Playwright looks for files matching the following glob pattern: `**/*.@(spec|test).?(c|m)[jt]s?(x)`. This means JavaScript or TypeScript files with `".test"` or `".spec"` suffix, for example `login-screen.wrong-credentials.spec.ts`.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: /.*\.e2e\.js/,
});
```

## property: TestConfig.timeout
* since: v1.10
- type: ?<[int]>

Timeout for each test in milliseconds. Defaults to 30 seconds.

This is a base timeout for all tests. In addition, each test can configure its own timeout with [`method: Test.setTimeout`]. Learn more about [various timeouts](../test-timeouts.md).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 5 * 60 * 1000,
});
```

## property: TestConfig.tsconfig
* since: v1.49
- type: ?<[string]>

Path to a single `tsconfig` applicable to all imported files. By default, `tsconfig` for each imported file is looked up separately. Note that `tsconfig` property has no effect while the configuration file or any of its dependencies are loaded. Ignored when `--tsconfig` command line option is specified.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  tsconfig: './tsconfig.test.json',
});
```

## property: TestConfig.updateSnapshots
* since: v1.10
- type: ?<[UpdateSnapshots]<"all"|"changed"|"missing"|"none">>

Whether to update expected snapshots with the actual results produced by the test run. Defaults to `'missing'`.
* `'all'` - All tests that are executed will update snapshots.
* `'changed'` - All tests that are executed will update snapshots that did not match. Matching snapshots will not be updated.
* `'missing'` - Missing snapshots are created, for example when authoring a new test and running it for the first time. This is the default.
* `'none'` - No snapshots are updated.

Learn more about [snapshots](../test-snapshots.md).

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  updateSnapshots: 'missing',
});
```

## property: TestConfig.updateSourceMethod
* since: v1.50
- type: ?<[UpdateSourceMethod]<"overwrite"|"3way"|"patch">>

Defines how to update snapshots in the source code.
* `'patch'` - Create a unified diff file that can be used to update the source code later. This is the default.
* `'3way'` - Generate merge conflict markers in source code. This allows user to manually pick relevant changes, as if they are resolving a merge conflict in the IDE.
* `'overwrite'` - Overwrite the source code with the new snapshot values.

## property: TestConfig.use
* since: v1.10
- type: ?<[TestOptions]>

Global options for all tests, for example [`property: TestOptions.browserName`]. Learn more about [configuration](../test-configuration.md) and see [available options][TestOptions].

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    browserName: 'chromium',
  },
});
```

## property: TestConfig.webServer
* since: v1.10
- type: ?<[Object]|[Array]<[Object]>>
  - `command` <[string]> Shell command to start. For example `npm run start`..
  - `cwd` ?<[string]> Current working directory of the spawned process, defaults to the directory of the configuration file.
  - `env` ?<[Object]<[string], [string]>> Environment variables to set for the command, `process.env` by default.
  - `gracefulShutdown` ?<[Object]> How to shut down the process. If unspecified, the process group is forcefully `SIGKILL`ed. If set to `{ signal: 'SIGTERM', timeout: 500 }`, the process group is sent a `SIGTERM` signal, followed by `SIGKILL` if it doesn't exit within 500ms. You can also use `SIGINT` as the signal instead. A `0` timeout means no `SIGKILL` will be sent. Windows doesn't support `SIGTERM` and `SIGINT` signals, so this option is ignored on Windows. Note that shutting down a Docker container requires `SIGTERM`.
    - `signal` <["SIGINT"|"SIGTERM"]>
    - `timeout` <[int]>
  - `ignoreHTTPSErrors` ?<[boolean]> Whether to ignore HTTPS errors when fetching the `url`. Defaults to `false`.
  - `name` ?<[string]> Specifies a custom name for the web server. This name will be prefixed to log messages. Defaults to `[WebServer]`.
  - `port` ?<[int]> The port that your http server is expected to appear on. It does wait until it accepts connections. Either `port` or `url` should be specified.
  - `reuseExistingServer` ?<[boolean]> If true, it will re-use an existing server on the `port` or `url` when available. If no server is running on that `port` or `url`, it will run the command to start a new server. If `false`, it will throw if an existing process is listening on the `port` or `url`. This should be commonly set to `!process.env.CI` to allow the local dev server when running tests locally.
  - `stderr` ?<["pipe"|"ignore"]> Whether to pipe the stderr of the command to the process stderr or ignore it. Defaults to `"pipe"`.
  - `stdout` ?<["pipe"|"ignore"]> If `"pipe"`, it will pipe the stdout of the command to the process stdout. If `"ignore"`, it will ignore the stdout of the command. Default to `"ignore"`.
  - `timeout` ?<[int]> How long to wait for the process to start up and be available in milliseconds. Defaults to 60000.
  - `url` ?<[string]> The url on your http server that is expected to return a 2xx, 3xx, 400, 401, 402, or 403 status code when the server is ready to accept connections. Redirects (3xx status codes) are being followed and the new location is checked. Either `port` or `url` should be specified.

Launch a development web server (or multiple) during the tests.

**Details**

If the port is specified, Playwright Test will wait for it to be available on `127.0.0.1` or `::1`, before running the tests. If the url is specified, Playwright Test will wait for the URL to return a 2xx, 3xx, 400, 401, 402, or 403 status code before running the tests.

For continuous integration, you may want to use the `reuseExistingServer: !process.env.CI` option which does not use an existing server on the CI. To see the stdout, you can set the `DEBUG=pw:webserver` environment variable.

The `port` (but not the `url`) gets passed over to Playwright as a [`property: TestOptions.baseURL`]. For example port `8080` produces `baseURL` equal `http://localhost:8080`. If `webServer` is specified as an array, you must explicitly configure the `baseURL` (even if it only has one entry).

:::note
It is also recommended to specify [`property: TestOptions.baseURL`] in the config, so that tests could use relative urls.
:::

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000/',
  },
});
```

Now you can use a relative path when navigating the page:

```js title="test.spec.ts"
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  // This will result in http://localhost:3000/foo
  await page.goto('/foo');
});
```

Multiple web servers (or background processes) can be launched:

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: [
    {
      command: 'npm run start',
      url: 'http://localhost:3000',
      name: 'Frontend',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run backend',
      url: 'http://localhost:3333',
      name: 'Backend',
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
    }
  ],
  use: {
    baseURL: 'http://localhost:3000',
  },
});
```

## property: TestConfig.workers
* since: v1.10
- type: ?<[int]|[string]>

The maximum number of concurrent worker processes to use for parallelizing tests. Can also be set as percentage of logical CPU cores, e.g. `'50%'.`

Playwright Test uses worker processes to run tests. There is always at least one worker process, but more can be used to speed up test execution.

Defaults to half of the number of logical CPU cores. Learn more about [parallelism and sharding](../test-parallel.md) with Playwright Test.

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  workers: 3,
});
```
