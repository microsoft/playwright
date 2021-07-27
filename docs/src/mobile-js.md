---
id: mobile
title: "Mobile (experimental)"
---

<!-- TOC -->
:::warning
Mobile support is experimental and uses prefixed provisional API.
:::

You can try Playwright against Android, Chrome for Android and Android WebView today. This support is experimental. Support for devices is tracked in the issue [#1122](https://github.com/microsoft/playwright/issues/1122).

See [Android] for documentation.

## Requirements

- Android device or AVD Emulator.
- [ADB daemon](https://developer.android.com/studio/command-line/adb) running and authenticated with your device. Typically running `adb devices` is all you need to do.
- [`Chrome 87`](https://play.google.com/store/apps/details?id=com.android.chrome) or newer installed on the device
- "Enable command line on non-rooted devices" enabled in `chrome://flags`.

## How to run

```js
const { _android } = require('playwright');

(async () => {
  // Connect to the device.
  const [device] = await playwright._android.devices();
  console.log(`Model: ${device.model()}`);
  console.log(`Serial: ${device.serial()}`);
  // Take screenshot of the whole device.
  await device.screenshot({ path: 'device.png' });

  {
    // --------------------- WebView -----------------------

    // Launch an application with WebView.
    await device.shell('am force-stop org.chromium.webview_shell');
    await device.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');
    // Get the WebView.
    const webview = await device.webView({ pkg: 'org.chromium.webview_shell' });

    // Fill the input box.
    await device.fill({ res: 'org.chromium.webview_shell:id/url_field' }, 'github.com/microsoft/playwright');
    await device.press({ res: 'org.chromium.webview_shell:id/url_field' }, 'Enter');

    // Work with WebView's page as usual.
    const page = await webview.page();
    await page.page.waitForNavigation({ url: /.*microsoft\/playwright.*/ });
    console.log(await page.title());
  }

  {
    // --------------------- Browser -----------------------

    // Launch Chrome browser.
    await device.shell('am force-stop com.android.chrome');
    const context = await device.launchBrowser();

    // Use BrowserContext as usual.
    const page = await context.newPage();
    await page.goto('https://webkit.org/');
    console.log(await page.evaluate(() => window.location.href));
    await page.screenshot({ path: 'page.png' });

    await context.close();
  }

  // Close the device.
  await device.close();
})();
```

## Known limitations
- Raw USB operation is not yet supported, so you need ADB.
- Device needs to be awake to produce screenshots. Enabling "Stay awake" developer mode will help.
- We didn't run all the tests against the device, so not everything works.
