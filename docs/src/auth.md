---
id: auth
title: "Authentication"
---

Playwright can be used to automate scenarios that require authentication.

Tests written with Playwright execute in isolated clean-slate environments called [browser contexts](./browser-contexts.md). This isolation model improves reproducibility and prevents cascading test failures. New browser contexts can load existing authentication state. This eliminates the need to login in every context and speeds up test execution.

> Note: This guide covers cookie/token-based authentication (logging in via the app UI). For [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication) use [`method: Browser.newContext`].

## Automate logging in

The Playwright API can [automate interaction](./input.md) from a login form.

The following example automates logging into GitHub. Once these steps are executed,
the browser context will be authenticated.

```js tab=js-ts
import { test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Runs before each test and signs in each page.
  await page.goto('https://github.com/login');
  await page.getByText('Login').click();
  await page.getByLabel('User Name').fill('username');
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
  await page.getByLabel('User name').fill('username');
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

```js tab=js-library
const page = await context.newPage();
await page.goto('https://github.com/login');

// Interact with login form
await page.getByText('Login').click();
await page.getByLabel('User Name').fill(USERNAME);
await page.getByLabel('Password').fill(PASSWORD);
await page.getByText('Submit').click();
// Continue with the test
```

```java
Page page = context.newPage();
page.navigate("https://github.com/login");
// Interact with login form
page.getByText("Login").click();
page.getByLabel("User Name").fill(USERNAME);
page.getByLabel("Password").fill(PASSWORD);
page.locator("text=Submit").click();
// Continue with the test
```

```python async
page = await context.new_page()
await page.goto('https://github.com/login')

# Interact with login form
await page.get_by_text("Login").click()
await page.get_by_label("User Name").fill(USERNAME)
await page.get_by_label("Password").fill(PASSWORD)
await page.get_by_text('Submit').click()
# Continue with the test
```

```python sync
page = context.new_page()
page.goto('https://github.com/login')

# Interact with login form
page.get_by_text("Login").click()
page.get_by_label("User Name").fill(USERNAME)
page.get_by_label("Password").fill(PASSWORD)
page.get_by_text('Submit').click()
# Continue with the test
```

```csharp
var page = await context.NewPageAsync();
await page.GotoAsync("https://github.com/login");
// Interact with login form
await page.GetByText("Login").ClickAsync();
await page.GetByLabel("User Name").FillAsync(USERNAME);
await page.GetByLabel("Password").FillAsync(PASSWORD);
await page.GetByText("Submit").ClickAsync();
// Continue with the test
```

Redoing login for every test can slow down test execution. To mitigate that, reuse
existing authentication state instead.

## Reuse signed in state
* langs: java, csharp, python

Playwright provides a way to reuse the signed-in state in the tests. That way you can log
in only once and then skip the log in step for all of the tests.

Web apps use cookie-based or token-based authentication, where authenticated state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or in [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage). Playwright provides [browserContext.storageState([options])](https://playwright.dev/docs/api/class-browsercontext#browser-context-storage-state) method that can be used to retrieve storage state from authenticated contexts and then create new contexts with prepopulated state.

Cookies and local storage state can be used across different browsers. They depend on your application's authentication model: some apps might require both cookies and local storage.

The following code snippet retrieves state from an authenticated context and creates a new context with that state.

```java
// Save storage state into the file.
context.storageState(new BrowserContext.StorageStateOptions().setPath(Paths.get("state.json")));

// Create a new context with the saved storage state.
BrowserContext context = browser.newContext(
  new Browser.NewContextOptions().setStorageStatePath(Paths.get("state.json")));
```

```python async
# Save storage state into the file.
storage = await context.storage_state(path="state.json")

# Create a new context with the saved storage state.
context = await browser.new_context(storage_state="state.json")
```

```python sync
# Save storage state into the file.
storage = context.storage_state(path="state.json")

# Create a new context with the saved storage state.
context = browser.new_context(storage_state="state.json")
```

```csharp
// Save storage state into the file.
await context.StorageStateAsync(new()
{
    Path = "state.json"
});

// Create a new context with the saved storage state.
var context = await browser.NewContextAsync(new()
{
    StorageStatePath = "state.json"
});
```
## Reuse signed in state
* langs: js

Playwright provides a way to reuse the signed-in state in the tests. That way you can log
in only once and then skip the log in step for all of the tests.

Web apps use cookie-based or token-based authentication, where authenticated state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or in [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage). Playwright provides [browserContext.storageState([options])](https://playwright.dev/docs/api/class-browsercontext#browser-context-storage-state) method that can be used to retrieve storage state from authenticated contexts and then create new contexts with prepopulated state.

Cookies and local storage state can be used across different browsers. They depend on your application's authentication model: some apps might require both cookies and local storage.

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
If you can log in once and commit the `storageState.json` into the repository, you won't need the global setup at all, just specify the `storageState.json` in Playwright Config as above and it'll be picked up.

However, periodically, you may need to update the `storageState.json` file if your app requires you to re-authenticate after some amount of time. For example, if your app prompts you to sign in every week even if you're on the same computer/browser, you'll need to update `storageState.json` at least this often.
:::

### Sign in via API request
* langs: js

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
* langs: js

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
* langs: js

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
* langs: js

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
* langs: js

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
* langs: js

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


## Session storage

Rarely, [session storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) is used for storing information associated with the logged-in state. Session storage is specific to a particular domain and is not persisted across page loads. Playwright does not provide API to persist session storage, but the following snippet can be used to save/load session storage.

```js
// Get session storage and store as env variable
const sessionStorage = await page.evaluate(() => JSON.stringify(sessionStorage));
process.env.SESSION_STORAGE = sessionStorage;

// Set session storage in a new context
const sessionStorage = process.env.SESSION_STORAGE;
await context.addInitScript(storage => {
  if (window.location.hostname === 'example.com') {
    const entries = JSON.parse(storage);
    for (const [key, value] of Object.entries(entries)) {
      window.sessionStorage.setItem(key, value);
    }
  }
}, sessionStorage);
```

```java
// Get session storage and store as env variable
String sessionStorage = (String) page.evaluate("JSON.stringify(sessionStorage)");
System.getenv().put("SESSION_STORAGE", sessionStorage);

// Set session storage in a new context
String sessionStorage = System.getenv("SESSION_STORAGE");
context.addInitScript("(storage => {\n" +
  "  if (window.location.hostname === 'example.com') {\n" +
  "    const entries = JSON.parse(storage);\n" +
  "     for (const [key, value] of Object.entries(entries)) {\n" +
  "      window.sessionStorage.setItem(key, value);\n" +
  "    };\n" +
  "  }\n" +
  "})('" + sessionStorage + "')");
```

```python async
import os
# Get session storage and store as env variable
session_storage = await page.evaluate("() => JSON.stringify(sessionStorage)")
os.environ["SESSION_STORAGE"] = session_storage

# Set session storage in a new context
session_storage = os.environ["SESSION_STORAGE"]
await context.add_init_script("""(storage => {
  if (window.location.hostname === 'example.com') {
    const entries = JSON.parse(storage)
    for (const [key, value] of Object.entries(entries)) {
      window.sessionStorage.setItem(key, key)
    }
  }
})('""" + session_storage + "')")
```

```python sync
import os
# Get session storage and store as env variable
session_storage = page.evaluate("() => JSON.stringify(sessionStorage)")
os.environ["SESSION_STORAGE"] = session_storage

# Set session storage in a new context
session_storage = os.environ["SESSION_STORAGE"]
context.add_init_script("""(storage => {
  if (window.location.hostname === 'example.com') {
    const entries = JSON.parse(storage)
    for (const [key, value] of Object.entries(entries)) {
      window.sessionStorage.setItem(key, key)
    }
  }
})('""" + session_storage + "')")
```

```csharp
// Get session storage and store as env variable
var sessionStorage = await page.EvaluateAsync<string>("() => JSON.stringify(sessionStorage)");
Environment.SetEnvironmentVariable("SESSION_STORAGE", sessionStorage);

// Set session storage in a new context
var loadedSessionStorage = Environment.GetEnvironmentVariable("SESSION_STORAGE");
await context.AddInitScriptAsync(@"(storage => {
    if (window.location.hostname === 'example.com') {
      const entries = JSON.parse(storage);
      for (const [key, value] of Object.entries(entries)) {
        window.sessionStorage.setItem(key, value);
      }
    }
  })('" + loadedSessionStorage + "')");
```

## Multi-factor authentication

Accounts with multi-factor authentication (MFA) cannot be fully automated, and need
manual intervention. Persistent authentication can be used to partially automate
MFA scenarios.

### Persistent authentication

Note that persistent authentication is not suited for CI environments since it
relies on a disk location. User data directories are specific to browser types
and cannot be shared across browser types.

User data directories can be used with the [`method: BrowserType.launchPersistentContext`] API.

```js
const { chromium } = require('playwright');

const userDataDir = '/path/to/directory';
const context = await chromium.launchPersistentContext(userDataDir, { headless: false });
// Execute login steps manually in the browser window
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      Path userDataDir = Paths.get("/path/to/directory");
      BrowserContext context = chromium.launchPersistentContext(userDataDir,
        new BrowserType.LaunchPersistentContextOptions().setHeadless(false));
      // Execute login steps manually in the browser window
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        user_data_dir = '/path/to/directory'
        browser = await p.chromium.launch_persistent_context(user_data_dir, headless=False)
        # Execute login steps manually in the browser window

asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    user_data_dir = '/path/to/directory'
    browser = p.chromium.launch_persistent_context(user_data_dir, headless=False)
    # Execute login steps manually in the browser window
```

```csharp
using Microsoft.Playwright;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        var chromium = playwright.Chromium;
        var context = chromium.LaunchPersistentContextAsync(@"C:\path\to\directory\", new()
        {
            Headless = false
        });
    }
}
```

#### Lifecycle

1. Create a user data directory on disk.
1. Launch a persistent context with the user data directory and login the MFA account.
1. Reuse user data directory to run automation scenarios.

## Manually Reuse Signed in State
* langs: js

The following code snippet retrieves state from an authenticated context and creates a new context with that state.

```js
// Save storage state into the file.
await context.storageState({ path: 'state.json' });

// Create a new context with the saved storage state.
const context = await browser.newContext({ storageState: 'state.json' });
```
