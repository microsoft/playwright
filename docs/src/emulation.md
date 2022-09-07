---
id: emulation
title: "Emulation"
---

Playwright allows overriding various parameters such as `viewportSize`, `deviceScaleFactor`, `locale`, `timezone`, `colorScheme`, `geolocation` and more.

## Devices
* langs: js, csharp, python

Playwright comes with a registry of device parameters for selected mobile devices. It can be used to simulate browser behavior on a specific mobile device. All tests will run with the specified device parameters.


```js tab=js-ts
// playwright.config.ts
import { type PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  projects: [
    // "Pixel 4" tests use Chromium browser.
    {
      name: 'Pixel 4',
      use: {
        ...devices['Pixel 4'],
      },
    },
  ],
};
export default config;
```

```js tab=js-js
// playwright.config.js
// @ts-check
const { devices } = require('@playwright/test');

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  projects: [
    // "Pixel 4" tests use Chromium browser.
    {
      name: 'Pixel 4',
      use: {
        browserName: 'chromium',
        ...devices['Pixel 4'],
      },
    },
  ],
};

module.exports = config;
```

```js tab=js-library
const { chromium, devices } = require('playwright');
const browser = await chromium.launch();

const pixel4 = devices['Pixel 4'];
const context = await browser.newContext({
  ...pixel2,
});
```

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
#### Global Configuration
* langs: js
  
For a more complete guide on configuration for devices check out our [configuration guide](./test-configuration.md#global-configuration).

#### API Reference

- [`property: Playwright.devices`]
- [`method: Browser.newContext`]
  
## User Agent

All pages created in the context above will share the user agent specified.

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

#### Global Configuration
* langs: js

For global configuration so all tests run with the specified user agent check out the [configuration guide](./test-configuration.md#global-configuration).

#### API Reference
- [`method: Browser.newContext`]

## Viewport

Create a context with custom viewport size.

```js tab=js-ts
import { test, expect } from '@playwright/test';

// Run tests in this file with portrait-like viewport.
test.use({
  viewport: { width: 600, height: 900 },
  deviceScaleFactor: 2 // Emulate high-DPI
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
  deviceScaleFactor: 2 // Emulate high-DPI
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

#### Global Configuration
* langs: js

For global configuration so all tests run with the specified viewport check out the [configuration guide](./test-configuration.md#global-configuration).

#### API Reference
- [`method: Browser.newContext`]
- [`method: Page.setViewportSize`]

## Locale & Timezone

All pages will share the locale and timezone specified.

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
#### Global Configuration
* langs: js
  
For global configuration so all tests run with the specified locale and timezone check out the [configuration guide](./test-configuration.md#global-configuration).

#### API Reference
- [`method: Browser.newContext`]

## Permissions

Allow test to show system notifications.

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.use({ permissions: ['notifications']});

test('my test with notifications', async ({ page }) => {
  // ...
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

test.use({ permissions: ['notifications']});

test('my test with notifications', async ({ page }) => {
  // ...
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

Grant all pages in the existing context access to current location.

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.use({ permissions: ['geolocation']});

test('my test with geolocation', async ({ page }) => {
  // ...
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

test.use({ permissions: ['geolocation']});

test('my test with geolocation', async ({ page }) => {
  // ...
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

Grant notifications access from a specific domain.

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.use({ permissions: ['geolocation'], {origin: 'https://skype.com'}});

test('my test with notifications from skype', async ({ page }) => {
  // ...
});
```

```js tab=js-js
const { test, expect } = require('@playwright/test');

test.use({ permissions: ['notifications'], {origin: 'https://skype.com'}});

test('my test with notifications from skype', async ({ page }) => {
  // ...
});
```

```js tab=js-library
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

#### Global Configuration
* langs: js

For global configuration so all tests run with the specified permissions check out the [configuration guide](./test-configuration.md#global-configuration).

#### API Reference
- [`method: Browser.newContext`]
- [`method: BrowserContext.grantPermissions`]
- [`method: BrowserContext.clearPermissions`]

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

// change location later
await context.setGeolocation({ longitude: 29.979097, latitude: 31.134256 });

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

#### Global Configuration
* langs: js

For global configuration so all tests run with the specified geolocation check out the [configuration guide](./test-configuration.md#global-configuration).


#### API Reference
- [`method: Browser.newContext`]
- [`method: BrowserContext.setGeolocation`]

## Color Scheme

Create a test that emulates `"colorSheme"`.

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

#### Global Configuration
* langs: js

For global configuration so all tests run with the specified colorScheme check out the [configuration guide](./test-configuration.md#global-configuration).

#### API Reference
- [`method: Browser.newContext`]
- [`method: Page.emulateMedia`]
