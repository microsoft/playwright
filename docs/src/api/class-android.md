# class: Android
* since: v1.9
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

An example of the Android automation script using the connect-launchServer methods would be:

Server Side:

```
const { _android } = require('playwright');  // Or 'webkit' or 'firefox'.
(async () => {
  const browserServer = await _android.launchServer({
    deviceSerialNumber: "<deviceSerialNumber>", // If you have multiple devices connected and want to keep one specific prelaunched device
  });
  const wsEndpoint = browserServer.wsEndpoint();
  console.log(wsEndpoint);
})();
```

Client Side:

```
const { _android } = require('playwright');
(async () => {
  const device = await _android.connect(`<wsEndpoint>`);

  console.log(device.model());
  console.log(device.serial());
  await device.shell('am force-stop com.android.chrome');
  const context = await device.launchBrowser();

  const page = await context.newPage();
  await page.goto('https://webkit.org/');
  console.log(await page.evaluate(() => window.location.href));
  await page.screenshot({ path: 'page-chrome-1.png' });

  await context.close();
  await device.close();
})();
```

Note that since you don't need Playwright to install web browsers when testing Android, you can omit browser download via setting the following environment variable when installing Playwright:

```bash js
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright
```

## async method: Android.devices
* since: v1.9
- returns: <[Array]<[AndroidDevice]>>

Returns the list of detected Android devices.

### option: Android.devices.host
* since: v1.22
- `host` <[string]>

Optional host to establish ADB server connection. Default to `127.0.0.1`.

### option: Android.devices.port
* since: v1.20
- `port` <[int]>

Optional port to establish ADB server connection. Default to `5037`.

### option: Android.devices.omitDriverInstall
* since: v1.21
- `omitDriverInstall` <[boolean]>

Prevents automatic playwright driver installation on attach. Assumes that the drivers have been installed already.

## method: Android.setDefaultTimeout
* since: v1.9

This setting will change the default maximum time for all the methods accepting [`param: timeout`] option.

### param: Android.setDefaultTimeout.timeout
* since: v1.9
- `timeout` <[float]>

Maximum time in milliseconds

## async method: Android.connect
* since: v1.27
- returns: <[AndroidDevice]>

This methods attaches Playwright to an existing android instance.
### param: Android.connect.wsEndpoint
* since: v1.27
- `wsEndpoint` <[string]>

A browser websocket endpoint to connect to.

### option: Android.connect.headers
* since: v1.27
- `headers` <[Object]<[string], [string]>>

Additional HTTP headers to be sent with web socket connect request. Optional.

### option: Android.connect.slowMo
* since: v1.27
- `slowMo` <[float]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you
can see what is going on. Defaults to 0.

### option: Android.connect.logger
* since: v1.27
* langs: js
- `logger` <[Logger]>

Logger sink for Playwright logging. Optional.

### option: Android.connect.timeout
* since: v1.27
- `timeout` <[float]>

Maximum time in milliseconds to wait for the connection to be established. Defaults to
`30000` (30 seconds). Pass `0` to disable timeout.

## async method: Android.launchServer
* since: v1.27
* langs: js
- returns: <[BrowserServer]>

Returns the browser app instance.

Launches browser server that client can connect to. An example of launching a browser executable and connecting to it
later:

### option: Android.launchServer.-inline- = %%-shared-browser-options-list-v1.8-%%
* since: v1.27
### option: Android.launchServer.logger = %%-browser-option-logger-%%
* since: v1.27

### option: Android.launchServer.port
* since: v1.27
- `port` <[int]>

Port to use for the web socket. Defaults to 0 that picks any available port.

### option: Android.launchServer.wsPath
* since: v1.27
- `wsPath` <[string]>

Path at which to serve the Browser Server. For security, this defaults to an
unguessable string.

:::warning
Any process or web page (including those running in Playwright) with knowledge
of the `wsPath` can take control of the OS user. For this reason, you should
use an unguessable token when using this option.
:::