---
id: auth
title: "Authentication"
---

## Introduction

Playwright executes tests in isolated environments called [browser contexts](./browser-contexts.md). This isolation model improves reproducibility and prevents cascading test failures. Tests can load existing authenticated state. This eliminates the need to authenticate in every test and speeds up test execution.

## Core concepts

Regardless of the authentication strategy you choose, you are likely to store authenticated browser state on the file system.

We recommend to create `playwright/.auth` directory and add it to your `.gitignore`. Your authentication routine will produce authenticated browser state and save it to a file in this `playwright/.auth` directory. Later on, tests will reuse this state and start already authenticated.

```bash tab=bash-bash
mkdir -p playwright/.auth
echo $'\nplaywright/.auth' >> .gitignore
```

```batch tab=bash-batch
md playwright\.auth
echo. >> .gitignore
echo "playwright/.auth" >> .gitignore
```

```powershell tab=bash-powershell
New-Item -ItemType Directory -Force -Path playwright\.auth
Add-Content -path .gitignore "`r`nplaywright/.auth"
```

## Basic: shared account in all tests
* langs: js

This is the **recommended** approach for tests **without server-side state**. Authenticate once in the **setup project**, save the authentication state, and then reuse it to bootstrap each test already authenticated.

**When to use**
- When you can imagine all your tests running at the same time with the same account, without affecting each other.

**When not to use**
- Your tests modify server-side state. For example, one test checks the rendering of the settings page, while the other test is changing the setting, and you run tests in parallel. In this case, tests must use different accounts.
- Your authentication is browser-specific.

**Details**

Create `tests/auth.setup.ts` that will prepare authenticated browser state for all other tests.

```js title="tests/auth.setup.ts"
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../playwright/.auth/user.json');

setup('authenticate', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('https://github.com/login');
  await page.getByLabel('Username or email address').fill('username');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait until the page receives the cookies.
  //
  // Sometimes login flow sets cookies in the process of several redirects.
  // Wait for the final URL to ensure that the cookies are actually set.
  await page.waitForURL('https://github.com/');
  // Alternatively, you can wait until the page reaches a state where all cookies are set.
  await expect(page.getByRole('button', { name: 'View profile and more' })).toBeVisible();

  // End of authentication steps.

  await page.context().storageState({ path: authFile });
});
```

Create a new `setup` project in the config and declare it as a [dependency](./test-projects.md#dependencies) for all your testing projects. This project will always run and authenticate before all the tests. All testing projects should use the authenticated state as `storageState`.

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    // Setup project
    { name: 'setup', testMatch: /.*\.setup\.ts/ },

    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Use prepared auth state.
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },

    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Use prepared auth state.
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
});
```

Tests start already authenticated because we specified `storageState` in the config.

```js title="tests/example.spec.ts"
import { test } from '@playwright/test';

test('test', async ({ page }) => {
  // page is authenticated
});
```

Note that you need to delete the stored state when it expires. If you don't need to keep the state between test runs, write the browser state under [`property: TestProject.outputDir`], which is automatically cleaned up before every test run.

### Authenticating in UI mode
* langs: js

UI mode will not run the `setup` project by default to improve testing speed. We recommend to authenticate by manually running the `auth.setup.ts` from time to time, whenever existing authentication expires.

First [enable the `setup` project in the filters](./test-ui-mode#filtering-tests), then click the triangle button next to `auth.setup.ts` file, and then disable the `setup` project in the filters again.


## Moderate: one account per parallel worker
* langs: js

This is the **recommended** approach for tests that **modify server-side state**. In Playwright, worker processes run in parallel. In this approach, each parallel worker is authenticated once. All tests ran by worker are reusing the same authentication state. We will need multiple testing accounts, one per each parallel worker.

**When to use**
- Your tests modify shared server-side state. For example, one test checks the rendering of the settings page, while the other test is changing the setting.

**When not to use**
- Your tests do not modify any shared server-side state. In this case, all tests can use a single shared account.

**Details**

We will authenticate once per [worker process](./test-parallel.md#worker-processes), each with a unique account.

Create `playwright/fixtures.ts` file that will [override `storageState` fixture](./test-fixtures.md#overriding-fixtures) to authenticate once per worker. Use [`property: TestInfo.parallelIndex`] to differentiate between workers.

```js title="playwright/fixtures.ts"
import { test as baseTest, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export * from '@playwright/test';
export const test = baseTest.extend<{}, { workerStorageState: string }>({
  // Use the same storage state for all tests in this worker.
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  // Authenticate once per worker with a worker-scoped fixture.
  workerStorageState: [async ({ browser }, use) => {
    // Use parallelIndex as a unique identifier for each worker.
    const id = test.info().parallelIndex;
    const fileName = path.resolve(test.info().project.outputDir, `.auth/${id}.json`);

    if (fs.existsSync(fileName)) {
      // Reuse existing authentication state if any.
      await use(fileName);
      return;
    }

    // Important: make sure we authenticate in a clean environment by unsetting storage state.
    const page = await browser.newPage({ storageState: undefined });

    // Acquire a unique account, for example create a new one.
    // Alternatively, you can have a list of precreated accounts for testing.
    // Make sure that accounts are unique, so that multiple team members
    // can run tests at the same time without interference.
    const account = await acquireAccount(id);

    // Perform authentication steps. Replace these actions with your own.
    await page.goto('https://github.com/login');
    await page.getByLabel('Username or email address').fill(account.username);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    // Wait until the page receives the cookies.
    //
    // Sometimes login flow sets cookies in the process of several redirects.
    // Wait for the final URL to ensure that the cookies are actually set.
    await page.waitForURL('https://github.com/');
    // Alternatively, you can wait until the page reaches a state where all cookies are set.
    await expect(page.getByRole('button', { name: 'View profile and more' })).toBeVisible();

    // End of authentication steps.

    await page.context().storageState({ path: fileName });
    await page.close();
    await use(fileName);
  }, { scope: 'worker' }],
});
```

Now, each test file should import `test` from our fixtures file instead of `@playwright/test`. No changes are needed in the config.

```js title="tests/example.spec.ts"
// Important: import our fixtures.
import { test, expect } from '../playwright/fixtures';

test('test', async ({ page }) => {
  // page is authenticated
});
```


## Signing in before each test
* langs: java, python, csharp

The Playwright API can [automate interaction](./input.md) with a login form.

The following example logs into GitHub. Once these steps are executed,
the browser context will be authenticated.

```java
Page page = context.newPage();
page.navigate("https://github.com/login");
// Interact with login form
page.getByLabel("Username or email address").fill("username");
page.getByLabel("Password").fill("password");
page.getByRole(AriaRole.BUTTON, new Page.GetByRoleOptions().setName("Sign in"))
    .click();
// Continue with the test
```

```python async
page = await context.new_page()
await page.goto('https://github.com/login')

# Interact with login form
await page.get_by_label("Username or email address").fill("username")
await page.get_by_label("Password").fill("password")
await page.page.get_by_role("button", name="Sign in").click()
# Continue with the test
```

```python sync
page = context.new_page()
page.goto('https://github.com/login')

# Interact with login form
page.get_by_label("Username or email address").fill("username")
page.get_by_label("Password").fill("password")
page.get_by_role("button", name="Sign in").click()
# Continue with the test
```

```csharp
var page = await context.NewPageAsync();
await page.GotoAsync("https://github.com/login");
// Interact with login form
await page.GetByLabel("Username or email address").FillAsync("username");
await page.GetByLabel("Password").FillAsync("password");
await page.GetByRole(AriaRole.Button, new() { Name = "Sign in" }).ClickAsync();
// Continue with the test
```

Redoing login for every test can slow down test execution. To mitigate that, reuse
existing authentication state instead.

## Reusing signed in state
* langs: java, csharp, python

Playwright provides a way to reuse the signed-in state in the tests. That way you can log
in only once and then skip the log in step for all of the tests.

Web apps use cookie-based or token-based authentication, where authenticated state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) or in [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage). Playwright provides [`method: BrowserContext.storageState`] method that can be used to retrieve storage state from authenticated contexts and then create new contexts with prepopulated state.

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
// Tests are executed in <TestProject>\bin\Debug\netX.0\ therefore relative path is used to reference playwright/.auth created in project root
await context.StorageStateAsync(new()
{
    Path = "../../../playwright/.auth/state.json"
});

// Create a new context with the saved storage state.
var context = await browser.NewContextAsync(new()
{
    StorageStatePath = "../../../playwright/.auth/state.json"
});
```


## Advanced scenarios

### Authenticate with API request
* langs: js

**When to use**
- Your web application supports authenticating via API that is easier/faster than interacting with the app UI.

**Details**

We will send the API request with [APIRequestContext] and then save authenticated state as usual.

In the [setup project](#basic-shared-account-in-all-tests):

```js title="tests/auth.setup.ts"
import { test as setup } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ request }) => {
  // Send authentication request. Replace with your own.
  await request.post('https://github.com/login', {
    form: {
      'user': 'user',
      'password': 'password'
    }
  });
  await request.storageState({ path: authFile });
});
```

Alternatively, in a [worker fixture](#moderate-one-account-per-parallel-worker):

```js title="playwright/fixtures.ts"
import { test as baseTest, request } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export * from '@playwright/test';
export const test = baseTest.extend<{}, { workerStorageState: string }>({
  // Use the same storage state for all tests in this worker.
  storageState: ({ workerStorageState }, use) => use(workerStorageState),

  // Authenticate once per worker with a worker-scoped fixture.
  workerStorageState: [async ({}, use) => {
    // Use parallelIndex as a unique identifier for each worker.
    const id = test.info().parallelIndex;
    const fileName = path.resolve(test.info().project.outputDir, `.auth/${id}.json`);

    if (fs.existsSync(fileName)) {
      // Reuse existing authentication state if any.
      await use(fileName);
      return;
    }

    // Important: make sure we authenticate in a clean environment by unsetting storage state.
    const context = await request.newContext({ storageState: undefined });

    // Acquire a unique account, for example create a new one.
    // Alternatively, you can have a list of precreated accounts for testing.
    // Make sure that accounts are unique, so that multiple team members
    // can run tests at the same time without interference.
    const account = await acquireAccount(id);

    // Send authentication request. Replace with your own.
    await context.post('https://github.com/login', {
      form: {
        'user': 'user',
        'password': 'password'
      }
    });

    await context.storageState({ path: fileName });
    await context.dispose();
    await use(fileName);
  }, { scope: 'worker' }],
});
```

### Multiple signed in roles
* langs: js

**When to use**
- You have more than one role in your end to end tests, but you can reuse accounts across all tests.

**Details**

We will authenticate multiple times in the setup project.

```js title="tests/auth.setup.ts"
import { test as setup, expect } from '@playwright/test';

const adminFile = 'playwright/.auth/admin.json';

setup('authenticate as admin', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('https://github.com/login');
  await page.getByLabel('Username or email address').fill('admin');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait until the page receives the cookies.
  //
  // Sometimes login flow sets cookies in the process of several redirects.
  // Wait for the final URL to ensure that the cookies are actually set.
  await page.waitForURL('https://github.com/');
  // Alternatively, you can wait until the page reaches a state where all cookies are set.
  await expect(page.getByRole('button', { name: 'View profile and more' })).toBeVisible();

  // End of authentication steps.

  await page.context().storageState({ path: adminFile });
});

const userFile = 'playwright/.auth/user.json';

setup('authenticate as user', async ({ page }) => {
  // Perform authentication steps. Replace these actions with your own.
  await page.goto('https://github.com/login');
  await page.getByLabel('Username or email address').fill('user');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  // Wait until the page receives the cookies.
  //
  // Sometimes login flow sets cookies in the process of several redirects.
  // Wait for the final URL to ensure that the cookies are actually set.
  await page.waitForURL('https://github.com/');
  // Alternatively, you can wait until the page reaches a state where all cookies are set.
  await expect(page.getByRole('button', { name: 'View profile and more' })).toBeVisible();

  // End of authentication steps.

  await page.context().storageState({ path: userFile });
});
```

After that, specify `storageState` for each test file or test group, **instead of** setting it in the config.

```js title="tests/example.spec.ts"
import { test } from '@playwright/test';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('admin test', async ({ page }) => {
  // page is authenticated as admin
});

test.describe(() => {
  test.use({ storageState: 'playwright/.auth/user.json' });

  test('user test', async ({ page }) => {
    // page is authenticated as a user
  });
});
```

See also about [authenticating in the UI mode](#authenticating-in-ui-mode).

### Testing multiple roles together
* langs: js

**When to use**
- You need to test how multiple authenticated roles interact together, in a single test.

**Details**

Use multiple [BrowserContext]s and [Page]s with different storage states in the same test.

```js title="tests/example.spec.ts"
import { test } from '@playwright/test';

test('admin and user', async ({ browser }) => {
  // adminContext and all pages inside, including adminPage, are signed in as "admin".
  const adminContext = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
  const adminPage = await adminContext.newPage();

  // userContext and all pages inside, including userPage, are signed in as "user".
  const userContext = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
  const userPage = await userContext.newPage();

  // ... interact with both adminPage and userPage ...

  await adminContext.close();
  await userContext.close();
});
```

### Testing multiple roles with POM fixtures
* langs: js

**When to use**
- You need to test how multiple authenticated roles interact together, in a single test.

**Details**

You can introduce fixtures that will provide a page authenticated as each role.

Below is an example that [creates fixtures](./test-fixtures.md#creating-a-fixture) for two [Page Object Models](./pom.md) - admin POM and user POM. It assumes `adminStorageState.json` and `userStorageState.json` files were created in the global setup.

```js title="playwright/fixtures.ts"
import { test as base, type Page, type Locator } from '@playwright/test';

// Page Object Model for the "admin" page.
// Here you can add locators and helper methods specific to the admin page.
class AdminPage {
  // Page signed in as "admin".
  page: Page;

  // Example locator pointing to "Welcome, Admin" greeting.
  greeting: Locator;

  constructor(page: Page) {
    this.page = page;
    this.greeting = page.locator('#greeting');
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
}

// Declare the types of your fixtures.
type MyFixtures = {
  adminPage: AdminPage;
  userPage: UserPage;
};

export * from '@playwright/test';
export const test = base.extend<MyFixtures>({
  adminPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'playwright/.auth/admin.json' });
    const adminPage = new AdminPage(await context.newPage());
    await use(adminPage);
    await context.close();
  },
  userPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: 'playwright/.auth/user.json' });
    const userPage = new UserPage(await context.newPage());
    await use(userPage);
    await context.close();
  },
});

```

```js title="tests/example.spec.ts"
// Import test with our new fixtures.
import { test, expect } from '../playwright/fixtures';

// Use adminPage and userPage fixtures in the test.
test('admin and user', async ({ adminPage, userPage }) => {
  // ... interact with both adminPage and userPage ...
  await expect(adminPage.greeting).toHaveText('Welcome, Admin');
  await expect(userPage.greeting).toHaveText('Welcome, User');
});
```


### Session storage

Reusing authenticated state covers [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage) based authentication. Rarely, [session storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) is used for storing information associated with the signed-in state. Session storage is specific to a particular domain and is not persisted across page loads. Playwright does not provide API to persist session storage, but the following snippet can be used to save/load session storage.

```js
// Get session storage and store as env variable
const sessionStorage = await page.evaluate(() => JSON.stringify(sessionStorage));
fs.writeFileSync('playwright/.auth/session.json', sessionStorage, 'utf-8');

// Set session storage in a new context
const sessionStorage = JSON.parse(fs.readFileSync('playwright/.auth/session.json', 'utf-8'));
await context.addInitScript(storage => {
  if (window.location.hostname === 'example.com') {
    for (const [key, value] of Object.entries(storage))
      window.sessionStorage.setItem(key, value);
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
      window.sessionStorage.setItem(key, value)
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
      window.sessionStorage.setItem(key, value)
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

### Avoid authentication in some tests
* langs: js

You can reset storage state in a test file to avoid authentication that was set up for the whole project.

```js title="not-signed-in.spec.ts"
import { test } from '@playwright/test';

// Reset storage state for this file to avoid being authenticated
test.use({ storageState: { cookies: [], origins: [] } });

test('not signed in test', async ({ page }) => {
  // ...
});
```
