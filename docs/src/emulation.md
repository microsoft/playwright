---
id: emulation
title: "Emulation"
---

## Introduction

With Playwright you can test your app on any browser as well as emulate a real device such as a mobile phone or tablet. Simply configure the devices you would like to emulate and Playwright will simulate the browser behavior such as `"userAgent"`, `"screenSize"`, `"viewport"` and if it `"hasTouch"` enabled. You can also emulate the `"geolocation"`, `"locale"` and `"timezone"` for all tests or for a specific test as well as set the `"permissions"` to show notifications or change the `"colorScheme"`.

## Devices
* langs: js, csharp, python

Playwright comes with a [registry of device parameters](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptorsSource.json) using [`property: Playwright.devices`] for selected desktop, tablet and mobile devices. It can be used to simulate browser behavior for a specific device such as user agent, screen size, viewport and if it has touch enabled. All tests will run with the specified device parameters.

```js tab=js-test title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test'; // import devices

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 13'],
      },
    },
  ],
});
```

```js tab=js-library
const { chromium, devices } = require('playwright');
const browser = await chromium.launch();

const iphone13 = devices['iPhone 13'];
const context = await browser.newContext({
  ...iphone13,
});
```

```python async
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    iphone_13 = playwright.devices['iPhone 13']
    browser = await playwright.webkit.launch(headless=False)
    context = await browser.new_context(
        **iphone_13,
    )

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright, Playwright

def run(playwright: Playwright):
    iphone_13 = playwright.devices['iPhone 13']
    browser = playwright.webkit.launch(headless=False)
    context = browser.new_context(
        **iphone_13,
    )

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync(new()
{
    Headless = false
});
var iphone13 = playwright.Devices["iPhone 13"];
await using var context = await browser.NewContextAsync(iphone13);
```


<img width="458" alt="playwright.dev website emulated for iPhone 13" src="https://user-images.githubusercontent.com/13063165/220411073-76fe59f9-9a2d-463d-8e30-c19a7deca133.png" />


## Devices
* langs: java

Playwright can emulate various devices by specifying `setDeviceScaleFactor`, `setHasTouch`, `setIsMobile`, `setScreenSize`, `setUserAgent` and `setViewportSize` options when creating a context with [`method: Browser.newContext`].

## Viewport

The viewport is included in the device but you can override it for some tests with [`method: Page.setViewportSize`].

```js tab=js-test title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // It is important to define the `viewport` property after destructuring `devices`,
        // since devices also define the `viewport` for that device.
        viewport: { width: 1280, height: 720 },
      },
    },
  ]
});
```

```js tab=js-library
// Create context with given viewport
const context = await browser.newContext({
  viewport: { width: 1280, height: 1024 }
});
```

Test file:

```js tab=js-test title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test.use({
  viewport: { width: 1600, height: 1200 },
});

test('my test', async ({ page }) => {
  // ...
});
```

```js tab=js-library
// Create context with given viewport
const context = await browser.newContext({
  viewport: { width: 1280, height: 1024 }
});

// Resize viewport for individual page
await page.setViewportSize({ width: 1600, height: 1200 });

// Emulate high-DPI
const context = await browser.newContext({
  viewport: { width: 2560, height: 1440 },
  deviceScaleFactor: 2,
});
```

The same works inside a test file.

```js tab=js-test title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test.describe('specific viewport block', () => {
  test.use({ viewport: { width: 1600, height: 1200 } });

  test('my test', async ({ page }) => {
    // ...
  });
});
```

```js tab=js-library
// Create context with given viewport
const context = await browser.newContext({
  viewport: { width: 1600, height: 1200 }
});
const page = await context.newPage();
```

```java
// Create context with given viewport
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setViewportSize(1280, 1024));

// Resize viewport for individual page
page.setViewportSize(1600, 1200);

// Emulate high-DPI
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setViewportSize(2560, 1440)
  .setDeviceScaleFactor(2));
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
page.set_viewport_size({"width": 1600, "height": 1200})

# Emulate high-DPI
context = browser.new_context(
  viewport={ 'width': 2560, 'height': 1440 },
  device_scale_factor=2,
)
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

## isMobile

Whether the meta viewport tag is taken into account and touch events are enabled.

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // It is important to define the `isMobile` property after destructuring `devices`,
        // since devices also define the `isMobile` for that device.
        isMobile: false,
      },
    },
  ]
});
```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .isMobile(false));
```

```python async
context = await browser.new_context(
  isMobile=false
)
```

```python sync
context = browser.new_context(
  isMobile=false
)
```

```csharp
await using var context = await browser.NewContextAsync(new()
{
    IsMobile = false
});
```

## Locale & Timezone

Emulate the browser Locale and Timezone which can be set globally for all tests in the config and then overridden for particular tests.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Emulates the browser locale.
    locale: 'en-GB',

    // Emulates the browser timezone.
    timezoneId: 'Europe/Paris',
  },
});
```

```js tab=js-test title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test.use({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
});

test('my test for de lang in Berlin timezone', async ({ page }) => {
  await page.goto('https://www.bing.com');
  // ...
});
```

```js tab=js-library
const context = await browser.newContext({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
});
```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setLocale("de-DE")
  .setTimezoneId("Europe/Berlin"));
```

```python async
context = await browser.new_context(
  locale='de-DE',
  timezone_id='Europe/Berlin',
)
```

```python sync
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

<img width="1394" alt="Bing in german lang and timezone" src="https://user-images.githubusercontent.com/13063165/220416571-ccc96ab1-44bb-4579-8430-64502fc24a15.png" />

######
* langs: js

Note that this only affects the browser timezone and locale, not the test runner timezone.
To set the test runner timezone, you can use the [`TZ` environment variable](https://nodejs.org/api/cli.html#tz).

## Permissions

Allow app to show system notifications.

```js tab=js-test title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Grants specified permissions to the browser context.
    permissions: ['notifications'],
  },
});
```

```js tab=js-library
const context = await browser.newContext({
  permissions: ['notifications'],
});
```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setPermissions(Arrays.asList("notifications")));
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

Allow notifications for a specific domain.

```js tab=js-test title="tests/example.spec.ts"
import { test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  // Runs before each test and signs in each page.
  await context.grantPermissions(['notifications'], { origin: 'https://skype.com' });
});

test('first', async ({ page }) => {
  // page has notifications permission for https://skype.com.
});
```

```js tab=js-library
await context.grantPermissions(['notifications'], { origin: 'https://skype.com' });
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

Revoke all permissions with [`method: BrowserContext.clearPermissions`].

```js
// Library
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

## Geolocation

Grant `"geolocation"` permissions and set geolocation to a specific area.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    // Context geolocation
    geolocation: { longitude: 12.492507, latitude: 41.889938 },
    permissions: ['geolocation'],
  },
});
```

```js tab=js-test title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test.use({
  geolocation: { longitude: 41.890221, latitude: 12.492348 },
  permissions: ['geolocation'],
});

test('my test with geolocation', async ({ page }) => {
  // ...
});
```

```js tab=js-library
const context = await browser.newContext({
  geolocation: { longitude: 41.890221, latitude: 12.492348 },
  permissions: ['geolocation']
});

```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setGeolocation(41.890221, 12.492348)
  .setPermissions(Arrays.asList("geolocation")));
```

```python async
context = await browser.new_context(
  geolocation={"longitude": 41.890221, "latitude": 12.492348},
  permissions=["geolocation"]
)
```

```python sync
context = browser.new_context(
  geolocation={"longitude": 41.890221, "latitude": 12.492348},
  permissions=["geolocation"]
)
```

```csharp
await using var context = await browser.NewContextAsync(new()
{
    Permissions = new[] { "geolocation" },
    Geolocation = new Geolocation() { Longitude = 41.890221, Latitude = 12.492348 }
});
```

<img width="1394" alt="geolocation for italy on bing maps" src="https://user-images.githubusercontent.com/13063165/220417670-bb22d815-f5cd-47c4-8562-0b88165eac27.png" />

Change the location later:

```js tab=js-test title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test.use({
  geolocation: { longitude: 41.890221, latitude: 12.492348 },
  permissions: ['geolocation'],
});

test('my test with geolocation', async ({ page, context }) => {
  // overwrite the location for this test
  await context.setGeolocation({ longitude: 48.858455, latitude: 2.294474 });
});
```

```js tab=js-library
await context.setGeolocation({ longitude: 48.858455, latitude: 2.294474 });
```

```java
context.setGeolocation(new Geolocation(48.858455, 2.294474));
```

```python async
await context.set_geolocation({"longitude": 48.858455, "latitude": 2.294474})
```

```python sync
context.set_geolocation({"longitude": 48.858455, "latitude": 2.294474})
```

```csharp
await context.SetGeolocationAsync(new Geolocation() { Longitude = 48.858455, Latitude = 2.294474 });
```

**Note** you can only change geolocation for all pages in the context.
## Color Scheme and Media

Emulate the users `"colorScheme"`. Supported values are 'light' and 'dark'. You can also emulate the media type with [`method: Page.emulateMedia`].

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    colorScheme: 'dark',
  },
});
```

```js tab=js-test title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test.use({
  colorScheme: 'dark' // or 'light'
});

test('my test with dark mode', async ({ page }) => {
  // ...
});
```

```js tab=js-library
// Create context with dark mode
const context = await browser.newContext({
  colorScheme: 'dark' // or 'light'
});

// Create page with dark mode
const page = await browser.newPage({
  colorScheme: 'dark' // or 'light'
});

// Change color scheme for the page
await page.emulateMedia({ colorScheme: 'dark' });

// Change media for page
await page.emulateMedia({ media: 'print' });
```

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

<img width="1394" alt="playwright web in dark mode" src="https://user-images.githubusercontent.com/13063165/220411638-55d2b051-4678-4da7-9f0b-ed22f5a3c47c.png" />
## User Agent

The User Agent is included in the device and therefore you  will rarely need to change it however if you do need to test a different user agent you can override it with the `userAgent` property.

```js tab=js-test title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test.use({ userAgent: 'My user agent' });

test('my user agent test', async ({ page }) => {
  // ...
});
```

```js tab=js-library
const context = await browser.newContext({
  userAgent: 'My user agent'
});
```

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
var context = await browser.NewContextAsync(new() { UserAgent = "My User Agent" });
```

## Offline

Emulate the network being offline.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    offline: true
  },
});
```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .setOffline(true));
```

```python async
context = await browser.new_context(
  offline=True
)
```

```python sync
context = browser.new_context(
  offline=True
)
```

```csharp
var context = await browser.NewContextAsync(new() { Offline = true });
```
## JavaScript Enabled

Emulate a user scenario where JavaScript is disabled.

```js tab=js-test title="tests/example.spec.ts"
import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('test with no JavaScript', async ({ page }) => {
  // ...
});
```

```js tab=js-library
const context = await browser.newContext({
  javaScriptEnabled: false
});
```

```java
BrowserContext context = browser.newContext(new Browser.NewContextOptions()
  .javaScriptEnabled(false));
```

```python async
context = await browser.new_context(
  java_script_enabled=False
)
```

```python sync
context = browser.new_context(
  java_script_enabled=False
)
```

```csharp
var context = await browser.NewContextAsync(new() { JavaScriptEnabled = false });
```
