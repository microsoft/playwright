---
id: emulation
title: "Emulation"
---

With Playwright you can test your app on any browser as well as emulate a real device such as a mobile phone or tablet. Simply configure the devices you would like to emulate and Playwright will simulate the browser behavior such as `"userAgent"`, `"screenSize"`, `"viewport"` and if it `"hasTouch"` enabled. You can also emulate the `"geolocation"`, `"locale"` and `"timezone"` for all tests or for a specific test as well as set the `"permissions"` to show notifications or change the `"colorScheme"`.

## Devices
* langs: js, csharp, python

Playwright comes with a [registry of device parameters](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptorsSource.json) using [`property: Playwright.devices`] for selected desktop, tablet and mobile devices. It can be used to simulate browser behavior for a specific device such as user agent, screen size, viewport and if it has touch enabled. All tests will run with the specified device parameters. 

```js tab=js-ts
// playwright.config.ts
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
        ...devices['iPhone 12'],
      },
    },
  ],
});
```

```js tab=js-js
// playwright.config.js
// @ts-check
const { devices, defineConfig } = require('@playwright/test'); // require devices

module.exports = defineConfig({
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
        ...devices['iPhone 12'],
      },
    },
  ],
});
```

```js tab=js-library
const { chromium, devices } = require('playwright');
const browser = await chromium.launch();

const iphone12 = devices['iPhone 12'];
const context = await browser.newContext({
  ...iphone12,
});
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    iphone_12 = playwright.devices['iPhone 12']
    browser = await playwright.webkit.launch(headless=False)
    context = await browser.new_context(
        **iphone_12,
    )

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    iphone_12 = playwright.devices['iPhone 12']
    browser = playwright.webkit.launch(headless=False)
    context = browser.new_context(
        **iphone_12,
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
        var iphone12 = playwright.Devices["iPhone 12"];
        await using var context = await browser.NewContextAsync(iphone12);
    }
}
```

## Viewport

The viewport is included in the device but you can override it for some tests with [`method: Page.setViewportSize`].

```js tab=js-ts
import { test, expect } from '@playwright/test';

// Run tests in this file with portrait-like viewport.
test.use({
  viewport: { width: 600, height: 900 },
});

test('my portrait test', async ({ page }) => {
  // ...
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

// Run tests in this file with portrait-like viewport.
test.use({ 
  viewport: { width: 600, height: 900 },
});

test('my portrait test', async ({ page }) => {
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
The same works inside a describe block.

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.describe('locale block', () => {
  // Run tests in this describe block with portrait-like viewport.
  test.use({ viewport: { width: 600, height: 900 } });

  test('my portrait test', async ({ page }) => {
    // ...
  });
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

test.describe('locale block', () => {
  // Run tests in this describe block with portrait-like viewport.
  test.use({ viewport: { width: 600, height: 900 } });

  test('my portrait test', async ({ page }) => {
    // ...
  });
});
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
## Locale & Timezone

Emulate the user Locale and Timezone which can be set globally for all tests in the config and then overridden for particular tests.

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.use({ 
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
});

test('my test for de lang in Berlin timezone', async ({ page }) => {
  // ...
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

test.use({ 
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
});

test('my test for de lang in Berlin timezone', async ({ page }) => {
  // ...
});
```

```js tab=js-library
// Emulate locale and time
const context = await browser.newContext({
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
});
```

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
## Permissions

Allow app to show system notifications.

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  use: {
    permissions: ['notifications'],
  },
});
```

```js tab=js-ts
import type { PlaywrightTestConfig } from '@playwright/test';
export default defineConfig({
  use: {
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

Allow test to request current location.

```js tab=js-js
// @ts-check

const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  use: {
    permissions: ['geolocation'],
  },
});
```

```js tab=js-ts
import type { defineConfig } from '@playwright/test';
export default defineConfig({
  use: {
    permissions: ['geolocation'],
  },
});
```

```js tab=js-library
await context.grantPermissions(['geolocation']);
```

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

Allow notifications for a specific domain.

```js tab=js-js
const { test } = require('@playwright/test');

test.beforeEach(async ({ context }) => {
  // Runs before each test and signs in each page.
  await context.grantPermissions(['notifications'], { origin: 'https://skype.com' });
});

test('first', async ({ page }) => {
  // page has notifications permission for https://skype.com.
});
```

```js tab=js-ts
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

Create a test with `"geolocation"` permissions granted and geolocation set to a specific area.

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.use({ 
  geolocation: { longitude: 48.858455, latitude: 2.294474 },
  permissions: ['geolocation'],
});

test('my test with geolocation', async ({ page }) => {
  // ...
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

test.use({ 
  geolocation: { longitude: 48.858455, latitude: 2.294474 },
  permissions: ['geolocation'],
});

test('my test with geolocation', async ({ page }) => {
  // ...
});
```

```js tab=js-library
const context = await browser.newContext({
  geolocation: { longitude: 48.858455, latitude: 2.294474 },
  permissions: ['geolocation']
});

```

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

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.use({ 
  geolocation: { longitude: 48.858455, latitude: 2.294474 },
  permissions: ['geolocation'],
});

test('my test with geolocation', async ({ page, context }) => {
  // overwrite the location for this test
  await context.setGeolocation({ longitude: 29.979097, latitude: 31.134256 });
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

test.use({ 
  geolocation: { longitude: 48.858455, latitude: 2.294474 },
  permissions: ['geolocation'],
});

test('my test with geolocation', async ({ page, context }) => {
  // overwrite the location for this test
  await context.setGeolocation({ longitude: 29.979097, latitude: 31.134256 });
});
```

```js tab=js-library
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
## Color Scheme and Media

Create a test that emulates the users `"colorScheme"`. Supported values are 'light', 'dark', 'no-preference'. You can also emulate the media type with [`method: Page.emulateMedia`].

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.use({ 
  colorScheme: 'dark' // or 'light'
});

test('my test with dark mode', async ({ page }) => {
  // ...
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

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
## User Agent

The User Agent is included in the device and therefore you  will rarely need to change it however if you do need to test a different user agent you can override it with the `userAgent` property.

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.use({ userAgent: 'My user agent'});

test('my user agent test', async ({ page }) => {
  // ...
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

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
var context = await browser.NewContextAsync(new BrowserNewContextOptions { UserAgent = "My User Agent" });
```
## JavaScript Enabled

Emulate a user scenario where JavaScript is disabled.

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.use({ javaScriptEnabled: false });

test('test with no JavaScript', async ({ page }) => {
  // ...
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

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