---
id: test-global-setup-teardown
title: "Global setup and teardown"
---

## Introduction

There are two ways to configure global setup and teardown: using a global setup file and setting it in the config under [`globalSetup`](#option-2-configure-globalsetup-and-globalteardown) or using [project dependencies](#option-1-project-dependencies). With project dependencies, you define a project that runs before all other projects. This is the recommended way to configure global setup as with Project dependencies your HTML report will show the global setup, trace viewer will record a trace of the setup and fixtures can be used.

## Option 1: Project Dependencies

[Project dependencies](./api/class-testproject#test-project-dependencies) are a list of projects that need to run before the tests in another project run. They can be useful for configuring the global setup actions so that one project depends on this running first. Using dependencies allows global setup to produce traces and other artifacts.

### Setup

First we add a new project with the name 'setup db'. We then give it a [`property: TestProject.testMatch`] property in order to match the file called `global.setup.ts`:

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // ...
  projects: [
    {
      name: 'setup db',
      testMatch: /global\.setup\.ts/,
    },
    // {
    //   other project
    // }
  ]
});
```
Then we add the [`property: TestProject.dependencies`] property to our projects that depend on the setup project and pass into the array the name of our dependency project, which we defined in the previous step:

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // ...
  projects: [
    {
      name: 'setup db',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium with db',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup db'],
    },
  ]
});
```

In this example the 'chromium with db' project depends on the 'setup db' project. We then create a setup test, stored at root level of your project (note that setup and teardown code must be defined as regular tests by calling [test()](./api/class-test#test-call) function):

```js title="tests/global.setup.ts"
import { test as setup } from '@playwright/test';

setup('create new database', async ({ }) => {
  console.log('creating new database...');
  // Initialize the database
});
```

```js title="tests/menu.spec.ts"
import { test, expect } from '@playwright/test';

test('menu', async ({ page }) => {
  // Your test that depends on the database
});
```

### Teardown

You can teardown your setup by adding a [`property: TestProject.teardown`] property to your setup project. This will run after all dependent projects have run.

First we add the [`property: TestProject.teardown`] property to our setup project with the name 'cleanup db' which is the name we gave to our teardown project in the previous step:

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  // ...
  projects: [
    {
      name: 'setup db',
      testMatch: /global\.setup\.ts/,
      teardown: 'cleanup db',
    },
    {
      name: 'cleanup db',
      testMatch: /global\.teardown\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup db'],
    },
  ]
});
```

Then we create a `global.teardown.ts` file in the tests directory of your project. This will be used to delete the data from the database after all tests have run.

```js title="tests/global.teardown.ts"
import { test as teardown } from '@playwright/test';

teardown('delete database', async ({ }) => {
  console.log('deleting test database...');
  // Delete the database
});
```

### More examples

For more detailed examples check out:
- our [authentication](./auth.md) guide
- our blog post [A better global setup in Playwright reusing login with project dependencies](https://dev.to/playwright/a-better-global-setup-in-playwright-reusing-login-with-project-dependencies-14)
- [v1.31 release video](https://youtu.be/PI50YAPTAs4) to see the demo

## Option 2: Configure globalSetup and globalTeardown

You can use the `globalSetup` option in the [configuration file](./test-configuration.md#advanced-configuration) to set something up once before running all tests. The global setup file must export a single function that takes a config object. This function will be run once before all the tests.

Similarly, use `globalTeardown` to run something once after all the tests. Alternatively, let `globalSetup` return a function that will be used as a global teardown. You can pass data such as port number, authentication tokens, etc. from your global setup to your tests using environment variables.

:::note
Using `globalSetup` and `globalTeardown` will not produce traces or artifacts, and options like `headless` or `testIdAttribute` specified in the config file are not applied. If you want to produce traces and artifacts and respect config options, use [project dependencies](#option-1-project-dependencies).
:::

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),
});
```

### Example

Here is a global setup example that authenticates once and reuses authentication state in tests. It uses the `baseURL` and `storageState` options from the configuration file.

```js title="global-setup.ts"
import { chromium, type FullConfig } from '@playwright/test';

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

```js title="playwright.config.ts"
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

```js
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('/');
  // You are signed in!
});
```

You can make arbitrary data available in your tests from your global setup file by setting them as environment variables via `process.env`.

```js title="global-setup.ts"
import type { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  process.env.FOO = 'some data';
  // Or a more complicated data structure as JSON:
  process.env.BAR = JSON.stringify({ some: 'data' });
}

export default globalSetup;
```

Tests have access to the `process.env` properties set in the global setup.

```js
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

### Capturing trace of failures during global setup

In some instances, it may be useful to capture a trace of failures encountered during the global setup. In order to do this, you must [start tracing](./api/class-tracing.md#tracing-start) in your setup, and you must ensure that you [stop tracing](./api/class-tracing.md#tracing-stop) if an error occurs before that error is thrown. This can be achieved by wrapping your setup in a `try...catch` block.  Here is an example that expands the global setup example to capture a trace.

```js title="global-setup.ts"
import { chromium, type FullConfig } from '@playwright/test';

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
    });
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
