---
id: test-advanced
title: "Advanced: configuration"
---

## Configuration object

Configuration file exports a single [TestConfig] object. See [TestConfig] properties for available configuration options.

Note that each [test project](#projects) can provide its own [options][TestProject], for example two projects can run different tests by providing different `testDir`s.

Here is an example that defines a common timeout and two projects. The "Smoke" project runs a small subset of tests without retries, and "Default" project runs all other tests with retries.

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  timeout: 60000, // Timeout is shared between all tests.
  projects: [
    {
      name: 'Smoke',
      testMatch: /.*smoke.spec.ts/,
      retries: 0,
    },
    {
      name: 'Default',
      testIgnore: /.*smoke.spec.ts/,
      retries: 2,
    },
  ],
});
```

```js tab=js-js
// playwright.config.js
// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  timeout: 60000, // Timeout is shared between all tests.
  projects: [
    {
      name: 'Smoke',
      testMatch: /.*smoke.spec.ts/,
      retries: 0,
    },
    {
      name: 'Default',
      testIgnore: /.*smoke.spec.ts/,
      retries: 2,
    },
  ],
});
```

## TestInfo object

Test functions, fixtures and hooks receive a [TestInfo] parameter that provides information about the currently running test as well as some useful utilities that include:
- Information about the test, for example `title`, `config` and `project`.
- Information about test execution, for example `expectedStatus` and `status`.
- Test artifact utilities, for example `outputPath()` and `attach()`.

See [TestInfo] methods and properties for all available information and utilities.

Here is an example test that saves information to a file using [TestInfo].
```js tab=js-js
// example.spec.js
const { test } = require('@playwright/test');

test('my test needs a file', async ({ table }, testInfo) => {
  // Do something with the table...
  // ... and then save contents.
  const filePath = testInfo.outputPath('table.dat');
  await table.saveTo(filePath);
});
```

```js tab=js-ts
// example.spec.ts
import { test } from '@playwright/test';

test('my test needs a file', async ({ table }, testInfo) => {
  // Do something with the table...
  // ... and then save contents.
  const filePath = testInfo.outputPath('table.dat');
  await table.saveTo(filePath);
});
```

Here is an example fixture that automatically saves debug logs when the test fails.
```js tab=js-js
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

```js tab=js-ts
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

If `port` is specified in the config, test runner will wait for `127.0.0.1:port` or `::1:port` to be available before running the tests.
If `url` is specified in the config, test runner will wait for that `url` to return a 2xx, 3xx, 400, 401, 402, or 403 response before running the tests.

For continuous integration, you may want to use the `reuseExistingServer: !process.env.CI` option which does not use an existing server on the CI. To see the stdout, you can set the `DEBUG=pw:webserver` environment variable.

The `port` (but not the `url`) gets passed over to Playwright as a [`property: TestOptions.baseURL`]. For example port `8080` produces `baseURL` equal `http://localhost:8080`.

:::note
It is also recommended to specify [`property: TestOptions.baseURL`] in the config, so that tests could use relative urls.
:::

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000/app/',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000/app/',
  },
});
```

```js tab=js-js
// playwright.config.js
// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000/app/',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000/app/',
  },
});
```

Now you can use a relative path when navigating the page:

```js tab=js-ts
// test.spec.ts
import { test } from '@playwright/test';
test('test', async ({ page }) => {
  // baseURL is set in the config to http://localhost:3000/app/
  // This will navigate to http://localhost:3000/app/login
  await page.goto('./login');
});
```

```js tab=js-js
// test.spec.js
const { test } = require('@playwright/test');
test('test', async ({ page }) => {
  // baseURL is set in the config to http://localhost:3000/app/
  // This will navigate to http://localhost:3000/app/login
  await page.goto('./login');
});
```

Multiple web servers (or background processes) can be launched simultaneously by providing an array of `webServer` configurations. See [`property: TestConfig.webServer`] for additional examples and documentation.

## Global setup and teardown

To set something up once before running all tests, use `globalSetup` option in the [configuration file](#configuration-object). Global setup file must export a single function that takes a config object. This function will be run once before all the tests.

Similarly, use `globalTeardown` to run something once after all the tests. Alternatively, let `globalSetup` return a function that will be used as a global teardown. You can pass data such as port number, authentication tokens, etc. from your global setup to your tests using environment variables.

Here is a global setup example that authenticates once and reuses authentication state in tests. It uses `baseURL` and `storageState` options from the configuration file.

```js tab=js-js
// global-setup.js
const { chromium } = require('@playwright/test');

module.exports = async config => {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL);
  await page.getByLabel('User Name').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByText('Sign in').click();
  await page.context().storageState({ path: storageState });
  await browser.close();
};
```

```js tab=js-ts
// global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL!);
  await page.getByLabel('User Name').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByText('Sign in').click();
  await page.context().storageState({ path: storageState as string });
  await browser.close();
}

export default globalSetup;
```

Specify `globalSetup`, `baseURL` and `storageState` in the configuration file.

```js tab=js-js
// playwright.config.js
// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  globalSetup: require.resolve('./global-setup'),
  use: {
    baseURL: 'http://localhost:3000/',
    storageState: 'state.json',
  },
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  use: {
    baseURL: 'http://localhost:3000/',
    storageState: 'state.json',
  },
});
```

Tests start already authenticated because we specify `storageState` that was populated by global setup.

```js tab=js-ts
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  // You are signed in!
});
```

```js tab=js-js
const { test } = require('@playwright/test');

test('test', async ({ page }) => {
  await page.goto('/');
  // You are signed in!
});
```

You can make arbitrary data available in your tests from your global setup file by setting them as environment variables via `process.env`.

```js tab=js-js
// global-setup.js
module.exports = async config => {
  process.env.FOO = 'some data';
  // Or a more complicated data structure as JSON:
  process.env.BAR = JSON.stringify({ some: 'data' });
};
```

```js tab=js-ts
// global-setup.ts
import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  process.env.FOO = 'some data';
  // Or a more complicated data structure as JSON:
  process.env.BAR = JSON.stringify({ some: 'data' });
}

export default globalSetup;
```

Tests have access to the `process.env` properties set in the global setup.

```js tab=js-ts
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  // environment variables which are set in globalSetup are only available inside test().
  const { FOO, BAR } = process.env;

  // FOO and BAR properties are populated.
  expect(FOO).toEqual('some data');

  const complexData = JSON.parse(BAR);
  expect(BAR).toEqual({ some: 'data' });
});
```

```js tab=js-js
const { test } = require('@playwright/test');

test('test', async ({ page }) => {
  // environment variables which are set in globalSetup are only available inside test().
  const { FOO, BAR } = process.env;

  // FOO and BAR properties are populated.
  expect(FOO).toEqual('some data');

  const complexData = JSON.parse(BAR);
  expect(BAR).toEqual({ some: 'data' });
});
```

### Capturing trace of failures during global setup

In some instances, it may be useful to capture a trace of failures encountered during the global setup. In order to do this, you must [start tracing](./api/class-tracing.md#tracing-start) in your setup, and you must ensure that you [stop tracing](./api/class-tracing.md#tracing-stop) if an error occurs before that error is thrown. This can be achieved by wrapping your setup in a `try...catch` block.  Here is an example that expands the global setup example to capture a trace.

```js tab=js-js
// global-setup.js
const { chromium } = require('@playwright/test');

module.exports = async config => {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await context.tracing.start({ screenshots: true, snapshots: true });
    await page.goto(baseURL);
    await page.getByLabel('User Name').fill('user');
    await page.getByLabel('Password').fill('password');
    await page.getByText('Sign in').click();
    await context.storageState({ path: storageState });
    await context.tracing.stop({
      path: './test-results/setup-trace.zip',
    })
    await browser.close();
  } catch (error) {
    await context.tracing.stop({
      path: './test-results/failed-setup-trace.zip',
    });
    await browser.close();
    throw error;
  }
};
```

```js tab=js-ts
// global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL, storageState } = config.projects[0].use;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await context.tracing.start({ screenshots: true, snapshots: true });
    await page.goto(baseURL!);
    await page.getByLabel('User Name').fill('user');
    await page.getByLabel('Password').fill('password');
    await page.getByText('Sign in').click();
    await context.storageState({ path: storageState as string });
    await context.tracing.stop({
      path: './test-results/setup-trace.zip',
    })
    await browser.close();
  } catch (error) {
    await context.tracing.stop({
      path: './test-results/failed-setup-trace.zip',
    });
    await browser.close();
    throw error;
  }
}

export default globalSetup;
```

## Projects

Playwright Test supports running multiple test projects at the same time. This is useful for running the same or different tests in multiple configurations.

### Same tests, different configuration

Here is an example that runs the same tests in different browsers:
```js tab=js-js
// playwright.config.js
// @ts-check
const { devices } = require('@playwright/test');

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
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
  ],
});
```

```js tab=js-ts
// playwright.config.ts
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
  ],
});
```

You can run all projects or just a single one:
```bash
# Run both projects - each test will be run three times
npx playwright test

# Run a single project - each test will be run once
npx playwright test --project=chromium
```

### Different tests, different configuration

Each project can be configured separately, and run different set of tests with different options. You can use [`property: TestProject.testDir`], [`property: TestProject.testMatch`] and [`property: TestProject.testIgnore`] to configure which tests should the project run.

Here is an example that runs projects with different tests and configurations. The "Smoke" project runs a small subset of tests without retries, and "Default" project runs all other tests with retries.

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
export default defineConfig({
  timeout: 60000, // Timeout is shared between all tests.
  projects: [
    {
      name: 'Smoke',
      testMatch: /.*smoke.spec.ts/,
      retries: 0,
    },
    {
      name: 'Default',
      testIgnore: /.*smoke.spec.ts/,
      retries: 2,
    },
  ],
});
```

```js tab=js-js
// playwright.config.js
// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  timeout: 60000, // Timeout is shared between all tests.
  projects: [
    {
      name: 'Smoke',
      testMatch: /.*smoke.spec.ts/,
      retries: 0,
    },
    {
      name: 'Default',
      testIgnore: /.*smoke.spec.ts/,
      retries: 2,
    },
  ],
});
```

You can run all projects or just a single one:
```bash
# Run both projects
npx playwright test

# Run a single project
npx playwright test --project=Smoke
```

### Custom project parameters

Projects can be also used to parametrize tests with your custom configuration - take a look at [this separate guide](./test-parameterize.md#parameterized-projects).

## WorkerInfo object

Depending on the configuration and failures, Playwright Test might use different number of worker processes to run all the tests. For example, Playwright Test will always start a new worker process after a failing test.

Worker-scoped fixtures receive a [WorkerInfo] parameter that describes the current worker configuration. See [WorkerInfo] properties for available worker information.

Consider an example where we run a new http server per worker process, and use `workerIndex` to produce a unique port number:

```js tab=js-js
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

```js tab=js-ts
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

## Add custom matchers using expect.extend

You can extend Playwright assertions by providing custom matchers. These matchers will be available on the `expect` object.

In this example we add a custom `toBeWithinRange` function in the configuration file. Custom matcher should return a `message` callback and a `pass` flag indicating whether the assertion passed.

```js tab=js-js
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

```js tab=js-ts
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

import { defineConfig } from '@playwright/test';
export default defineConfig({});
```

Now we can use `toBeWithinRange` in the test.
```js tab=js-js
// example.spec.js
const { test, expect } = require('@playwright/test');

test('numeric ranges', () => {
  expect(100).toBeWithinRange(90, 110);
  expect(101).not.toBeWithinRange(0, 100);
});
```

```js tab=js-ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test('numeric ranges', () => {
  expect(100).toBeWithinRange(90, 110);
  expect(101).not.toBeWithinRange(0, 100);
});
```

:::note
Do not confuse Playwright's `expect` with the [`expect` library](https://jestjs.io/docs/expect). The latter is not fully integrated with Playwright test runner, so make sure to use Playwright's own `expect`.
:::

For TypeScript, also add the following to your [`global.d.ts`](https://www.typescriptlang.org/docs/handbook/declaration-files/templates/global-d-ts.html). If it does not exist, you need to create it inside your repository. Make sure that your `global.d.ts` gets included inside your `tsconfig.json` via the `include` or `compilerOptions.typeRoots` option so that your IDE will pick it up.

You don't need it for JavaScript.

```js
// global.d.ts
export {};

declare global {
 namespace PlaywrightTest {
    interface Matchers<R, T> {
      toBeWithinRange(a: number, b: number): R;
    }
  }
}
```
