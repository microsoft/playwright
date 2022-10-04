---
id: test-auth
title: "Authentication"
---

Tests written with Playwright execute in isolated clean-slate environments called
[browser contexts](./browser-contexts.md). Each test gets a brand
new page created in a brand new context. This isolation model improves reproducibility
and prevents cascading test failures.

Below are the typical strategies for implementing the signed-in scenarios.

<!-- TOC -->

## Sign in with beforeEach

This is the simplest way where each test signs in inside the `beforeEach` hook. It also is the
least efficient one in case the log in process has high latencies.

```js tab=js-ts
import { test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Runs before each test and signs in each page.
  await page.goto('https://github.com/login');
  await page.getByText('Login').click();
  await page.getByLabel('User Name').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByText('Submit').click();
});

test('first', async ({ page }) => {
  // page is signed in.
});

test('second', async ({ page }) => {
  // page is signed in.
});
```

```js tab=js-js
const { test } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Runs before each test and signs in each page.
  await page.goto('https://github.com/login');
  await page.getByText('Login').click();
  await page.getByLabel('User Name').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByText('Sign in').click();
});

test('first', async ({ page }) => {
  // page is signed in.
});

test('second', async ({ page }) => {
  // page is signed in.
});
```

Redoing login for every test can slow down test execution. To mitigate that, reuse
existing authentication state instead.

## Reuse signed in state

Playwright provides a way to reuse the signed-in state in the tests. That way you can log
in only once and then skip the log in step for all of the tests.

Create a new global setup script:

```js tab=js-js
// global-setup.js
const { chromium } = require('@playwright/test');

module.exports = async config => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://github.com/login');
  await page.getByLabel('User Name').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByText('Sign in').click();
  // Save signed-in state to 'storageState.json'.
  await page.context().storageState({ path: 'storageState.json' });
  await browser.close();
};
```

```js tab=js-ts
// global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://github.com/login');
  await page.getByLabel('User Name').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByText('Sign in').click();
  // Save signed-in state to 'storageState.json'.
  await page.context().storageState({ path: 'storageState.json' });
  await browser.close();
}

export default globalSetup;
```

Register global setup script in the Playwright configuration file:

```js tab=js-ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  globalSetup: require.resolve('./global-setup'),
  use: {
    // Tell all tests to load signed-in state from 'storageState.json'.
    storageState: 'storageState.json'
  }
};
export default config;
```

```js tab=js-js
// playwright.config.js
// @ts-check
/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  globalSetup: require.resolve('./global-setup'),
  use: {
    // Tell all tests to load signed-in state from 'storageState.json'.
    storageState: 'storageState.json'
  }
};
module.exports = config;
```

Tests start already authenticated because we specify `storageState` that was populated by global setup.

```js tab=js-ts
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  // page is signed in.
});
```

```js tab=js-js
const { test } = require('@playwright/test');

test('test', async ({ page }) => {
  // page is signed in.
});
```

:::note
If you can log in once and commit the `storageState.json` into the repository, you won't need the global
setup at all, just specify the `storageState.json` in Playwright Config as above and it'll be picked up.

However, periodically, you may need to update the `storageState.json` file if your app requires you to re-authenticate after some amount of time. For example, if your app prompts you to sign in every week even if you're on the same computer/browser, you'll need to update `storageState.json` at least this often.
:::

### Sign in via API request

If your web application supports signing in via API, you can use [APIRequestContext] to simplify sign in flow. Global setup script from the example above would change like this:

```js tab=js-js
// global-setup.js
const { request } = require('@playwright/test');

module.exports = async () => {
  const requestContext = await request.newContext();
  await requestContext.post('https://github.com/login', {
    form: {
      'user': 'user',
      'password': 'password'
    }
  });
  // Save signed-in state to 'storageState.json'.
  await requestContext.storageState({ path: 'storageState.json' });
  await requestContext.dispose();
}
```

```js tab=js-ts
// global-setup.ts
import { request } from '@playwright/test';

async function globalSetup() {
  const requestContext = await request.newContext();
  await requestContext.post('https://github.com/login', {
    form: {
      'user': 'user',
      'password': 'password'
    }
  });
  // Save signed-in state to 'storageState.json'.
  await requestContext.storageState({ path: 'storageState.json' });
  await requestContext.dispose();
}

export default globalSetup;
```

### Avoiding multiple sessions per account at a time

By default, Playwright Test runs tests in parallel. If you reuse a single signed-in state for all your tests, this usually leads to the same account being signed in from multiple tests at the same time. If this behavior is undesirable for your application, you can sign in with a different account in each [worker process](./test-parallel.md#worker-processes) created by Playwright Test.

In this example we [override `storageState` fixture](./test-fixtures.md#overriding-fixtures) and ensure we only sign in once per worker, using [`property: TestInfo.workerIndex`] to differentiate between workers.

```js tab=js-js
// fixtures.js
const { test: base } = require('@playwright/test');

const users = [
  { username: 'user-1', password: 'password-1' },
  { username: 'user-2', password: 'password-2' },
  // ... put your test users here ...
];

exports.test = base.extend({
  storageState: async ({ browser }, use, testInfo) => {
    // Override storage state, use worker index to look up logged-in info and generate it lazily.
    const fileName = path.join(testInfo.project.outputDir, 'storage-' + testInfo.workerIndex);
    if (!fs.existsSync(fileName)) {
      // Make sure we are not using any other storage state.
      const page = await browser.newPage({ storageState: undefined });
      await page.goto('https://github.com/login');
      await page.getByLabel('User Name').fill(users[testInfo.workerIndex].username);
      await page.getByLabel('Password').fill(users[testInfo.workerIndex].password);
      await page.getByText('Sign in').click();
      await page.context().storageState({ path: fileName });
      await page.close();
    }
    await use(fileName);
  },
});
exports.expect = base.expect;

// example.spec.js
const { test, expect } = require('./fixtures');

test('test', async ({ page }) => {
  // page is signed in.
});
```

```js tab=js-ts
// fixtures.ts
import { test as baseTest } from '@playwright/test';
export { expect } from '@playwright/test';

const users = [
  { username: 'user-1', password: 'password-1' },
  { username: 'user-2', password: 'password-2' },
  // ... put your test users here ...
];

export const test = baseTest.extend({
  storageState: async ({ browser }, use, testInfo) => {
    // Override storage state, use worker index to look up logged-in info and generate it lazily.
    const fileName = path.join(testInfo.project.outputDir, 'storage-' + testInfo.workerIndex);
    if (!fs.existsSync(fileName)) {
      // Make sure we are not using any other storage state.
      const page = await browser.newPage({ storageState: undefined });
      await page.goto('https://github.com/login');
      // Create a unique username for each worker.
      await page.getByLabel('User Name').fill(users[testInfo.workerIndex].username);
      await page.getByLabel('Password').fill(users[testInfo.workerIndex].password);
      await page.getByText('Sign in').click();
      await page.context().storageState({ path: fileName });
      await page.close();
    }
    await use(fileName);
  },
});

// example.spec.ts
import { test, expect } from './fixtures';

test('test', async ({ page }) => {
  // page is signed in.
});
```

## Multiple signed in roles

Sometimes you have more than one signed-in user in your end to end tests. You can achieve that via logging in for these users multiple times in globalSetup and saving that state into different files.

```js tab=js-js
// global-setup.js
const { chromium } = require('@playwright/test');

module.exports = async config => {
  const browser = await chromium.launch();
  const adminPage = await browser.newPage();
  // ... log in
  await adminPage.context().storageState({ path: 'adminStorageState.json' });

  const userPage = await browser.newPage();
  // ... log in
  await userPage.context().storageState({ path: 'userStorageState.json' });
  await browser.close();
};
```

```js tab=js-ts
// global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const adminPage = await browser.newPage();
  // ... log in
  await adminPage.context().storageState({ path: 'adminStorageState.json' });

  const userPage = await browser.newPage();
  // ... log in
  await userPage.context().storageState({ path: 'userStorageState.json' });
  await browser.close();
}

export default globalSetup;
```

After that you can specify the user to use for each test file or each test group:

```js tab=js-ts
import { test } from '@playwright/test';

test.use({ storageState: 'adminStorageState.json' });

test('admin test', async ({ page }) => {
  // page is signed in as admin.
});

test.describe(() => {
  test.use({ storageState: 'userStorageState.json' });

  test('user test', async ({ page }) => {
    // page is signed in as a user.
  });
});
```

```js tab=js-js
const { test } = require('@playwright/test');

test.use({ storageState: 'adminStorageState.json' });

test('admin test', async ({ page }) => {
  // page is signed in as amin.
});

test.describe(() => {
  test.use({ storageState: 'userStorageState.json' });

  test('user test', async ({ page }) => {
    // page is signed in as a user.
  });
});
```

### Testing multiple roles together

If you need to test how multiple authenticated roles interact together, use multiple [BrowserContext]s and [Page]s with different storage states in the same test. Any of the methods above to create multiple storage state files would work.

```js tab=js-ts
import { test } from '@playwright/test';

test('admin and user', async ({ browser }) => {
  // adminContext and all pages inside, including adminPage, are signed in as "admin".
  const adminContext = await browser.newContext({ storageState: 'adminStorageState.json' });
  const adminPage = await adminContext.newPage();

  // userContext and all pages inside, including userPage, are signed in as "user".
  const userContext = await browser.newContext({ storageState: 'userStorageState.json' });
  const userPage = await userContext.newPage();

  // ... interact with both adminPage and userPage ...
});
```

```js tab=js-js
const { test } = require('@playwright/test');

test('admin and user', async ({ browser }) => {
  // adminContext and all pages inside, including adminPage, are signed in as "admin".
  const adminContext = await browser.newContext({ storageState: 'adminStorageState.json' });
  const adminPage = await adminContext.newPage();

  // userContext and all pages inside, including userPage, are signed in as "user".
  const userContext = await browser.newContext({ storageState: 'userStorageState.json' });
  const userPage = await userContext.newPage();

  // ... interact with both adminPage and userPage ...
});
```

### Testing multiple roles with POM fixtures

If many of your tests require multiple authenticated roles from within the same test, you can introduce fixtures for each role. Any of the methods above to create multiple storage state files would work.

Below is an example that [creates fixtures](./test-fixtures.md#creating-a-fixture) for two [Page Object Models](./test-pom.md) - admin POM and user POM. It assumes `adminStorageState.json` and `userStorageState.json` files were created.

```js tab=js-ts
// fixtures.ts
import { test as base, Page, Browser, Locator } from '@playwright/test';
export { expect } from '@playwright/test';

// Page Object Model for the "admin" page.
// Here you can add locators and helper methods specific to the admin page.
class AdminPage {
  // Page signed in as "admin".
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  static async create(browser: Browser) {
    const context = await browser.newContext({ storageState: 'adminStorageState.json' });
    const page = await context.newPage();
    return new AdminPage(page);
  }
}

// Page Object Model for the "user" page.
// Here you can add locators and helper methods specific to the user page.
class UserPage {
  // Page signed in as "user".
  page: Page;

  // Example locator pointing to "Welcome, User" greeting.
  greeting: Locator;

  constructor(page: Page) {
    this.page = page;
    this.greeting = page.locator('#greeting');
  }

  static async create(browser: Browser) {
    const context = await browser.newContext({ storageState: 'userStorageState.json' });
    const page = await context.newPage();
    return new UserPage(page);
  }
}

// Declare the types of your fixtures.
type MyFixtures = {
  adminPage: AdminPage;
  userPage: UserPage;
};

// Extend base test by providing "adminPage" and "userPage".
// This new "test" can be used in multiple test files, and each of them will get the fixtures.
export const test = base.extend<MyFixtures>({
  adminPage: async ({ browser }, use) => {
    await use(await AdminPage.create(browser));
  },
  userPage: async ({ browser }, use) => {
    await use(await UserPage.create(browser));
  },
});


// example.spec.ts
// Import test with our new fixtures.
import { test, expect } from './fixtures';

// Use adminPage and userPage fixtures in the test.
test('admin and user', async ({ adminPage, userPage }) => {
  // ... interact with both adminPage and userPage ...
  await adminPage.page.screenshot();
  await expect(userPage.greeting).toHaveText('Welcome, User');
});
```

```js tab=js-js
// fixtures.js
const { test: base } = require('@playwright/test');

// Page Object Model for the "admin" page.
// Here you can add locators and helper methods specific to the admin page.
class AdminPage {
  constructor(page) {
    // Page signed in as "admin".
    this.page = page;
  }

  static async create(browser) {
    const context = await browser.newContext({ storageState: 'adminStorageState.json' });
    const page = await context.newPage();
    return new AdminPage(page);
  }
}

// Page Object Model for the "user" page.
// Here you can add locators and helper methods specific to the user page.
class UserPage {
  constructor(page) {
    // Page signed in as "user".
    this.page = page;
    // Example locator pointing to "Welcome, User" greeting.
    this.greeting = page.locator('#greeting');
  }

  static async create(browser) {
    const context = await browser.newContext({ storageState: 'userStorageState.json' });
    const page = await context.newPage();
    return new UserPage(page);
  }
}

// Extend base test by providing "adminPage" and "userPage".
// This new "test" can be used in multiple test files, and each of them will get the fixtures.
exports.test = base.extend({
  adminPage: async ({ browser }, use) => {
    await use(await AdminPage.create(browser));
  },
  userPage: async ({ browser }, use) => {
    await use(await UserPage.create(browser));
  },
});
exports.expect = base.expect;

// example.spec.ts
// Import test with our new fixtures.
const { test, expect } = require('./fixtures');

// Use adminPage and userPage fixtures in the test.
test('admin and user', async ({ adminPage, userPage }) => {
  // ... interact with both adminPage and userPage ...
  await adminPage.page.screenshot();
  await expect(userPage.greeting).toHaveText('Welcome, User');
});
```

## Reuse the signed in page in multiple tests

Although discouraged, sometimes it is necessary to sacrifice the isolation and run a number of tests
in the same page. In that case, you can log into that page once in `beforeAll` and then use that same
page in all the tests. Note that you need to run these tests serially using `test.describe.serial` in
order to achieve that:

```js tab=js-js
// example.spec.js
// @ts-check

const { test } = require('@playwright/test');

test.describe.configure({ mode: 'serial' });

/** @type {import('@playwright/test').Page} */
let page;

test.beforeAll(async ({ browser }) => {
  // Create page yourself and sign in.
  page = await browser.newPage();
  await page.goto('https://github.com/login');
  await page.getByLabel('User Name').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByText('Sign in').click();
});

test.afterAll(async () => {
  await page.close();
});

test('first test', async () => {
  // page is signed in.
});

test('second test', async () => {
  // page is signed in.
});
```

```js tab=js-ts
// example.spec.ts

import { test, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  // Create page once and sign in.
  page = await browser.newPage();
  await page.goto('https://github.com/login');
  await page.getByLabel('User Name').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByText('Sign in').click();
});

test.afterAll(async () => {
  await page.close();
});

test('first test', async () => {
  // page is signed in.
});

test('second test', async () => {
  // page is signed in.
});
```

:::note
You can also use `storageState` property when you are creating the [`method: Browser.newPage`] in order to
pass it an existing logged in state.
:::
