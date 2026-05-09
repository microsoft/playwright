# class: ElectronApplication
* since: v1.9
* langs: js

Electron application representation. You can use [`method: Electron.launch`] to
obtain the application instance. This instance you can control main electron process
as well as work with Electron windows:

```js
const { _electron: electron } = require('playwright');

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

## event: ElectronApplication.close
* since: v1.9

This event is issued when the application process has been terminated.

## event: ElectronApplication.console
* since: v1.42
- argument: <[ConsoleMessage]>

Emitted when JavaScript within the Electron main process calls one of console API methods, e.g. `console.log` or `console.dir`.

The arguments passed into `console.log` are available on the [ConsoleMessage] event handler argument.

**Usage**

```js
electronApp.on('console', async msg => {
  const values = [];
  for (const arg of msg.args())
    values.push(await arg.jsonValue());
  console.log(...values);
});
await electronApp.evaluate(() => console.log('hello', 5, { foo: 'bar' }));
```

## event: ElectronApplication.window
* since: v1.9
- argument: <[Page]>

This event is issued for every window that is created **and loaded** in Electron. It contains a [Page] that can
be used for Playwright automation.

## async method: ElectronApplication.browserWindow
* since: v1.11
- returns: <[JSHandle]>

Returns the BrowserWindow object that corresponds to the given Playwright page.

### param: ElectronApplication.browserWindow.page
* since: v1.11
- `page` <[Page]>

Page to retrieve the window for.

## async method: ElectronApplication.close
* since: v1.9

Closes Electron application.

## method: ElectronApplication.context
* since: v1.9
- returns: <[BrowserContext]>

This method returns browser context that can be used for setting up context-wide routing, etc.

## async method: ElectronApplication.evaluate
* since: v1.9
- returns: <[Serializable]>

Returns the return value of [`param: expression`].

If the function passed to the [`method: ElectronApplication.evaluate`] returns a [Promise], then
[`method: ElectronApplication.evaluate`] would wait for the promise to resolve and return its value.

If the function passed to the [`method: ElectronApplication.evaluate`] returns a non-[Serializable] value, then
[`method: ElectronApplication.evaluate`] returns `undefined`. Playwright also supports transferring
some additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`.

### param: ElectronApplication.evaluate.expression = %%-evaluate-expression-%%
* since: v1.9

### param: ElectronApplication.evaluate.expression = %%-js-electron-evaluate-workerfunction-%%
* since: v1.9

### param: ElectronApplication.evaluate.arg
* since: v1.9
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: ElectronApplication.evaluateHandle
* since: v1.9
- returns: <[JSHandle]>

Returns the return value of [`param: expression`] as a [JSHandle].

The only difference between [`method: ElectronApplication.evaluate`] and [`method: ElectronApplication.evaluateHandle`] is that [`method: ElectronApplication.evaluateHandle`] returns [JSHandle].

If the function passed to the [`method: ElectronApplication.evaluateHandle`] returns a [Promise], then
[`method: ElectronApplication.evaluateHandle`] would wait for the promise to resolve and return its value.

### param: ElectronApplication.evaluateHandle.expression = %%-evaluate-expression-%%
* since: v1.9

### param: ElectronApplication.evaluateHandle.expression = %%-js-electron-evaluate-workerfunction-%%
* since: v1.9

### param: ElectronApplication.evaluateHandle.arg
* since: v1.9
- `arg` ?<[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: ElectronApplication.firstWindow
* since: v1.9
- returns: <[Page]>

Convenience method that waits for the first application window to be opened.

**Usage**

```js
const electronApp = await electron.launch({
  args: ['main.js']
});
const window = await electronApp.firstWindow();
// ...
```

### option: ElectronApplication.firstWindow.timeout
* since: v1.33
- `timeout` ?<[float]>

Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds).
Pass `0` to disable timeout. The default value can be changed by using the
[`method: BrowserContext.setDefaultTimeout`].

## method: ElectronApplication.process
* since: v1.21
- returns: <[ChildProcess]>

Returns the main process for this Electron Application.

## async method: ElectronApplication.waitForEvent
* since: v1.9
- returns: <[any]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy value. Will throw an error if the application is closed before the event is fired. Returns the event data value.

**Usage**

```js
const windowPromise = electronApp.waitForEvent('window');
await mainWindow.click('button');
const window = await windowPromise;
```

### param: ElectronApplication.waitForEvent.event = %%-wait-for-event-event-%%
* since: v1.9

### param: ElectronApplication.waitForEvent.optionsOrPredicate
* since: v1.9
* langs: js
- `optionsOrPredicate` ?<[function]|[Object]>
  - `predicate` <[function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` ?<[float]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to
    disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

## method: ElectronApplication.windows
* since: v1.9
- returns: <[Array]<[Page]>>

Convenience method that returns all the opened windows.
