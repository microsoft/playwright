> **BEWARE** This package is **EXPERIMENTAL** and does not respect semver.

```js
import { electron } from '@playwright/experimental-electron';

const electronApp = await electron.launch({ args: ['main.js'] });
const window = await electronApp.firstWindow();
// ... drive `window` like any Playwright Page ...
await electronApp.close();
```

Read more at https://playwright.dev/docs/api/class-electron.

## Migrating from v1.59

Prior to v1.60, the Electron API shipped as `playwright._electron` from the
`playwright` package. It is now exposed as `electron` from this dedicated
package.

A number of `electron.launch(...)` options have changed in the process. The sections below describe how to achieve
the same behavior with public Playwright APIs, or with built-in Electron APIs.

### Use Playwright APIs after launch

#### `recordHar`

Use [`browserContext.tracing.startHar`](https://playwright.dev/docs/api/class-tracing#tracing-start-har) /
[`stopHar`](https://playwright.dev/docs/api/class-tracing#tracing-stop-har).

```js
const electronApp = await electron.launch({ args: ['main.js'] });
await electronApp.context().tracing.startHar('network.har');
// ... drive the app ...
await electronApp.context().tracing.stopHar();
await electronApp.close();
```

#### `recordVideo`

Use [`page.screencast.start`](https://playwright.dev/docs/api/class-page#page-screencast) /
[`stop`](https://playwright.dev/docs/api/class-page#page-screencast) on each window.

```js
const electronApp = await electron.launch({ args: ['main.js'] });
const window = await electronApp.firstWindow();
await window.screencast.start({ path: 'video.webm' });
// ... drive the window ...
await window.screencast.stop();
await electronApp.close();
```

#### `colorScheme`

Use [`page.emulateMedia`](https://playwright.dev/docs/api/class-page#page-emulate-media)
on each window.

```js
const window = await electronApp.firstWindow();
await window.emulateMedia({ colorScheme: 'dark' });
```

#### `extraHTTPHeaders`

Use [`browserContext.setExtraHTTPHeaders`](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-extra-http-headers).

```js
await electronApp.context().setExtraHTTPHeaders({ 'X-My-Header': 'value' });
```

#### `geolocation`

Use [`browserContext.setGeolocation`](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-geolocation).

```js
await electronApp.context().setGeolocation({ latitude: 48.858455, longitude: 2.294474 });
```

#### `httpCredentials`

Use [`browserContext.setHTTPCredentials`](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-http-credentials).

```js
await electronApp.context().setHTTPCredentials({ username: 'user', password: 'pass' });
```

#### `offline`

Use [`browserContext.setOffline`](https://playwright.dev/docs/api/class-browsercontext#browser-context-set-offline).

```js
await electronApp.context().setOffline(true);
```

### Use built-in Electron APIs

#### `bypassCSP`

Disable CSP at the `BrowserWindow` level via Electron's
[web preferences](https://www.electronjs.org/docs/latest/api/structures/web-preferences).
Note that `webSecurity: false` also disables CORS and the Same-Origin Policy.

```js
const win = new BrowserWindow({
  webPreferences: {
    webSecurity: false,
  },
});
```

#### `ignoreHTTPSErrors`

There are several ways to relax HTTPS checks in Electron. Pick the one that
matches the scope you need.

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

#### `timezoneId`

Set an environment variable at the very top of the main file, before any other logic or Chromium windows are initialized:

```js
// main.js
process.env.TZ = 'Europe/London';

const { app } = require('electron');
// ... rest of your app logic
```
