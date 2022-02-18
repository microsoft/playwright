# class: Android
* langs: js

Playwright has **experimental** support for Android automation. This includes Chrome for Android and Android WebView.

*Requirements*

* Android device or AVD Emulator.
* [ADB daemon](https://developer.android.com/studio/command-line/adb) running and authenticated with your device. Typically running `adb devices` is all you need to do.
* [`Chrome 87`](https://play.google.com/store/apps/details?id=com.android.chrome) or newer installed on the device
* "Enable command line on non-rooted devices" enabled in `chrome://flags`.

*Known limitations*

* Raw USB operation is not yet supported, so you need ADB.
* Device needs to be awake to produce screenshots. Enabling "Stay awake" developer mode will help.
* We didn't run all the tests against the device, so not everything works.

*How to run*

An example of the Android automation script would be:

```js
const { _android: android } = require('playwright');

(async () => {
  // Connect to the device.
  const [device] = await android.devices();
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
    await page.waitForNavigation({ url: /.*microsoft\/playwright.*/ });
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

Note that since you don't need Playwright to install web browsers when testing Android, you can omit browser download via setting the following environment variable when installing Playwright:

```bash js
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright
```

## async method: Android.devices
- returns: <[Array]<[AndroidDevice]>>

Returns the list of detected Android devices.

### option: Android.devices.port
- `port` <[int]>

Optional port to establish ADB server connection.

## method: Android.setDefaultTimeout

This setting will change the default maximum time for all the methods accepting [`param: timeout`] option.

### param: Android.setDefaultTimeout.timeout
- `timeout` <[float]>

Maximum time in milliseconds
