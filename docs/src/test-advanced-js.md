---
id: test-advanced
title: "Advanced: configuration"
---

<!-- TOC -->

## Configuration object

Configuration file exports a single object.

### Test suite options

These options define your test suite:
- `metadata: any` - Any JSON-serializable metadata that will be put directly to the test report.
- `name: string` - Project name, useful when defining multiple [test projects](#projects).
- `outputDir: string` - Output directory for files created during the test run.
- `snapshotDir: string` - Base output directory for snapshot files.
- `repeatEach: number` - The number of times to repeat each test, useful for debugging flaky tests.
- `retries: number` - The maximum number of retry attempts given to failed tests. If not specified, failing tests are not retried.
- `testDir: string` - Directory that will be recursively scanned for test files.
- `testIgnore: string | RegExp | (string | RegExp)[]` - Files matching one of these patterns are not considered test files.
- `testMatch: string | RegExp | (string | RegExp)[]` - Only the files matching one of these patterns are considered test files.
- `timeout: number` - Timeout for each test in milliseconds.
- `use` - An object defining fixture options.

### Test run options

These options would be typically different between local development and CI operation:
- `forbidOnly: boolean` - Whether to exit with an error if any tests are marked as `test.only`. Useful on CI.
- `globalSetup: string` - Path to the [global setup](#global-setup-and-teardown) file. This file will be required and run before all the tests. It must export a single function.
- `globalTeardown: string` - Path to the [global teardown](#global-setup-and-teardown) file. This file will be required and run after all the tests. It must export a single function.
- `globalTimeout: number` - Total timeout in milliseconds for the whole test run.
- `grep: RegExp | RegExp[]` - Patterns to filter tests based on their title.
- `maxFailures: number` - The maximum number of test failures for this test run. After reaching this number, testing will stop and exit with an error. Setting to zero (default) disables this behavior.
- `preserveOutput: 'always' | 'never' | 'failures-only'` - Whether to preserve test output in the `outputDir`:
  - `'always'` - preserve output for all tests;
  - `'never'` - do not preserve output for any tests;
  - `'failures-only'` - only preserve output for failed tests.
- `projects: Project[]` - Multiple [projects](#projects) configuration.
- `quiet: boolean` - Whether to suppress stdout and stderr from the tests.
- `reporter: 'list' | 'line' | 'dot' | 'json' | 'junit' | 'github' | 'html' | 'null'` - The reporter to use. See [reporters](./test-reporters.md) for details.
- `reportSlowTests: { max: number, threshold: number } | null` - Whether to report slow test files. When `null`, slow test files are not reported. Otherwise, test files that took more than `threshold` milliseconds are reported as slow, but no more than `max` number of them. Passing zero as `max` reports all test files that exceed the threshold.
- `shard: { total: number, current: number } | null` - [Shard](./test-parallel.md#shard-tests-between-multiple-machines) information.
- `updateSnapshots: boolean` - Whether to update expected snapshots with the actual results produced by the test run.
- `workers: number` - The maximum number of concurrent worker processes to use for parallelizing tests.
- `webServer: { command: string, port: number, timeout?: number, reuseExistingServer?: boolean, cwd?: string, env?: object }` - Launch a process and wait that it's ready before the tests will start. See [launch web server](#launching-a-development-web-server-during-the-tests) configuration for examples.

Note that each [test project](#projects) can provide its own test suite options, for example two projects can run different tests by providing different `testDir`s. However, test run options are shared between all projects.

## workerInfo object

Depending on the configuration and failures, Playwright Test might use different number of worker processes to run all the tests. For example, Playwright Test will always start a new worker process after a failing test.

Worker-scoped fixtures and `beforeAll` and `afterAll` hooks receive `workerInfo` parameter. The following information is accessible from the `workerInfo`:
- `config` - [Configuration object](#configuration-object).
- `project` - Specific [project](#projects) configuration for this worker. Different projects are always run in separate processes.
- `workerIndex: number` - A unique sequential index assigned to the worker process.

Consider an example where we run a new http server per worker process, and use `workerIndex` to produce a unique port number:

```js js-flavor=js
// my-test.js
const base = require('@playwright/test');
const http = require('http');

// Note how we mark the fixture as { scope: 'worker' }.
// Also note that we pass empty {} first, since we do not declare any test fixtures.
exports.test = base.test.extend({
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
```

```js js-flavor=ts
// my-test.ts
import { test as base } from '@playwright/test';
import * as http from 'http';

// Note how we mark the fixture as { scope: 'worker' }.
// Also note that we pass empty {} first, since we do not declare any test fixtures.
export const test = base.extend<{}, { server: http.Server }>({
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
- `annotations` - [Annotations](./test-annotations.md) that were added to the test.
- `snapshotSuffix: string` - Suffix used to locate snapshots for the test.
- `snapshotPath(...pathSegments: string[])` - Function that returns the full path to a particular snapshot for the test.
- `outputDir: string` - Path to the output directory for this test run.
- `outputPath(...pathSegments: string[])` - Function that returns the full path to a particular output artifact for the test.

The following information is accessible after the test body has finished, in fixture teardown:
- `duration: number` - test running time in milliseconds.
- `status: 'passed' | 'failed' | 'timedOut'` - the actual test result.
- `error` - any error thrown by the test body.
- `stdout: (string | Buffer)[]` - array of stdout chunks collected during the test run.
- `stderr: (string | Buffer)[]` - array of stderr chunks collected during the test run.

Here is an example test that saves some information:
```js js-flavor=js
// example.spec.js
const { test } = require('@playwright/test');

test('my test needs a file', async ({ table }, testInfo) => {
  // Do something with the table...
  // ... and then save contents.
  const filePath = testInfo.outputPath('table.dat');
  await table.saveTo(filePath);
});
```

```js js-flavor=ts
// example.spec.ts
import { test } from '@playwright/test';

test('my test needs a file', async ({ table }, testInfo) => {
  // Do something with the table...
  // ... and then save contents.
  const filePath = testInfo.outputPath('table.dat');
  await table.saveTo(filePath);
});
```

Here is an example fixture that automatically saves debug logs when the test fails:
```js js-flavor=js
// my-test.js
const debug = require('debug');
const fs = require('fs');
const base = require('@playwright/test');

// Note how we mark the fixture as { auto: true }.
// This way it is always instantiated, even if the test does not use it explicitly.
exports.test = base.test.extend({
  saveLogs: [ async ({}, use, testInfo) => {
    const logs = [];
    debug.log = (...args) => logs.push(args.map(String).join(''));
    debug.enable('mycomponent');

    await use();

    if (testInfo.status !== testInfo.expectedStatus)
      fs.writeFileSync(testInfo.outputPath('logs.txt'), logs.join('\n'), 'utf8');
  }, { auto: true } ]
});
```

```js js-flavor=ts
// my-test.ts
import * as debug from 'debug';
import * as fs from 'fs';
import { test as base } from '@playwright/test';

// Note how we mark the fixture as { auto: true }.
// This way it is always instantiated, even if the test does not use it explicitly.
export const test = base.extend<{ saveLogs: void }>({
  saveLogs: [ async ({}, use, testInfo) => {
    const logs = [];
    debug.log = (...args) => logs.push(args.map(String).join(''));
    debug.enable('mycomponent');

    await use();

    if (testInfo.status !== testInfo.expectedStatus)
      fs.writeFileSync(testInfo.outputPath('logs.txt'), logs.join('\n'), 'utf8');
  }, { auto: true } ]
});
```

## Launching a development web server during the tests

To launch a server during the tests, use the `webServer` option in the [configuration file](#configuration-object).

You can specify a port via `port` or additional environment variables, see [here](#configuration-object). The server will wait for it to be available before running the tests. For continuous integration, you may want to use the `reuseExistingServer: !process.env.CI` option which does not use an existing server on the CI.

The port gets then passed over to Playwright as a [`param: baseURL`] when creating the context [`method: Browser.newContext`].

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npm run start',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
};
export default config;
```

```js js-flavor=js
// playwright.config.js
// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  webServer: {
    command: 'npm run start',
    port: 3000,
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
};
module.exports = config;
```

Now you can use a relative path when navigating the page, or use `baseURL` fixture:

```js js-flavor=ts
// test.spec.ts
import { test } from '@playwright/test';
test('test', async ({ page, baseURL }) => {
  // baseURL is taken directly from your web server,
  // e.g. http://localhost:3000
  await page.goto(baseURL + '/bar');
  // Alternatively, just use relative path, because baseURL is already
  // set for the default context and page.
  // For example, this will result in http://localhost:3000/foo
  await page.goto('/foo');
});
```

```js js-flavor=js
// test.spec.js
const { test } = require('@playwright/test');
test('test', async ({ page, baseURL }) => {
  // baseURL is taken directly from your web server,
  // e.g. http://localhost:3000
  await page.goto(baseURL + '/bar');
  // Alternatively, just use relative path, because baseURL is already
  // set for the default context and page.
  // For example, this will result in http://localhost:3000/foo
  await page.goto('/foo');
});
```

## Global setup and teardown

To set something up once before running all tests, use `globalSetup` option in the [configuration file](#configuration-object). Global setup file must export a single function that takes a config object. This function will be run once before all the tests.

Similarly, use `globalTeardown` to run something once after all the tests. Alternatively, let `globalSetup` return a function that will be used as a global teardown. You can pass data such as port number, authentication tokens, etc. from your global setup to your tests using environment.

Here is a global setup example that authenticates once and reuses authentication state in tests. It uses `baseURL` and `storageState` options from the configuration file.

```js js-flavor=js
// global-setup.js
const { chromium } = require('@playwright/test');

module.exports = async config => {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL);
  await page.fill('input[name="user"]', 'user');
  await page.fill('input[name="password"]', 'password');
  await page.click('text=Sign in');
  await page.context().storageState({ path: storageState });
  await browser.close();
};
```

```js js-flavor=ts
// global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL!);
  await page.fill('input[name="user"]', 'user');
  await page.fill('input[name="password"]', 'password');
  await page.click('text=Sign in');
  await page.context().storageState({ path: storageState as string });
  await browser.close();
}

export default globalSetup;
```

Specify `globalSetup`, `baseURL` and `storageState` in the configuration file.

```js js-flavor=js
// playwright.config.js
// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  globalSetup: require.resolve('./global-setup'),
  use: {
    baseURL: 'http://localhost:3000/',
    storageState: 'state.json',
  },
};
module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  globalSetup: require.resolve('./global-setup'),
  use: {
    baseURL: 'http://localhost:3000/',
    storageState: 'state.json',
  },
};
export default config;
```

Tests start already authenticated because we specify `storageState` that was populated by global setup.

```js js-flavor=ts
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  // You are signed in!
});
```

```js js-flavor=js
const { test } = require('@playwright/test');

test('test', async ({ page }) => {
  await page.goto('/');
  // You are signed in!
});
```

## Projects

Playwright Test supports running multiple test projects at the same time. This is useful for running the same tests in multiple configurations. For example, consider running tests against multiple versions of some REST backend.

To make use of this feature, we will declare an "option fixture" for the backend version, and use it in the tests.

```js js-flavor=js
// my-test.js
const base = require('@playwright/test');
const { startBackend } = require('./my-backend');

exports.test = base.test.extend({
  // Default value for the version.
  version: '1.0',

  // Use version when starting the backend.
  backendURL: async ({ version }, use) => {
    const app = await startBackend(version);
    await use(app.baseUrl());
    await app.close();
  },
});
```

```js js-flavor=ts
// my-test.ts
import { test as base } from '@playwright/test';
import { startBackend } from './my-backend';

export type TestOptions = {
  version: string;
  backendURL: string;
};

export const test = base.extend<TestOptions>({
  // Default value for the version.
  version: '1.0',

  // Use version when starting the backend.
  backendURL: async ({ version }, use) => {
    const app = await startBackend(version);
    await use(app.baseUrl());
    await app.close();
  },
});
```

We can use our fixtures in the test.
```js js-flavor=js
// example.spec.js
const { test } = require('./my-test');

test('test 1', async ({ page, backendURL }) => {
  await page.goto(`${backendURL}/index.html`);
  // ...
});

test('test 2', async ({ version, page, backendURL }) => {
  test.fixme(version === '2.0', 'This feature is not implemented in 2.0 yet');

  await page.goto(`${backendURL}/index.html`);
  // ...
});
```

```js js-flavor=ts
// example.spec.ts
import { test } from './my-test';

test('test 1', async ({ page, backendURL }) => {
  await page.goto(`${backendURL}/index.html`);
  // ...
});

test('test 2', async ({ version, page, backendURL }) => {
  test.fixme(version === '2.0', 'This feature is not implemented in 2.0 yet');

  await page.goto(`${backendURL}/index.html`);
  // ...
});
```

Now, we can run test in multiple configurations by using projects.
```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig<{ version: string }>} */
const config = {
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

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
import { TestOptions } from './my-test';

const config: PlaywrightTestConfig<TestOptions> = {
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

Each project can be configured separately, and run different set of tests with different parameters. See [project options][TestProject] for the list of options available to each project.

You can run all projects or just a single one:
```bash
# Run both projects - each test will be run twice
npx playwright test

# Run a single project - each test will be run once
npx playwright test --project=v2
```

There are many more things you can do with projects:
- Run a subset of test by specifying different `testDir` for each project.
- Run tests in multiple configurations, for example with desktop Chromium and emulating Chrome for Android.
- Run "core" tests without retries to ensure stability of the core functionality, and use `retries` for other tests.
- And much more! See [project options][TestProject] for the list of options available to each project.

## Add custom matchers using expect.extend

Playwright Test uses [`expect` library](https://jestjs.io/docs/expect) under the hood which has the functionality to extend it with [custom matchers](https://jestjs.io/docs/expect#expectextendmatchers).

In this example we add a custom `toBeWithinRange` function in the configuration file.
```js js-flavor=js
// playwright.config.js
const { expect } = require('@playwright/test');

expect.extend({
  toBeWithinRange(received, floor, ceiling) {
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

module.exports = {};
```

```js js-flavor=ts
// playwright.config.ts
import { expect, PlaywrightTestConfig } from '@playwright/test';

expect.extend({
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

const config: PlaywrightTestConfig = {};
export default config;
```

Now we can use `toBeWithinRange` in the test.
```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test('numeric ranges', () => {
  expect(100).toBeWithinRange(90, 110);
  expect(101).not.toBeWithinRange(0, 100);
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test('numeric ranges', () => {
  expect(100).toBeWithinRange(90, 110);
  expect(101).not.toBeWithinRange(0, 100);
});
```

For TypeScript, also add the following to `global.d.ts`. You don't need it for JavaScript.

```js
// global.d.ts
declare namespace PlaywrightTest {
  interface Matchers<R> {
    toBeWithinRange(a: number, b: number): R;
  }
}
```
