# class: Electron
* langs: js

Playwright has **experimental** support for Electron automation. You can access electron namespace via:

```js
const { _electron } = require('playwright');
```

An example of the Electron automation script would be:

```js
const { _electron: electron } = require('playwright');

(async () => {
  // Launch Electron app.
  const electronApp = await electron.launch({ args: ['main.js'] });

  // Evaluation expression in the Electron context.
  const appPath = await electronApp.evaluate(async (electron) => {
    // This runs in the main Electron process, |electron| parameter
    // here is always the result of the require('electron') in the main
    // app script.
    return electron.getAppPath();
  });

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
})();
```

Note that since you don't need Playwright to install web browsers when testing Electron, you can omit browser download via setting the following environment variable when installing Playwright:

```sh js
$ PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i -D playwright
```

## async method: Electron.launch
- returns: <[ElectronApplication]>

Launches electron application specified with the [`option: executablePath`].

### option: Electron.launch.executablePath
- `executablePath` <[string]>

Launches given Electron application. If not specified, launches the default Electron
executable installed in this package, located at `node_modules/.bin/electron`.

### option: Electron.launch.args
- `args` <[Array]<[string]>>

Additional arguments to pass to the application when launching. You typically pass the main
script name here.

### option: Electron.launch.cwd
- `cwd` <[string]>

Current working directory to launch application from.

### option: Electron.launch.env
- `env` <[Object]<[string], [string]>>

Specifies environment variables that will be visible to Electron. Defaults to `process.env`.

#### option: Electron.launch.timeout
- `timeout` <[float]>

Maximum time in milliseconds to wait for the application to start. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
