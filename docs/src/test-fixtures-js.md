---
id: test-fixtures
title: "Advanced: fixtures"
---

<!-- TOC -->

## Introduction to fixtures

Playwright Test is based on the concept of test fixtures. Test fixtures are used to establish environment for each test, giving the test everything it needs and nothing else. Test fixtures are isolated between tests. With fixtures, you can group tests based on their meaning, instead of their common setup.

### Built-in fixtures

You have already used test fixtures in your first test.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const title = page.locator('.navbar__inner .navbar__title');
  await expect(title).toHaveText('Playwright');
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const title = page.locator('.navbar__inner .navbar__title');
  await expect(title).toHaveText('Playwright');
});
```

The `{ page }` argument tells Playwright Test to setup the `page` fixture and provide it to your test function.

Here is a list of the pre-defined fixtures that you are likely to use most of the time:

|Fixture    |Type             |Description                      |
|:----------|:----------------|:--------------------------------|
|page       |[Page]           |Isolated page for this test run. |
|context    |[BrowserContext] |Isolated context for this test run. The `page` fixture belongs to this context as well. Learn how to [configure context](./test-configuration.md). |
|browser    |[Browser]        |Browsers are shared across tests to optimize resources. Learn how to [configure browser](./test-configuration.md). |
|browserName|[string]         |The name of the browser currently running the test. Either `chromium`, `firefox` or `webkit`.|

### Without fixtures

Here is how typical test environment setup differs between traditional test style and the fixture-based one.

We assume a `TodoPage` class that helps interacting with a "todo list" page of the web app, following the [Page Object Model](./test-pom.md) pattern. It uses Playwright's `page` internally.

```js
// todo.spec.js
const { test } = require('@playwright/test');
const { TodoPage } = require('./todo-page');

test.describe('todo tests', () => {
  let todoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo('item1');
    await todoPage.addToDo('item2');
  });

  test.afterEach(async () => {
    await todoPage.removeAll();
  });

  test('should add an item', async () => {
    await todoPage.addToDo('my item');
    // ...
  });

  test('should remove an item', async () => {
    await todoPage.remove('item1');
    // ...
  });
});
```

### With fixtures

Fixtures have a number of advantages over before/after hooks:
- Fixtures **encapsulate** setup and teardown in the same place so it is easier to write.
- Fixtures are **reusable** between test files - you can define them once and use in all your tests. That's how Playwright's built-in `page` fixture works.
- Fixtures are **on-demand** - you can define as many fixtures as you'd like, and Playwright Test will setup only the ones needed by your test and nothing else.
- Fixtures are **composable** - they can depend on each other to provide complex behaviors.
- Fixtures are **flexible**. Tests can use any combinations of the fixtures to tailor precise environment they need, without affecting other tests.
- Fixtures simplify **grouping**. You no longer need to wrap tests in `describe`s that set up environment, and are free to group your tests by their meaning instead.

```js js-flavor=js
// todo.spec.js
const base = require('@playwright/test');
const { TodoPage } = require('./todo-page');

// Extend basic test by providing a "todoPage" fixture.
const test = base.test.extend({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo('item1');
    await todoPage.addToDo('item2');
    await use(todoPage);
    await todoPage.removeAll();
  },
});

test('should add an item', async ({ todoPage }) => {
  await todoPage.addToDo('my item');
  // ...
});

test('should remove an item', async ({ todoPage }) => {
  await todoPage.remove('item1');
  // ...
});
```

```js js-flavor=ts
// example.spec.ts
import { test as base } from '@playwright/test';
import { TodoPage } from './todo-page';

// Extend basic test by providing a "todoPage" fixture.
const test = base.extend<{ todoPage: TodoPage }>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo('item1');
    await todoPage.addToDo('item2');
    await use(todoPage);
    await todoPage.removeAll();
  },
});

test('should add an item', async ({ todoPage }) => {
  await todoPage.addToDo('my item');
  // ...
});

test('should remove an item', async ({ todoPage }) => {
  await todoPage.remove('item1');
  // ...
});
```

## Creating a fixture

To create your own fixture, use [`method: Test.extend`] to create a new `test` object that will include it.

Below we create two fixtures `todoPage` and `settingsPage` that follow the [Page Object Model](./test-pom.md) pattern.

```js js-flavor=js
// my-test.js
const base = require('@playwright/test');
const { TodoPage } = require('./todo-page');
const { SettingsPage } = require('./settings-page');

// Extend base test by providing "todoPage" and "settingsPage".
// This new "test" can be used in multiple test files, and each of them will get the fixtures.
exports.test = base.test.extend({
  todoPage: async ({ page }, use) => {
    // Set up the fixture.
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo('item1');
    await todoPage.addToDo('item2');

    // Use the fixture value in the test.
    await use(todoPage);

    // Clean up the fixture.
    await todoPage.removeAll();
  },

  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});
exports.expect = base.expect;
```

```js js-flavor=ts
// my-test.ts
import { test as base } from '@playwright/test';
import { TodoPage } from './todo-page';
import { SettingsPage } from './settings-page';

// Declare the types of your fixtures.
type MyFixtures = {
  todoPage: TodoPage;
  settingsPage: SettingsPage;
};

// Extend base test by providing "todoPage" and "settingsPage".
// This new "test" can be used in multiple test files, and each of them will get the fixtures.
export const test = base.extend<MyFixtures>({
  todoPage: async ({ page }, use) => {
    // Set up the fixture.
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo('item1');
    await todoPage.addToDo('item2');

    // Use the fixture value in the test.
    await use(todoPage);

    // Clean up the fixture.
    await todoPage.removeAll();
  },

  settingsPage: async ({ page }, use) => {
    await use(new SettingsPage(page));
  },
});
export { expect } from '@playwright/test';
```

## Using a fixture

Just mention fixture in your test function argument, and test runner will take care of it. Fixtures are also available in hooks and other fixtures. If you use TypeScript, fixtures will have the right type.

Below we use the `todoPage` and `settingsPage` fixtures defined above.

```js js-flavor=js
const { test, expect } = require('./my-test');

test.beforeEach(async ({ settingsPage }) => {
  await settingsPage.switchToDarkMode();
});

test('basic test', async ({ todoPage, page }) => {
  await todoPage.addToDo('something nice');
  await expect(page.locator('.todo-item')).toContainText(['something nice']);
});
```

```js js-flavor=ts
import { test, expect } from './my-test';

test.beforeEach(async ({ settingsPage }) => {
  await settingsPage.switchToDarkMode();
});

test('basic test', async ({ todoPage, page }) => {
  await todoPage.addToDo('something nice');
  await expect(page.locator('.todo-item')).toContainText(['something nice']);
});
```

## Overriding fixtures

In addition to creating your own fixtures, you can also override existing fixtures to fit your needs. Consider the following example which overrides the `page` fixture by automatically navigating to some `baseURL`:

```js js-flavor=js
const base = require('@playwright/test');

exports.test = base.test.extend({
  page: async ({ baseURL, page }, use) => {
    await page.goto(baseURL);
    await use(page);
  },
});
```

```js js-flavor=ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  page: async ({ baseURL, page }, use) => {
    await page.goto(baseURL);
    await use(page);
  },
});
```

Notice that in this example, the `page` fixture is able to depend on other built-in fixtures such as [`property: TestOptions.baseURL`]. We can now configure `baseURL` in the configuration file, or locally in the test file with [`method: Test.use`].

```js js-flavor=js
// example.spec.js

test.use({ baseURL: 'https://playwright.dev' });
```

```js js-flavor=ts
// example.spec.ts

test.use({ baseURL: 'https://playwright.dev' });
```

Fixtures can also be overridden where the base fixture is completely replaced with something different. For example, we could override the [`property: TestOptions.storageState`] fixture to provide our own data.

```js js-flavor=js
const base = require('@playwright/test');

exports.test = base.test.extend({
  storageState: async ({}, use) => {
    const cookie = await getAuthCookie();
    await use({ cookies: [cookie] });
  },
});
```

```js js-flavor=ts
import { test as base } from '@playwright/test';

export const test = base.extend({
  storageState: async ({}, use) => {
    const cookie = await getAuthCookie();
    await use({ cookies: [cookie] });
  },
});
```

## Worker-scoped fixtures

Playwright Test uses [worker processes](./test-parallel.md) to run test files. Similarly to how test fixtures are set up for individual test runs, worker fixtures are set up for each worker process. That's where you can set up services, run servers, etc. Playwright Test will reuse the worker process for as many test files as it can, provided their worker fixtures match and hence environments are identical.

Below we'll create an `account` fixture that will be shared by all tests in the same worker, and override the `page` fixture to login into this account for each test. To generate unique accounts, we'll use the [`property: WorkerInfo.workerIndex`] that is available to any test or fixture. Note the tuple-like syntax for the worker fixture - we have to pass `{scope: 'worker'}` so that test runner sets up this fixture once per worker.

```js js-flavor=js
// my-test.js
const base = require('@playwright/test');

exports.test = base.test.extend({
  account: [async ({ browser }, use, workerInfo) => {
    // Unique username.
    const username = 'user' + workerInfo.workerIndex;
    const password = 'verysecure';

    // Create the account with Playwright.
    const page = await browser.newPage();
    await page.goto('/signup');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('text=Sign up').click();
    // Make sure everything is ok.
    await expect(page.locator('#result')).toHaveText('Success');
    // Do not forget to cleanup.
    await page.close();

    // Use the account value.
    await use({ username, password });
  }, { scope: 'worker' }],

  page: async ({ page, account }, use) => {
    // Sign in with our account.
    await page.goto('/signin');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('text=Sign in').click();
    await expect(page.locator('#userinfo')).toHaveText(username);

    // Use signed-in page in the test.
    await use(page);
  },
});
exports.expect = base.expect;
```

```js js-flavor=ts
// my-test.ts
import { test as base } from '@playwright/test';

type Account = {
  username: string;
  password: string;
};

// Note that we pass worker fixture types as a second template parameter.
export const test = base.extend<{}, { account: Account }>({
  account: [async ({ browser }, use, workerInfo) => {
    // Unique username.
    const username = 'user' + workerInfo.workerIndex;
    const password = 'verysecure';

    // Create the account with Playwright.
    const page = await browser.newPage();
    await page.goto('/signup');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('text=Sign up').click();
    // Make sure everything is ok.
    await expect(page.locator('#result')).toHaveText('Success');
    // Do not forget to cleanup.
    await page.close();

    // Use the account value.
    await use({ username, password });
  }, { scope: 'worker' }],

  page: async ({ page, account }, use) => {
    // Sign in with our account.
    await page.goto('/signin');
    await page.locator('#username').fill(username);
    await page.locator('#password').fill(password);
    await page.locator('text=Sign in').click();
    await expect(page.locator('#userinfo')).toHaveText(username);

    // Use signed-in page in the test.
    await use(page);
  },
});
export { expect } from '@playwright/test';
```

## Automatic fixtures

Automatic fixtures are set up for each test/worker, even when the test does not list them directly. To create an automatic fixture, use the tuple syntax and pass `{ auto: true }`.

Here is an example fixture that automatically attaches debug logs when the test fails, so we can later review the logs in the reporter. Note how it uses [TestInfo] object that is available in each test/fixture to retrieve metadata about the test being run.

```js js-flavor=js
// my-test.js
const debug = require('debug');
const fs = require('fs');
const base = require('@playwright/test');

exports.test = base.test.extend({
  saveLogs: [async ({}, use, testInfo) => {
    // Collecting logs during the test.
    const logs = [];
    debug.log = (...args) => logs.push(args.map(String).join(''));
    debug.enable('myserver');

    await use();

    // After the test we can check whether the test passed or failed.
    if (testInfo.status !== testInfo.expectedStatus) {
      // outputPath() API guarantees a unique file name.
      const logFile = testInfo.outputPath('logs.txt');
      await fs.promises.writeFile(logFile, logs.join('\n'), 'utf8');
      testInfo.attachments.push({ name: 'logs', contentType: 'text/plain', path: logFile });
    }
  }, { auto: true }],
});
```

```js js-flavor=ts
// my-test.ts
import * as debug from 'debug';
import * as fs from 'fs';
import { test as base } from '@playwright/test';

export const test = base.extend<{ saveLogs: void }>({
  saveLogs: [async ({}, use, testInfo) => {
    // Collecting logs during the test.
    const logs = [];
    debug.log = (...args) => logs.push(args.map(String).join(''));
    debug.enable('myserver');

    await use();

    // After the test we can check whether the test passed or failed.
    if (testInfo.status !== testInfo.expectedStatus) {
      // outputPath() API guarantees a unique file name.
      const logFile = testInfo.outputPath('logs.txt');
      await fs.promises.writeFile(logFile, logs.join('\n'), 'utf8');
      testInfo.attachments.push({ name: 'logs', contentType: 'text/plain', path: logFile });
    }
  }, { auto: true }],
});
export { expect } from '@playwright/test';
```

## Fixtures-options

Playwright Test supports running multiple test projects that can be separately configured. You can use "option" fixtures to make your configuration options declarative and type-checked. Learn more about [parametrizing tests](./test-parameterize.md).

Below we'll create a `defaultItem` option in addition to the `todoPage` fixture from other examples. This option will be set in configuration file. Note the tuple syntax and `{ option: true }` argument.


```js js-flavor=js
// my-test.js
const base = require('@playwright/test');
const { TodoPage } = require('./todo-page');

exports.test = base.test.extend({
  // Define an option and provide a default value.
  // We can later override it in the config.
  defaultItem: ['Something nice', { option: true }],

  // Our "todoPage" fixture depends on the option.
  todoPage: async ({ page, defaultItem }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo(defaultItem);
    await use(todoPage);
    await todoPage.removeAll();
  },
});
exports.expect = base.expect;
```

```js js-flavor=ts
// my-test.ts
import { test as base } from '@playwright/test';
import { TodoPage } from './todo-page';

// Declare your options to type-check your configuration.
export type MyOptions = {
  defaultItem: string;
};
type MyFixtures = {
  todoPage: TodoPage;
};

// Specify both option and fixture types.
export const test = base.extend<MyOptions & MyFixtures>({
  // Define an option and provide a default value.
  // We can later override it in the config.
  defaultItem: ['Something nice', { option: true }],

  // Our "todoPage" fixture depends on the option.
  todoPage: async ({ page, defaultItem }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo(defaultItem);
    await use(todoPage);
    await todoPage.removeAll();
  },
});
export { expect } from '@playwright/test';
```

We can now use `todoPage` fixture as usual, and set the `defaultItem` option in the config file.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig<{ defaultItem: string }>} */
const config = {
  projects: [
    {
      name: 'shopping',
      use: { defaultItem: 'Buy milk' },
    },
    {
      name: 'wellbeing',
      use: { defaultItem: 'Exercise!' },
    },
  ]
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
import { MyOptions } from './my-test';

const config: PlaywrightTestConfig<MyOptions> = {
  projects: [
    {
      name: 'shopping',
      use: { defaultItem: 'Buy milk' },
    },
    {
      name: 'wellbeing',
      use: { defaultItem: 'Exercise!' },
    },
  ]
};
export default config;
```
