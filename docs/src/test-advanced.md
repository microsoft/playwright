---
id: test-advanced
title: "Advanced: configuration"
---

<!-- TOC -->

## Project configuration

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

## Projects

Playwright Test supports running multiple test projects at the same time. This is useful for running the same tests in multiple configurations. For example, consider running tests against multiple versions of the database.

To make use of this feature, we will declare an "option fixture" for the database version, and use it in the tests.

```js
// my-test.ts
import { test as base } from 'playwright/test';

const test = base.extend<{ version: string, database: Database }>({
  // Default value for the version.
  version: '1.0',

  // Use version when connecting to the database.
  database: async ({ version }, use) => {
    const db = await connectToDatabase(version);
    await use(db);
    await db.close();
  },
});
```

We can use our fixtures in the test.
```js
// example.spec.ts
import test from './my-test';

test('test 1', async ({ database }) => {
  // Test code goes here.
});

test('test 2', async ({ version, database }) => {
  test.fixme(version === '2.0', 'This feature is not implemented in 2.0 yet');
  // Test code goes here.
});
```

Now, we can run test in multiple configurations by using projects.
```js
// pwtest.config.ts
import { PlaywrightTestConfig } from 'playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 20000,
  projects: [
    {
      name: 'v1',
      use: { version: '1.0' },
    },
    {
      name: 'v2',
      use: { version: '2.0' },
    },
  ]
};
export default config;
```

Each project can be configured separately, and run different set of tests with different parameters.
Supported options are `name`, `outputDir`, `repeatEach`, `retries`, `snapshotDir`, `testDir`, `testIgnore`, `testMatch` and `timeout`. See [configuration object](#configuration-object) for detailed description.

You can run all projects or just a single one:
```sh
# Run both projects - each test will be run twice
npx playwright test

# Run a single project - each test will be run once
npx playwright test --project=v2
```

## workerInfo object

Depending on the configuration and failures, Playwright Test might use different number of worker processes to run all the tests. For example, Playwright Test will always start a new worker process after a failing test.

Worker-scoped fixtures and `beforeAll` and `afterAll` hooks receive `workerInfo` parameter. The following information is accessible from the `workerInfo`:
- `config` - [Configuration object](#configuration-object).
- `project` - Specific [project](#projects) configuration for this worker. Different projects are always run in separate processes.
- `workerIndex: number` - A unique sequential index assigned to the worker process.

Consider an example where we run a new http server per worker process, and use `workerIndex` to produce a unique port number:

```js
// my-test.ts
import { test as base } from 'playwright/test';
import * as http from 'http';

// Note how we mark the fixture as { scope: 'worker' }.
// Also note that we pass empty {} first, since we do not declare any test fixtures.
const test = base.extend<{}, { server: http.Server }>({
  server: [ async ({}, use, workerInfo) => {
    // Start the server.
    const server = http.createServer();
    server.listen(9000 + workerInfo.workerIndex);
    await new Promise(ready => server.once('listening', ready));

    // Use the server in the tests.
    await use(server);

    // Cleanup.
    await new Promise(done => server.close(done));
  }, { scope: 'worker' } ]
});
export default test;
```

## testInfo object

Test fixtures and `beforeEach` and `afterEach` hooks receive `testInfo` parameter. It is also available to the test function as a second parameter.

In addition to everything from the [`workerInfo`](#workerinfo), the following information is accessible before and during the test:
- `title: string` - Test title.
- `file: string` - Full path to the test file.
- `line: number` - Line number of the test declaration.
- `column: number` - Column number of the test declaration.
- `fn: Function` - Test body function.
- `repeatEachIndex: number` - The sequential repeat index.
- `retry: number` - The sequential number of the test retry (zero means first run).
- `expectedStatus: 'passed' | 'failed' | 'timedOut'` - Whether this test is expected to pass, fail or timeout.
- `timeout: number` - Test timeout.
- `annotations` - [Annotations](#annotations) that were added to the test.
- `snapshotPathSegment: string` - Relative path, used to locate snapshots for the test.
- `snapshotPath(...pathSegments: string[])` - Function that returns the full path to a particular snapshot for the test.
- `outputDir: string` - Absolute path to the output directory for this test run.
- `outputPath(...pathSegments: string[])` - Function that returns the full path to a particular output artifact for the test.

The following information is accessible after the test body has finished, in fixture teardown:
- `duration: number` - test running time in milliseconds.
- `status: 'passed' | 'failed' | 'timedOut'` - the actual test result.
- `error` - any error thrown by the test body.
- `stdout: (string | Buffer)[]` - array of stdout chunks collected during the test run.
- `stderr: (string | Buffer)[]` - array of stderr chunks collected during the test run.

Here is an example test that saves some information:
```js
// example.spec.ts
import { test } from 'playwright/test';

test('my test needs a file', async ({ table }, testInfo) => {
  // Do something with the table...
  // ... and then save contents.
  const filePath = testInfo.outputPath('table.dat');
  await table.saveTo(filePath);
});
```

Here is an example fixture that automatically saves debug logs when the test fails:
```js
// my-test.ts
import * as debug from 'debug';
import * as fs from 'fs';
import { test as base } from 'playwright/test';

// Note how we mark the fixture as { auto: true }.
// This way it is always instantiated, even if the test does not use it explicitly.
const test = base.extend<{ saveLogs: void }>({
  saveLogs: [ async ({}, use, testInfo) => {
    const logs = [];
    debug.log = (...args) => logs.push(args.map(String).join(''));
    debug.enable('mycomponent');
    await use();
    if (testInfo.status !== testInfo.expectedStatus)
      fs.writeFileSync(testInfo.outputPath('logs.txt'), logs.join('\n'), 'utf8');
  }, { auto: true } ]
});
export default test;
```

## Global setup and teardown

To set something up once before running all tests, use `globalSetup` option in the [configuration file](#writing-a-configuration-file). Similarly, use `globalTeardown` to run something once after all the tests.

```js
// global-setup.ts
import * as http from 'http';

module.exports = async () => {
  const server = http.createServer(app);
  await new Promise(done => server.listen(done));
  process.env.SERVER_PORT = String(server.address().port); // Expose port to the tests.
  global.__server = server; // Save the server for the teardown.
};
```

```js
// global-teardown.ts
module.exports = async () => {
  await new Promise(done => global.__server.close(done));
};
```

```js
// pwtest.config.ts
import { PlaywrightTestConfig } from 'playwright/test';

const config: PlaywrightTestConfig = {
  globalSetup: 'global-setup.ts',
  globalTeardown: 'global-teardown.ts',
};
export default config;
```

## Fixture options

It is common for the [fixtures](#fixtures) to be configurable, based on various test needs.
Playwright Test allows creating "options" fixture for this purpose.

```js
// my-test.ts
import { test as base } from 'playwright/test';

const test = base.extend<{ dirCount: number, dirs: string[] }>({
  // Define an option that can be configured in tests with `test.use()`.
  // Provide a default value.
  dirCount: 1,

  // Define a fixture that provides some useful functionality to the test.
  // In this example, it will supply some temporary directories.
  // Our fixture uses the "dirCount" option that can be configured by the test.
  dirs: async ({ dirCount }, use, testInfo) => {
    const dirs = [];
    for (let i = 0; i < dirCount; i++)
      dirs.push(testInfo.outputPath('dir-' + i));

    // Use the list of directories in the test.
    await use(dirs);

    // Cleanup if needed.
  },
});
export default test;
```

We can now pass the option value with `test.use()`.

```js
// example.spec.ts
import test from './my-test';

// Here we define the option value. Tests in this file need two temporary directories.
test.use({ dirCount: 2 });

test('my test title', async ({ dirs }) => {
  // Test can use "dirs" right away - the fixture has already run and created two temporary directories.
  test.expect(dirs.length).toBe(2);
});
```

In addition to `test.use()`, we can also specify options in the configuration file.
```js
// pwtest.config.ts
import { PlaywrightTestConfig } from 'playwright/test';

const config: PlaywrightTestConfig = {
  // All tests will get three directories by default, unless it is overridden with test.use().
  use: { dirCount: 3 },
};
export default config;
```

### Add custom matchers using expect.extend

Playwright Test uses [expect](https://jestjs.io/docs/expect) under the hood which has the functionality to extend it with [custom matchers](https://jestjs.io/docs/expect#expectextendmatchers). See the following example where a custom `toBeWithinRange` function gets added.

```js
// pwtest.config.ts
import * as pwtest from 'playwright/test';

pwtest.expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () => 'passed',
        pass: true,
      };
    } else {
      return {
        message: () => 'failed',
        pass: false,
      };
    }
  },
});

const config = {};
export default config;
```

```js
// example.spec.ts
import { test } from 'playwright/test';

test('numeric ranges', () => {
  test.expect(100).toBeWithinRange(90, 110);
  test.expect(101).not.toBeWithinRange(0, 100);
});
```

```js
// global.d.ts
declare namespace folio {
  interface Matchers<R> {
    toBeWithinRange(a: number, b: number): R;
  }
}
```

To import expect matching libraries like [jest-extended](https://github.com/jest-community/jest-extended#installation) you can import it from your `globals.d.ts`:

```js
// global.d.ts
import 'jest-extended';
```
