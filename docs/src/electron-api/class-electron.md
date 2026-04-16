# class: Electron
* since: v1.9
* langs: js

Playwright supports Electron automation, shipped as a separate package:

```sh
npm i -D @playwright/electron
```

An example of the Electron automation script would be:

```js
import { electron } from '@playwright/electron';

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
