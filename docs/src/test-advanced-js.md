---
id: test-advanced
title: "Advanced: configuration"
---

<!-- TOC -->

## Configuration object

Configuration file exports a single [TestConfig] object. See [TestConfig] properties for available configuration options.

Note that each [test project](#projects) can provide its own [options][TestProject], for example two projects can run different tests by providing different `testDir`s.

Here is an example that defines a common timeout and two projects. The "Smoke" project runs a small subset of tests without retries, and "Default" project runs all other tests with retries.

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
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
};
export default config;
```

```js js-flavor=js
// playwright.config.js
// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
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
};
module.exports = config;
```

## TestInfo object

Test functions, fixtures and hooks receive a [TestInfo] parameter that provides information about the currently running test as well as some useful utilities that include:
- Information about the test, for example `title`, `config` and `project`.
- Information about test execution, for example `expectedStatus` and `status`.
- Test artifact utilities, for example `outputPath()` and `attach()`.

See [TestInfo] methods and properties for all available information and utilities.

Here is an example test that saves information to a file using [TestInfo].
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

Here is an example fixture that automatically saves debug logs when the test fails.
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

If `port` is specified in the config, test runner will wait for `127.0.0.1:port` or `::1:port` to be available before running the tests.
If `url` is specified in the config, test runner will wait for that `url` to return 2xx response before running the tests.

For continuous integration, you may want to use the `reuseExistingServer: !process.env.CI` option which does not use an existing server on the CI. To see the stdout, you can set the `DEBUG=pw:webserver` environment variable.

The `port` (but not the `url`) gets passed over to Playwright as a [`property: TestOptions.baseURL`]. For example port `8080` produces `baseURL` equal `http://localhost:8080`.

:::note
It is also recommended to specify [`property: TestOptions.baseURL`] in the config, so that tests could use relative urls.
:::

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000/app/',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000/app/',
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
    url: 'http://localhost:3000/app/',
    timeout: 120 * 1000,
    reuseExistingServer: !process.env.CI,
  },
  use: {
    baseURL: 'http://localhost:3000/app/',
  },
};
module.exports = config;
```

Now you can use a relative path when navigating the page:

```js js-flavor=ts
// test.spec.ts
import { test } from '@playwright/test';
test('test', async ({ page }) => {
  // baseURL is set in the config to http://localhost:3000/app/
  // This will navigate to http://localhost:3000/app/login
  await page.goto('./login');
});
```

```js js-flavor=js
// test.spec.js
const { test } = require('@playwright/test');
test('test', async ({ page }) => {
  // baseURL is set in the config to http://localhost:3000/app/
  // This will navigate to http://localhost:3000/app/login
  await page.goto('./login');
});
```

## Global setup and teardown

To set something up once before running all tests, use `globalSetup` option in the [configuration file](#configuration-object). Global setup file must export a single function that takes a config object. This function will be run once before all the tests.

Similarly, use `globalTeardown` to run something once after all the tests. Alternatively, let `globalSetup` return a function that will be used as a global teardown. You can pass data such as port number, authentication tokens, etc. from your global setup to your tests using environment variables.

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

You can make arbitrary data available in your tests from your global setup file by setting them as environment variables via `process.env`.

```js js-flavor=js
// global-setup.js
module.exports = async config => {
  process.env.FOO = 'some data';
  // Or a more complicated data structure as JSON:
  process.env.BAR = JSON.stringify({ some: 'data' });
};
```

```js js-flavor=ts
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

```js js-flavor=ts
import { test } from '@playwright/test';
const { FOO, BAR } = process.env;

test('test', async ({ page }) => {
  // FOO and BAR properties are populated.
  expect(FOO).toEqual('some data');

  const complexData = JSON.parse(BAR);
  expect(BAR).toEqual({ some: 'data' });
});
```

```js js-flavor=js
const { test } = require('@playwright/test');
const { FOO, BAR } = process.env;

test('test', async ({ page }) => {
  // FOO and BAR properties are populated.
  expect(FOO).toEqual('some data');

  const complexData = JSON.parse(BAR);
  expect(BAR).toEqual({ some: 'data' });
});
```

## Projects

Playwright Test supports running multiple test projects at the same time. This is useful for running the same or different tests in multiple configurations.

### Same tests, different configuration

Here is an example that runs the same tests in different browsers:
```js js-flavor=js
// playwright.config.js
// @ts-check
const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
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
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
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
};
export default config;
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

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
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
};
export default config;
```

```js js-flavor=js
// playwright.config.js
// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
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
};
module.exports = config;
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
declare global {
 namespace PlaywrightTest {
    interface Matchers<R, T> {
      toBeWithinRange(a: number, b: number): R;
    }
  }
}
```
