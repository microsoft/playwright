# Device and environment emulation
Playwright allows overriding various parameters that depend on the device where the browser is running (such as viewport size, touch support, dpr etc.) as well as custom system settings such as locale and timezone. Most of these parameters are configured during context construction but some of them (e.g. viewport size) can be changed for individual pages.

## Emulating popular devices
Playwright comes with a registry of device parameters for some popular mobile devices. It can be used to simulate browser behavior on a mobile device like this:
```js
  const { chromium, devices } = require('playwright');
  const browser = await chromium.launch();

  const pixel2 = devices['Pixel 2'];
  const context = await browser.newContext({
    ...pixel2,
  });
```
All pages created in the context above will share the same device parameters.

#### API reference

- [`playwright.devices`](./api.md#playwrightdevices)
- [`browser.newContext([options])`](./api.md#browsernewcontextoptions)

<br/>
<br/>

## Configuring screen size(viewport), touch support, isMobile ...
Create a context with custom viewport size:
```js
  const context = await browser.newContext({
    viewport: {
      width: 1280,
      height: 1024
    }
  });
```
Resize viewport for individual pages:

```js
  await page.setViewportSize({ 'width': 1600, 'height': 1200 });
```

Emulate custom mobile device _without_ touch support:
```js
  const context = await browser.newContext({
    viewport: {
      width: 400,
      height: 900,
    },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: false
  });
```

#### API reference

- [`browser.newContext([options])`](./api.md#browsernewcontextoptions)
- [`page.setViewportSize(viewportSize)`](./api.md#pagesetviewportsizeviewportsize)

<br/>
<br/>


## Geolocation
Create a context with 'geolocation' permissions granted:
```js
  const context = await browser.newContext({
    geolocation: { longitude: 48.858455, latitude: 2.294474 },
    permissions: ['geolocation']
  });
```
Change the location later:

```js
  await context.setGeolocation({ longitude: 29.979097, latitude: 31.134256 };
```
**Note** you can only change geolocation for all pages in the context.

#### API reference

- [`browser.newContext([options])`](./api.md#browsernewcontextoptions)
- [`browserContext.setGeolocation(geolocation)`](./api.md#browsercontextsetgeolocationgeolocation)

<br/>
<br/>

## Permissions
Allow all pages in the context to show system notifications:
```js
  const context = await browser.newContext({
    permissions: ['notifications'],
  });
```

Grant all pages in the existing context access to current location:
```js
  await context.grantPermissions(['geolocation']);
```

Grant camera and mic access from a specific domain:
```js
  await context.grantPermissions(['camera', 'microphone'], {origin: 'https://skype.com'} );
```
Revoke all permissions:
```js
  await context.clearPermissions();
```

#### API reference

- [`browser.newContext([options])`](./api.md#browsernewcontextoptions)
- [`browserContext.grantPermissions(permissions[][, options])`](./api.md#browsercontextgrantpermissionspermissions-options)
- [`browserContext.clearPermissions()`](./api.md#browsercontextclearpermissions)

<br/>
<br/>

## Locale and timzeone

```js
  const context = await browser.newContext({
    locale: 'ru-RU',
    timezoneId: 'Europe/Moscow',
  });
```

#### API reference

- [`browser.newContext([options])`](./api.md#browsernewcontextoptions)

<br/>
<br/>

