# class: Electron
* since: v1.9
* langs: js

Playwright has **experimental** support for Electron automation, exposed as `_electron`. An example of the Electron automation script would be:

```js
import { _electron as electron } from 'playwright';

(async () => {
  // Launch Electron app.
  const electronApp = await electron.launch({ args: ['main.js'] });

  // Evaluation expression in the Electron context.
  const appPath = await electronApp.evaluate(async ({ app }) => {
    // This runs in the main Electron process, parameter here is always
    // the result of the require('electron') in the main app script.
    return app.getAppPath();
  });
  console.log(appPath);

  // Get the first window that the app opens, wait if necessary.
  const window = await electronApp.firstWindow();
  // Print the title.
  console.log(await window.title());
  // Capture a screenshot.
  await window.screenshot({ path: 'intro.png' });
  // Direct Electron console to Node terminal.
  window.on('console', console.log);
  // Click button.
  await window.click('text=Click me');
  // Exit app.
  await electronApp.close();
})();
```

**Supported Electron versions are:**
* v12.2.0+
* v13.4.0+
* v14+

**Known issues:**

If you are not able to launch Electron and it will end up in timeouts during launch, try the following:

* Ensure that `nodeCliInspect` ([FuseV1Options.EnableNodeCliInspectArguments](https://www.electronjs.org/docs/latest/tutorial/fuses#nodecliinspect)) fuse is **not** set to `false`.

**Migrating from v1.59**

A number of launch options have been removed after v1.59. See below for alternatives.

* `recordHar` - use [`method: Tracing.startHar`].
  ```js
  const electronApp = await electron.launch({ args: ['main.js'] });
  await electronApp.context().tracing.startHar('network.har');
  // ... drive the app ...
  await electronApp.context().tracing.stopHar();
  await electronApp.close();
  ```

* `recordVideo` - use [`method: Screencast.start`] on each window.
  ```js
  const electronApp = await electron.launch({ args: ['main.js'] });
  const window = await electronApp.firstWindow();
  await window.screencast.start({ path: 'video.webm' });
  // ... drive the window ...
  await window.screencast.stop();
  await electronApp.close();
  ```

* `colorScheme` - use [`method: Page.emulateMedia`] on each window.
  ```js
  const window = await electronApp.firstWindow();
  await window.emulateMedia({ colorScheme: 'dark' });
  ```

* `extraHTTPHeaders` - use [`method: BrowserContext.setExtraHTTPHeaders`].
  ```js
  await electronApp.context().setExtraHTTPHeaders({ 'X-My-Header': 'value' });
  ```

* `geolocation` - use [`method: BrowserContext.setGeolocation`].
  ```js
  await electronApp.context().setGeolocation({ latitude: 48.858455, longitude: 2.294474 });
  ```

* `httpCredentials` - use [`method: BrowserContext.setHTTPCredentials`].
  ```js
  await electronApp.context().setHTTPCredentials({ username: 'user', password: 'pass' });
  ```

* `offline` - use [`method: BrowserContext.setOffline`].
  ```js
  await electronApp.context().setOffline(true);
  ```

* `bypassCSP` - disable CSP at the `BrowserWindow` level via Electron's [web preferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences). Note that `webSecurity: false` also disables CORS and the Same-Origin Policy.

  ```js
  const win = new BrowserWindow({
    webPreferences: {
      webSecurity: false,
    },
  });
  ```

* `ignoreHTTPSErrors`

  There are several ways to relax HTTPS checks in Electron. Pick the one that matches the scope you need.

  Per-window, allow mixed content through [web preferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences):

  ```js
  const win = new BrowserWindow({
    webPreferences: {
      allowRunningInsecureContent: true,
    },
  });
  ```

  Process-wide, ignore certificate errors via Chromium command-line switches
  (must run before the `ready` event):

  ```js
  const { app } = require('electron');
  app.commandLine.appendSwitch('ignore-certificate-errors');
  // Optional: also ignore localhost certificate errors when testing on an IP.
  app.commandLine.appendSwitch('allow-insecure-localhost', 'true');
  ```

  Per-request, accept the certificate manually via the
  [`certificate-error`](https://www.electronjs.org/docs/latest/api/app#event-certificate-error)
  event:

  ```js
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
  });
  ```

* `timezoneId` - set an environment variable at the very top of the main file, before any other logic or Chromium windows are initialized.
  ```js
  // main.js
  process.env.TZ = 'Europe/London';

  const { app } = require('electron');
  // ... rest of your app logic
  ```

## async method: Electron.launch
* since: v1.9
- returns: <[ElectronApplication]>

Launches electron application specified with the [`option: executablePath`].

### option: Electron.launch.executablePath
* since: v1.9
- `executablePath` <[string]>

Launches given Electron application. If not specified, launches the default Electron
executable installed in this package, located at `node_modules/.bin/electron`.

### option: Electron.launch.args
* since: v1.9
- `args` <[Array]<[string]>>

Additional arguments to pass to the application when launching. You typically pass the main
script name here.

### option: Electron.launch.cwd
* since: v1.9
- `cwd` <[string]>

Current working directory to launch application from.

### option: Electron.launch.env
* since: v1.9
- `env` <[Object]<[string], [string]>>

Specifies environment variables that will be visible to Electron. Defaults to `process.env`.

### option: Electron.launch.timeout
* since: v1.15
- `timeout` <[float]>

Maximum time in milliseconds to wait for the application to start. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.

### option: Electron.launch.chromiumSandbox = %%-browser-option-chromiumsandbox-%%
* since: v1.59
