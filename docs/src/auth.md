---
id: auth
title: "Authentication"
---

Playwright can be used to automate scenarios that require authentication.

Tests written with Playwright execute in isolated clean-slate environments called
[browser contexts](./browser-contexts.md). This isolation model
improves reproducibility and prevents cascading test failures. New browser
contexts can load existing authentication state. This eliminates the need to
login in every context and speeds up test execution.

> Note: This guide covers cookie/token-based authentication (logging in via the
app UI). For [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication) use [`method: Browser.newContext`].

## Automate logging in

The Playwright API can automate interaction with a login form. See
[Input guide](./input.md) for more details.

The following example automates login on GitHub. Once these steps are executed,
the browser context will be authenticated.

```js
const page = await context.newPage();
await page.goto('https://github.com/login');

// Interact with login form
await page.click('text=Login');
await page.fill('input[name="login"]', USERNAME);
await page.fill('input[name="password"]', PASSWORD);
await page.click('text=Submit');
// Verify app is logged in
```

```java
Page page = context.newPage();
page.navigate("https://github.com/login");
// Interact with login form
page.click("text=Login");
page.fill("input[name='login']", USERNAME);
page.fill("input[name='password']", PASSWORD);
page.click("text=Submit");
// Verify app is logged in
```

```python async
page = await context.new_page()
await page.goto('https://github.com/login')

# Interact with login form
await page.click('text=Login')
await page.fill('input[name="login"]', USERNAME)
await page.fill('input[name="password"]', PASSWORD)
await page.click('text=Submit')
# Verify app is logged in
```

```python sync
page = context.new_page()
page.goto('https://github.com/login')

# Interact with login form
page.click('text=Login')
page.fill('input[name="login"]', USERNAME)
page.fill('input[name="password"]', PASSWORD)
page.click('text=Submit')
# Verify app is logged in
```

```csharp
var page = await context.NewPageAsync();
await page.NavigateAsync("https://github.com/login");
// Interact with login form
await page.ClickAsync("text=Login");
await page.FillAsync("input[name='login']", USERNAME);
await page.FillAsync("input[name='password']", PASSWORD);
await page.ClickAsync("text=Submit");
// Verify app is logged in
```

These steps can be executed for every browser context. However, redoing login
for every test can slow down test execution. To prevent that, we will reuse
existing authentication state in new browser contexts.

## Reuse authentication state

Web apps use cookie-based or token-based authentication, where authenticated
state is stored as [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
or in [local storage](https://developer.mozilla.org/en-US/docs/Web/API/Storage).
Playwright provides [`method: BrowserContext.storageState`] method that can be used to retrieve storage state from authenticated contexts and then create new contexts with prepopulated state.

Cookies and local storage state can be used across different browsers. They depend
on your application's authentication model: some apps might require both cookies
and local storage.

The following code snippet retrieves state from an authenticated context and
creates a new context with that state.

```js
// Save storage state into the file.
await context.storageState({ path: 'state.json' });

// Create a new context with the saved storage state.
const context = await browser.newContext({ storageState: 'state.json' });
```

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
await context.StorageStateAsync(new BrowserContextStorageStateOptions
{
    Path = "state.json"
});

// Create a new context with the saved storage state.
var context = await browser.NewContextAsync(new BrowserNewContextOptions
{
    StorageStatePath = "state.json"
});
```

### Code generation

Logging in via the UI and then reusing authentication state can be combined to
implement **login once and run multiple scenarios**. The lifecycle looks like:

1. Run tests (for example, with `npm run test`).
1. Login via UI and retrieve authentication state.
    * In Jest, this can be executed in [`globalSetup`](https://jestjs.io/docs/en/configuration#globalsetup-string).
1. In each test, load authentication state in `beforeEach` or `beforeAll` step.

This approach will also **work in CI environments**, since it does not rely on any external state.

### API reference
- [`method: BrowserContext.storageState`]
- [`method: Browser.newContext`]

## Session storage

Rarely, [session storage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage) is used for storing information
associated with the logged-in state. Session storage is specific to a particular domain and is not persisted across page loads.
Playwright does not provide API to persist session storage, but the following snippet can be used to
save/load session storage.

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

### API reference
- [`method: BrowserContext.storageState`]
- [`method: Browser.newContext`]
- [`method: Page.evaluate`]
- [`method: BrowserContext.addInitScript`]

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
        var context = chromium.LaunchPersistentContextAsync(@"C:\path\to\directory\", new BrowserTypeLaunchPersistentContextOptions
        {
            Headless = false
        });
    }
}
```

### Lifecycle

1. Create a user data directory on disk.
1. Launch a persistent context with the user data directory and login the MFA account.
1. Reuse user data directory to run automation scenarios.

### API reference
- [BrowserContext]
- [`method: BrowserType.launchPersistentContext`]
