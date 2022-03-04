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

```js js-flavor=ts
import { test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Runs before each test and signs in each page.
  await page.goto('https://github.com/login');
  await page.click('text=Login');
  await page.fill('input[name="login"]', 'username');
  await page.fill('input[name="password"]', 'password');
  await page.click('text=Submit');
});

test('first', async ({ page }) => {
  // page is signed in.
});

test('second', async ({ page }) => {
  // page is signed in.
});
```

```js js-flavor=js
const { test } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  // Runs before each test and signs in each page.
  await page.goto('https://github.com/login');
  await page.click('text=Login');
  await page.fill('input[name="login"]', 'username');
  await page.fill('input[name="password"]', 'password');
  await page.click('text=Submit');
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

```js js-flavor=js
// global-setup.js
const { chromium } = require('@playwright/test');

module.exports = async config => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://github.com/login');
  await page.fill('input[name="user"]', 'user');
  await page.fill('input[name="password"]', 'password');
  await page.click('text=Sign in');
  // Save signed-in state to 'storageState.json'.
  await page.context().storageState({ path: 'storageState.json' });
  await browser.close();
};
```

```js js-flavor=ts
// global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('https://github.com/login');
  await page.fill('input[name="user"]', 'user');
  await page.fill('input[name="password"]', 'password');
  await page.click('text=Sign in');
  // Save signed-in state to 'storageState.json'.
  await page.context().storageState({ path: 'storageState.json' });
  await browser.close();
}

export default globalSetup;
```

Register global setup script in the Playwright configuration file:

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  globalSetup: require.resolve('./global-setup'),
  use: {
    // Tell all tests to load signed-in state from 'storageState.json'.
    storageState: 'storageState.json'
  }
};
export default config;
```

```js js-flavor=js
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

```js js-flavor=ts
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  // page is signed in.
});
```

```js js-flavor=js
const { test } = require('@playwright/test');

test('test', async ({ page }) => {
  // page is signed in.
});
```

:::note
If you can log in once and commit the `storageState.json` into the repository, you won't need the global
setup at all, just specify the `storageState.json` in Playwright Config as above and it'll be picked up.
:::

### Sign in via API request

If your web application supports signing in via API, you can use [APIRequestContext] to simplify sign in flow. Global setup script from the example above would change like this:

```js js-flavor=js
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

```js js-flavor=ts
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

## Multiple signed in roles

Sometimes you have more than one signed-in user in your end to end tests. You can achieve that via logging in for these users multiple times in globalSetup and saving that state into different files.

```js js-flavor=js
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

```js js-flavor=ts
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

```js js-flavor=ts
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

```js js-flavor=js
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

## Reuse the signed in page in multiple tests

Although discouraged, sometimes it is necessary to sacrifice the isolation and run a number of tests
in the same page. In that case, you can log into that page once in `beforeAll` and then use that same
page in all the tests. Note that you need to run these tests serially using `test.describe.serial` in
order to achieve that:

```js js-flavor=js
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
  await page.fill('input[name="user"]', 'user');
  await page.fill('input[name="password"]', 'password');
  await page.click('text=Sign in');
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

```js js-flavor=ts
// example.spec.ts

import { test, Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

let page: Page;

test.beforeAll(async ({ browser }) => {
  // Create page once and sign in.
  page = await browser.newPage();
  await page.goto('https://github.com/login');
  await page.fill('input[name="user"]', 'user');
  await page.fill('input[name="password"]', 'password');
  await page.click('text=Sign in');
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
