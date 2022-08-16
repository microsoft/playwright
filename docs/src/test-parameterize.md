---
id: test-parameterize
title: "Parametrize Tests"
---
## Parametrize Tests
* langs: js

You can either parametrize tests on a test level or on a project level.


```js tab=js-js
// example.spec.js
const people = ['Alice', 'Bob'];
for (const name of people) {
  test(`testing with ${name}`, async () => {
    // ...
  });
  // You can also do it with test.describe() or with multiple tests as long the test name is unique.
}
```

```js tab=js-ts
// example.spec.ts
const people = ['Alice', 'Bob'];
for (const name of people) {
  test(`testing with ${name}`, async () => {
    // ...
  });
  // You can also do it with test.describe() or with multiple tests as long the test name is unique.
}
```

## Parameterized Projects
* langs: js

Playwright Test supports running multiple test projects at the same time. In the following example, we'll run two projects with different options.

We declare the option `person` and set the value in the config. The first project runs with the value `Alice` and the second with the value `Bob`.

```js tab=js-js
// my-test.js
const base = require('@playwright/test');

exports.test = base.test.extend({
  // Define an option and provide a default value.
  // We can later override it in the config.
  person: ['John', { option: true }],
});
```

```js tab=js-ts
// my-test.ts
import { test as base } from '@playwright/test';

export type TestOptions = {
  person: string;
};

export const test = base.extend<TestOptions>({
  // Define an option and provide a default value.
  // We can later override it in the config.
  person: ['John', { option: true }],
});
```

We can use this option in the test, similarly to [fixtures](./test-fixtures.md).

```js tab=js-js
// example.spec.js
const { test } = require('./my-test');

test('test 1', async ({ page, person }) => {
  await page.goto(`/index.html`);
  await expect(page.locator('#node')).toContainText(person);
  // ...
});
```

```js tab=js-ts
// example.spec.ts
import { test } from './my-test';

test('test 1', async ({ page, person }) => {
  await page.goto(`/index.html`);
  await expect(page.locator('#node')).toContainText(person);
  // ...
});
```

Now, we can run tests in multiple configurations by using projects.

```js tab=js-js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig<{ person: string }>} */
const config = {
  projects: [
    {
      name: 'alice',
      use: { person: 'Alice' },
    },
    {
      name: 'bob',
      use: { person: 'Bob' },
    },
  ]
};

module.exports = config;
```

```js tab=js-ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';
import { TestOptions } from './my-test';

const config: PlaywrightTestConfig<TestOptions> = {
  projects: [
    {
      name: 'alice',
      use: { person: 'Alice' },
    },
    {
      name: 'bob',
      use: { person: 'Bob' },
    },
  ]
};
export default config;
```

We can also use the option in a fixture. Learn more about [fixtures](./test-fixtures.md).

```js tab=js-js
// my-test.js
const base = require('@playwright/test');

exports.test = base.test.extend({
  // Define an option and provide a default value.
  // We can later override it in the config.
  person: ['John', { option: true }],

  // Override default "page" fixture.
  page: async ({ page, person }, use) => {
    await page.goto('/chat');
    // We use "person" parameter as a "name" for the chat room.
    await page.locator('#name').fill(person);
    await page.locator('text=Enter chat room').click();
    // Each test will get a "page" that already has the person name.
    await use(page);
  },
});
```

```js tab=js-ts
// my-test.ts
import { test as base } from '@playwright/test';

export type TestOptions = {
  person: string;
};

export const test = base.test.extend<TestOptions>({
  // Define an option and provide a default value.
  // We can later override it in the config.
  person: ['John', { option: true }],

  // Override default "page" fixture.
  page: async ({ page, person }, use) => {
    await page.goto('/chat');
    // We use "person" parameter as a "name" for the chat room.
    await page.locator('#name').fill(person);
    await page.locator('text=Enter chat room').click();
    // Each test will get a "page" that already has the person name.
    await use(page);
  },
});
```

:::note
Parametrized projects behavior has changed in version 1.18. [Learn more](./release-notes#breaking-change-custom-config-options).
:::

## Passing Environment Variables
* langs: js

You can use environment variables to configure tests from the command line.

For example, consider the following test file that needs a username and a password. It is usually a good idea not to store your secrets in the source code, so we'll need a way to pass secrets from outside.

```js tab=js-js
// example.spec.js
test(`example test`, async ({ page }) => {
  // ...
  await page.locator('#username').fill(process.env.USERNAME);
  await page.locator('#password').fill(process.env.PASSWORD);
});
```

```js tab=js-ts
// example.spec.ts
test(`example test`, async ({ page }) => {
  // ...
  await page.locator('#username').fill(process.env.USERNAME);
  await page.locator('#password').fill(process.env.PASSWORD);
});
```

You can run this test with your secret username and password set in the command line.

```bash tab=bash-bash
USERNAME=me PASSWORD=secret npx playwright test
```

```batch tab=bash-batch
set USERNAME=me
set PASSWORD=secret
npx playwright test
```

```powershell tab=bash-powershell
$env:USERNAME=me
$env:PASSWORD=secret
npx playwright test
```

Similarly, configuration file can also read environment variables passed through the command line.


```js tab=js-js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    baseURL: process.env.STAGING === '1' ? 'http://staging.example.test/' : 'http://example.test/',
  }
};

module.exports = config;
```

```js tab=js-ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  use: {
    baseURL: process.env.STAGING === '1' ? 'http://staging.example.test/' : 'http://example.test/',
  }
};
export default config;
```

Now, you can run tests against a staging or a production environment:

```bash tab=bash-bash
STAGING=1 npx playwright test
```

```batch tab=bash-batch
set STAGING=1
npx playwright test
```

```powershell tab=bash-powershell
$env:STAGING=1
npx playwright test
```

### .env files
* langs: js

To make environment variables easier to manage, consider something like `.env` files. Here is an example that uses [`dotenv`](https://www.npmjs.com/package/dotenv) package to read environment variables directly in the configuration file.

```js tab=js-js
// playwright.config.js
// @ts-check

// Read from default ".env" file.
require('dotenv').config();

// Alternatively, read from "../my.env" file.
require('dotenv').config({ path: path.resolve(__dirname, '..', 'my.env') });

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    baseURL: process.env.STAGING === '1' ? 'http://staging.example.test/' : 'http://example.test/',
  }
};

module.exports = config;
```

```js tab=js-ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Read from default ".env" file.
dotenv.config();

// Alternatively, read from "../my.env" file.
dotenv.config({ path: path.resolve(__dirname, '..', 'my.env') });

const config: PlaywrightTestConfig = {
  use: {
    baseURL: process.env.STAGING === '1' ? 'http://staging.example.test/' : 'http://example.test/',
  }
};
export default config;
```

Now, you can just edit `.env` file to set any variables you'd like.

```bash
# .env file
STAGING=0
USERNAME=me
PASSWORD=secret
```

Run tests as usual, your environment variables should be picked up.

```bash
npx playwright test
```

## Create tests via a CSV file
* langs: js

The Playwright test-runner runs in Node.js, this means you can directly read files from the file system and parse them with your preferred CSV library.

See for example this CSV file, in our example `input.csv`:

```txt
"test_case","some_value","some_other_value"
"value 1","value 11","foobar1"
"value 2","value 22","foobar21"
"value 3","value 33","foobar321"
"value 4","value 44","foobar4321"
```

Based on this we'll generate some tests by using the [csv-parse](https://www.npmjs.com/package/csv-parse) library from NPM:

```js tab=js-ts
// foo.spec.ts
import fs from 'fs';
import path from 'path';
import { test } from '@playwright/test';
import { parse } from 'csv-parse/sync';

const records = parse(fs.readFileSync(path.join(__dirname, 'input.csv')), {
  columns: true,
  skip_empty_lines: true
});

for (const record of records) {
  test(`fooo: ${record.test_case}`, async ({ page }) => {
    console.log(record.test_case, record.some_value, record.some_other_value);
  });
}
```

```js tab=js-js
// foo.spec.js
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { parse } = require('csv-parse/sync');

const records = parse(fs.readFileSync(path.join(__dirname, 'input.csv')), {
  columns: true,
  skip_empty_lines: true
});

for (const record of records) {
  test(`fooo: ${record.test_case}`, async ({ page }) => {
    console.log(record.test_case, record.some_value, record.some_other_value);
  });
}
```
## Emulation
* langs: java, python, csharp

Playwright allows overriding various parameters of the device where the browser is running:
- viewport size, device scale factor, touch support
- locale, timezone
- color scheme
- geolocation

Most of these parameters are configured during the browser context construction, but some of them such as viewport size
can be changed for individual pages.

## Devices
* langs: python, csharp

Playwright comes with a registry of device parameters for selected mobile devices. It can be used to simulate browser
behavior on a mobile device:

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    pixel_2 = playwright.devices['Pixel 2']
    browser = await playwright.webkit.launch(headless=False)
    context = await browser.new_context(
        **pixel_2,
    )

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    pixel_2 = playwright.devices['Pixel 2']
    browser = playwright.webkit.launch(headless=False)
    context = browser.new_context(
        **pixel_2,
    )

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Chromium.LaunchAsync(new()
        {
            Headless: False
        });
        var pixel2 = playwright.Devices["Pixel 2"];
        await using var context = await browser.NewContextAsync(pixel2);
    }
}
```

All pages created in the context above will share the same device parameters.

**API reference**
- [`property: Playwright.devices`]
- [`method: Browser.newContext`]


## User agent
* langs: java, python, csharp

All pages created in the context above will share the user agent specified:

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setUserAgent("My user agent"));
```

```python async
context = await browser.new_context(
  user_agent='My user agent'
)
```

```python sync
context = browser.new_context(
  user_agent='My user agent'
)
```

```csharp
var context = await browser.NewContextAsync(new BrowserNewContextOptions { UserAgent = "My User Agent" });
```

**API reference**
- [`method: Browser.newContext`]


## Viewport
* langs: java, python, csharp

Create a context with custom viewport size:

```java
// Create context with given viewport
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setViewportSize(1280, 1024));

// Resize viewport for individual page
page.setViewportSize(1600, 1200);

// Emulate high-DPI
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setViewportSize(2560, 1440)
  .setDeviceScaleFactor(2);
```

```python async
# Create context with given viewport
context = await browser.new_context(
  viewport={ 'width': 1280, 'height': 1024 }
)

# Resize viewport for individual page
await page.set_viewport_size({"width": 1600, "height": 1200})

# Emulate high-DPI
context = await browser.new_context(
  viewport={ 'width': 2560, 'height': 1440 },
  device_scale_factor=2,
)
```

```python sync
# Create context with given viewport
context = browser.new_context(
  viewport={ 'width': 1280, 'height': 1024 }
)

# Resize viewport for individual page
await page.set_viewport_size({"width": 1600, "height": 1200})

# Emulate high-DPI
context = browser.new_context(
  viewport={ 'width': 2560, 'height': 1440 },
  device_scale_factor=2,
```

```csharp
// Create context with given viewport
await using var context = await browser.NewContextAsync(new()
{
    ViewportSize = new ViewportSize() { Width = 1280, Height = 1024 }
});

// Resize viewport for individual page
await page.SetViewportSizeAsync(1600, 1200);

// Emulate high-DPI
await using var context = await browser.NewContextAsync(new()
{
    ViewportSize = new ViewportSize() { Width = 2560, Height = 1440 },
    DeviceScaleFactor = 2
});
```

**API reference**
- [`method: Browser.newContext`]
- [`method: Page.setViewportSize`]

## Locale & timezone
* langs: java, python, csharp


```java
// Emulate locale and time
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setLocale("de-DE")
  .setTimezoneId("Europe/Berlin"));
```

```python async
# Emulate locale and time
context = await browser.new_context(
  locale='de-DE',
  timezone_id='Europe/Berlin',
)
```

```python sync
# Emulate locale and time
context = browser.new_context(
  locale='de-DE',
  timezone_id='Europe/Berlin',
)
```

```csharp
await using var context = await browser.NewContextAsync(new()
{
    Locale = "de-DE",
    TimezoneId = "Europe/Berlin"
});
```

**API reference**
- [`method: Browser.newContext`]

## Permissions
* langs: java, python, csharp

Allow all pages in the context to show system notifications:


```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setPermissions(Arrays.asList("notifications"));
```

```python async
context = await browser.new_context(
  permissions=['notifications'],
)
```

```python sync
context = browser.new_context(
  permissions=['notifications'],
)
```

Grant all pages in the existing context access to current location:

```java
context.grantPermissions(Arrays.asList("geolocation"));
```

```python async
await context.grant_permissions(['geolocation'])
```

```python sync
context.grant_permissions(['geolocation'])
```

```csharp
await context.GrantPermissionsAsync(new[] { "geolocation" });
```

Grant notifications access from a specific domain:

```js
await context.grantPermissions(['notifications'], {origin: 'https://skype.com'} );
```

```java
context.grantPermissions(Arrays.asList("notifications"),
  new BrowserContext.GrantPermissionsOptions().setOrigin("https://skype.com"));
```

```python async
await context.grant_permissions(['notifications'], origin='https://skype.com')
```

```python sync
context.grant_permissions(['notifications'], origin='https://skype.com')
```

```csharp
await context.GrantPermissionsAsync(new[] { "notifications" }, origin: "https://skype.com");
```

Revoke all permissions:

```js
await context.clearPermissions();
```

```java
context.clearPermissions();
```

```python async
await context.clear_permissions()
```

```python sync
context.clear_permissions()
```

```csharp
await context.ClearPermissionsAsync();
```

**API reference**
- [`method: Browser.newContext`]
- [`method: BrowserContext.grantPermissions`]
- [`method: BrowserContext.clearPermissions`]


## Geolocation
* langs: java, python, csharp

Create a context with `"geolocation"` permissions granted:

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setGeolocation(48.858455, 2.294474)
  .setPermissions(Arrays.asList("geolocation")));
```

```python async
context = await browser.new_context(
  geolocation={"longitude": 48.858455, "latitude": 2.294474},
  permissions=["geolocation"]
)
```

```python sync
context = browser.new_context(
  geolocation={"longitude": 48.858455, "latitude": 2.294474},
  permissions=["geolocation"]
)
```

```csharp
await using var context = await browser.NewContextAsync(new()
{
    Permissions = new[] { "geolocation" },
    Geolocation = new Geolocation() { Longitude = 48.858455f, Latitude = 2.294474f }
});
```

Change the location later:

```js
await context.setGeolocation({ longitude: 29.979097, latitude: 31.134256 });
```

```java
context.setGeolocation(new Geolocation(29.979097, 31.134256));
```

```python async
await context.set_geolocation({"longitude": 29.979097, "latitude": 31.134256})
```

```python sync
context.set_geolocation({"longitude": 29.979097, "latitude": 31.134256})
```

```csharp
await context.SetGeolocationAsync(new Geolocation() { Longitude = 48.858455f, Latitude = 2.294474f });
```

**Note** you can only change geolocation for all pages in the context.

**API reference**
- [`method: Browser.newContext`]
- [`method: BrowserContext.setGeolocation`]


## Color scheme and media
* langs: java, python, csharp
* 
Create a context with dark or light mode. Pages created in this context will follow this color scheme preference.

```java
// Create context with dark mode
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setColorScheme(ColorScheme.DARK)); // or "light"

// Create page with dark mode
Page page = browser.newPage(new Browser.NewPageOptions()
  .setColorScheme(ColorScheme.DARK)); // or "light"

// Change color scheme for the page
page.emulateMedia(new Page.EmulateMediaOptions().setColorScheme(ColorScheme.DARK));

// Change media for page
page.emulateMedia(new Page.EmulateMediaOptions().setMedia(Media.PRINT));
```

```python async
# Create context with dark mode
context = await browser.new_context(
  color_scheme='dark' # or 'light'
)

# Create page with dark mode
page = await browser.new_page(
  color_scheme='dark' # or 'light'
)

# Change color scheme for the page
await page.emulate_media(color_scheme='dark')

# Change media for page
await page.emulate_media(media='print')
```

```python sync
# Create context with dark mode
context = browser.new_context(
  color_scheme='dark' # or 'light'
)

# Create page with dark mode
page = browser.new_page(
  color_scheme='dark' # or 'light'
)

# Change color scheme for the page
page.emulate_media(color_scheme='dark')

# Change media for page
page.emulate_media(media='print')
```

```csharp
// Create context with dark mode
await using var context = await browser.NewContextAsync(new()
{
    ColorScheme = ColorScheme.Dark
});

// Create page with dark mode
var page = await browser.NewPageAsync(new()
{
    ColorScheme = ColorScheme.Dark
});

// Change color scheme for the page
await page.EmulateMediaAsync(new()
{
    ColorScheme = ColorScheme.Dark
});

// Change media for page
await page.EmulateMediaAsync(new()
{
    Media = Media.Print
});
```

**API reference**
- [`method: Browser.newContext`]
- [`method: Page.emulateMedia`]