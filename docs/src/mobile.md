---
id: mobile
title: "Mobile (experimental)"
---

<!-- TOC -->
:::warning
Mobile support is experimental and uses prefixed provisional API.
:::

You can try Playwright against Chrome for Android today. This support is experimental. Support for devices is tracked in the issue [#1122](https://github.com/microsoft/playwright/issues/1122).

## Requirements

- [ADB daemon](https://developer.android.com/studio/command-line/adb) running and authenticated with your device.
- [`Chrome 87`](https://play.google.com/store/apps/details?id=com.android.chrome) or newer installed on the device
- "Enable command line on non-rooted devices" enabled in `chrome://flags`.

 > Playwright will be looking for ADB daemon on the default port `5037`. It will use the first device available. Typically running `adb devices` is all you need to do.

## How to run

```js
const { _clank } = require('playwright');

(async () => {
  const context = await _clank.launchPersistentContext('', {
    viewport: null
  });
  const [page] = context.pages();
  await page.goto('https://webkit.org/');
  console.log(await page.evaluate(() => window.location.href));
  await page.screenshot({ path: 'example.png' });
  await context.close();
})();
```

> [Clank](https://chromium.googlesource.com/chromium/src/+/master/docs/memory/android_dev_tips.md) is a code name for Chrome for Android.

## Known limitations
- Raw USB operation is not yet supported, so you need ADB.
- Only `launchPersistentContext` works, launching ephemeral contexts is not supported.
- Passing `viewport: null` is necessary to make sure resolution is not emulated.
- Device needs to be awake to produce screenshots. Enabling "Stay awake" developer mode will help.
- We didn't run all the tests against the device, so not everything works.
