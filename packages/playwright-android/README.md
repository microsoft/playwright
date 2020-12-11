# playwright-android
This package contains the [Android](https://www.android.com/) flavor of [Playwright](http://github.com/microsoft/playwright).

## Requirements

- Android device or AVD Emulator.
- [ADB daemon](https://developer.android.com/studio/command-line/adb) running and authenticated with your device. Typically running `adb devices` is all you need to do.
- [Chrome 87](https://play.google.com/store/apps/details?id=com.android.chrome) or newer installed on the device
- "Enable command line on non-rooted devices" enabled in `chrome://flags`.

## How to demo

```js
const { android } = require('playwright-android');

(async () => {
  const [device] = await android.devices();
  console.log(`Model: ${device.model()}`);
  console.log(`Serial: ${device.serial()}`);

  await device.shell('am force-stop org.chromium.webview_shell');
  await device.shell('am start org.chromium.webview_shell/.WebViewBrowserActivity');

  const webview = await device.webView({ pkg: 'org.chromium.webview_shell' });
  const page = await webview.page();

  await device.fill({ res: 'org.chromium.webview_shell:id/url_field' }, 'github.com/microsoft/playwright');
  await Promise.all([
    page.waitForNavigation(),
    device.press({ res: 'org.chromium.webview_shell:id/url_field' }, 'Enter')
  ]);
  console.log(await page.title());

  {
    const context = await device.launchBrowser();
    const [page] = context.pages();
    await page.goto('https://webkit.org/');
    console.log(await page.evaluate(() => window.location.href));
    await context.close();
  }

  await device.close();
})();
```
