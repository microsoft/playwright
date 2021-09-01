# class: TestConfig
* langs: js

Playwright Test provides many options to configure how your tests are collected and executed, for example `timeout` or `testDir`. These options are described in the [TestConfig] object in the [configuration file](./test-configuration.md).

Playwright Test supports running multiple test projects at the same time. Project-specific options should be put to [`property: TestConfig.projects`], but top-level [TestConfig] can also define base options shared between all projects.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  timeout: 30000,
  globalTimeout: 600000,
  reporter: 'list',
  testDir: './tests',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 30000,
  globalTimeout: 600000,
  reporter: 'list',
  testDir: './tests',
};
export default config;
```

## property: TestConfig.expect
- type: <[Object]>
  - `toMatchSnapshot` <[Object]>
    - `threshold` <[float]> Image matching threshold between zero (strict) and one (lax).

Configuration for the `expect` assertion library.

## property: TestConfig.forbidOnly
- type: <[boolean]>

Whether to exit with an error if any tests or groups are marked as [`method: Test.only`] or [`method: Test.describe.only`]. Useful on CI.

## property: TestConfig.globalSetup
- type: <[string]>

Path to the global setup file. This file will be required and run before all the tests. It must export a single function that takes a [`TestConfig`] argument.

Learn more about [global setup and teardown](./test-advanced.md#global-setup-and-teardown).

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  globalSetup: './global-setup',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  globalSetup: './global-setup',
};
export default config;
```

## property: TestConfig.globalTeardown
- type: <[string]>

Path to the global teardown file. This file will be required and run after all the tests. It must export a single function. See also [`property: TestConfig.globalSetup`].

Learn more about [global setup and teardown](./test-advanced.md#global-setup-and-teardown).


## property: TestConfig.globalTimeout
- type: <[int]>

Maximum time in milliseconds the whole test suite can run. Zero timeout (default) disables this behavior. Useful on CI to prevent broken setup from running too long and wasting resources.


## property: TestConfig.grep
- type: <[RegExp]|[Array]<[RegExp]>>

Filter to only run tests with a title matching one of the patterns. For example, passing `grep: /cart/` should only run tests with "cart" in the title. Also available in the [command line](./test-cli.md) with the `-g` option.

`grep` option is also useful for [tagging tests](./test-annotations.md#tag-tests).


## property: TestConfig.grepInvert
- type: <[RegExp]|[Array]<[RegExp]>>

Filter to only run tests with a title **not** matching one of the patterns. This is the opposite of [`property: TestConfig.grep`]. Also available in the [command line](./test-cli.md) with the `--grep-invert` option.

`grepInvert` option is also useful for [tagging tests](./test-annotations.md#tag-tests).


## property: TestConfig.maxFailures
- type: <[int]>

The maximum number of test failures for the whole test suite run. After reaching this number, testing will stop and exit with an error. Setting to zero (default) disables this behavior.

Also available in the [command line](./test-cli.md) with the `--max-failures` and `-x` options.

## property: TestConfig.metadata
- type: <[Object]>

Any JSON-serializable metadata that will be put directly to the test report.

## property: TestConfig.outputDir
- type: <[string]>

The output directory for files created during test execution. Defaults to `test-results`.

This directory is cleaned at the start. When running a test, a unique subdirectory inside the [`property: TestConfig.outputDir`] is created, guaranteeing that test running in parallel do not conflict. This directory can be accessed by [`property: TestInfo.outputDir`] and [`method: TestInfo.outputPath`].


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

## property: TestConfig.preserveOutput
- type: <[PreserveOutput]<"always"|"never"|"failures-only">>

Whether to preserve test output in the [`property: TestConfig.outputDir`]. Defaults to `'always'`.
* `'always'` - preserve output for all tests;
* `'never'` - do not preserve output for any tests;
* `'failures-only'` - only preserve output for failed tests.


## property: TestConfig.projects
- type: <[Array]<[TestProject]>>

Playwright Test supports running multiple test projects at the same time. See [TestProject] for more information.


## property: TestConfig.quiet
- type: <[boolean]>

Whether to suppress stdio and stderr output from the tests.

## property: TestConfig.repeatEach
- type: <[int]>

The number of times to repeat each test, useful for debugging flaky tests.

## property: TestConfig.reporter
- type: <[string]|[Array]<[Object]>|[BuiltInReporter]<"list"|"dot"|"line"|"json"|"junit"|"null">>
  - `0` <[string]> Reporter name or module or file path
  - `1` <[Object]> An object with reporter options if any

The list of reporters to use. Each reporter can be:
* A builtin reporter name like `'list'` or `'json'`.
* A module name like `'my-awesome-reporter'`.
* A relative path to the reporter like `'./reporters/my-awesome-reporter.js'`.

You can pass options to the reporter in a tuple like `['json', { outputFile: './report.json' }]`.

Learn more in the [reporters guide](./test-reporters.md).

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: 'line',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: 'line',
};
export default config;
```

## property: TestConfig.reportSlowTests
- type: <[Object]>
  - `max` <[int]> The maximum number of slow tests to report. Defaults to `5`.
  - `threshold` <[float]> Test duration in milliseconds that is considered slow. Defaults to 15 seconds.

Whether to report slow tests. Pass `null` to disable this feature.

Tests that took more than `threshold` milliseconds are considered slow, and the slowest ones are reported, no more than `max` number of them. Passing zero as `max` reports all slow tests that exceed the threshold.

## property: TestConfig.retries
- type: <[int]>

The maximum number of retry attempts given to failed tests. Learn more about [test retries](./test-retries.md).

## property: TestConfig.shard
- type: <[Object]>
  - `total` <[int]> The total number of shards.
  - `current` <[int]> The index of the shard to execute, one-based.

Shard tests and execute only the selected shard. Specify in the one-based form like `{ total: 5, current: 2 }`.

Learn more about [parallelism and sharding](./test-parallel.md) with Playwright Test.

## property: TestConfig.testDir
- type: <[string]>

Directory that will be recursively scanned for test files. Defaults to the directory of the configuration file.

## property: TestConfig.testIgnore
- type: <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Files matching one of these patterns are not executed as test files. Matching is performed against the absolute file path. Strings are treated as glob patterns.

For example, `'**/test-assets/**'` will ignore any files in the `test-assets` directory.

## property: TestConfig.testMatch
- type: <[string]|[RegExp]|[Array]<[string]>|[Array]<[RegExp]>>

Only the files matching one of these patterns are executed as test files. Matching is performed against the absolute file path. Strings are treated as glob patterns.

By default, Playwright Test looks for files matching `.*(test|spec)\.(js|ts|mjs)`.

## property: TestConfig.timeout
- type: <[int]>

Timeout for each test in milliseconds. Defaults to 30 seconds.

This is a base timeout for all tests. In addition, each test can configure its own timeout with [`method: Test.setTimeout`].

## property: TestConfig.updateSnapshots
- type: <[UpdateSnapshots]<"all"|"none"|"missing">>

Whether to update expected snapshots with the actual results produced by the test run. Defaults to `'missing'`.
* `'all'` - All tests that are executed will update snapshots.
* `'none'` - No snapshots are updated.
* `'missing'` - Missing snapshots are created, for example when authoring a new test and running it for the first time. This is the default.

Learn more about [snapshots](./test-snapshots.md).

## property: TestConfig.use
- type: <[Fixtures]>

Additional fixtures for this project. Most useful for specifying options, for example [`property: Fixtures.browserName`]. Learn more about [Fixtures] and [configuration](./test-configuration.md).

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    browserName: 'chromium',
  },
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  use: {
    browserName: 'chromium',
  },
};
export default config;
```

## property: TestConfig.workers
- type: <[int]>

The maximum number of concurrent worker processes to use for parallelizing tests.

Playwright Test uses worker processes to run tests. There is always at least one worker process, but more can be used to speed up test execution.

Defaults to one half of the number of CPU cores. Learn more about [parallelism and sharding](./test-parallel.md) with Playwright Test.
