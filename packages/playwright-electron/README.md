# playwright-electron
This package contains the [Electron](https://www.electronjs.org/) flavor of [Playwright](http://github.com/microsoft/playwright).

## How to demo

```bash
npm i --save-dev electron@beta playwright-electron
npx mocha
```

## Starting Electron

```js
const path = require('path');
const { electron  } = require('playwright-electron');

(async() => {
  // Compute path to the executable.
  const electronName = process.platform === 'win32' ? 'electron.cmd' : 'electron';
  const electronPath = path.join(__dirname, 'node_modules', '.bin', electronName);

  // Launch electron and point it to the Electron application.
  const application = await electron.launch(electronPath, {
    args: [path.join(__dirname, 'index.js')]
  });
})();
```

## Evaluating on the `app` object

Playwright runs out of Electron process, so it can't script Electron objects. It instead offers a standard Playwright `evaluate` utility and the concept of object handles. Learn more about execution contexts [here](https://github.com/microsoft/playwright/blob/master/docs/core-concepts.md#nodejs-and-browser-execution-contexts).

```js
const appPath = await application.evaluate(async ({ app }) => {
  // This runs in the main Electron process, first parameter is
  // the result of the require('electron') in the main app script.
  return app.getAppPath();
});
assert.equal(appPath, path.join(__dirname, '..'));
```

## Awaiting the window that Electron application opens

```js
const page = await application.firstWindow();
assert.equal(await page.title(), 'Hello World!');
```

## Automating the BrowserWindow

Electron `BrowserWindows` are represented with Playwright [pages](https://github.com/microsoft/playwright/blob/master/docs/core-concepts.md#pages-and-frames). You can automate them, capture screenshots, intercept network, etc., as if it was a regular Playwright web page. Here is an example of capturing the screenshot:

```js
const page = await application.firstWindow();
await page.screenshot({ path: 'intro.png' });
```

## Sniffing console

You can subscribe to the console events in the `BrowserWindow` and in the Electron application like this:

```js
application.on('console', console.log);
const page = await application.firstWindow();
page.on('console', console.log);
```

## Working with menu items

You can retrieve handles to the menu items, query and click them like this:

```js
// Obtain a handle on the menu item.
const menuHandle = await application.findMenuItem({ label: 'Print' });
// Print menu item label.
console.log(await menuHandle.label());
// Click menu item:
await menuHandle.click();
```

## Complete test example

`index.js` - main Electron application file.
```js
const { app, BrowserWindow } = require('electron');

function createWindow () {
  let win = new BrowserWindow({
    width: 800,
    height: 600,
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);
```

`index.html` - page that Electron opens in a BrowserWindow.
```js
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Hello World!</title>
    <meta http-equiv="Content-Security-Policy" content="script-src 'self' 'unsafe-inline';" />
    <style>
      html {
        width: 100%;
        height: 100%;
        display: flex;
        background: white;
      }

      body {
        flex: auto;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-direction: column;
      }
    </style>
  </head>
  <body>
    <h1>Hello World!</h1>
    <button onclick="console.log('click')">Click me</button>
  </body>
</html>
```

`test/spec.js` - test file
```js
const { electron  } = require('playwright-electron');
const assert = require('assert');
const electronPath = require('electron');
const path = require('path')

describe('Sanity checks', function () {
  this.timeout(10000);

  beforeEach(async () => {
    // Before each test start Electron application.
    this.application = await electron.launch(electronPath, {
      args: [path.join(__dirname, '..')]  // loads index.js
    });
  });

  afterEach(async () => {
    // After each test close Electron application.
    await this.application.close();
  });

  it('script application', async () => {
    const appPath = await this.application.evaluate(async ({ app }) => {
      // This runs in the main Electron process, first parameter is
      // the result of the require('electron') in the main app script.
      return app.getAppPath();
    });
    assert.equal(appPath, path.join(__dirname, '..'));
  });

  it('window title', async () => {
    // Return value of this.application.firstWindow a Playwright Page.
    // See https://playwright.dev/#path=docs%2Fapi.md&q=class-page.

    // Get a Playwright page for the first Electron window.
    // It awaits for the page to be available. Alternatively use 
    // this.application.windows() or this.application.waitForEvent('window').
    const page = await this.application.firstWindow();
    assert.equal(await page.title(), 'Hello World!');
  });

  it('capture screenshot', async () => {
    const page = await this.application.firstWindow();

    // Capture window screenshot.
    await page.screenshot({ path: 'intro.png' });
  });

  it('sniff console', async () => {
    const page = await this.application.firstWindow();

    // Collect console logs.
    let consoleText;
    page.on('console', message => consoleText = message.text());

    // Click button.
    await page.click('text=Click me');

    // Check that click produced console message.
    assert.equal(consoleText, 'click');
  });

  it('intercept network', async () => {
    await this.application.firstWindow();

    // Return value of this.application.context() is a Playwright BrowserContext.
    // See https://playwright.dev/#path=docs%2Fapi.md&q=class-browsercontext.

    await await this.application.context().route('**/empty.html', (route, request) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<title>Hello World</title>',
      })
    });

    // Helper method to create BrowserWindow.
    const page = await this.application.newBrowserWindow({ width: 800, height: 600 });
    await page.goto('https://localhost:1000/empty.html');

    assert.equal(await page.title(), 'Hello World');
  });

  it('should maximize window', async () => {
    await this.application.firstWindow();

    const page = await this.application.newBrowserWindow({ width: 800, height: 600 });
    // page.browserWindow is a Playwright JSHandle pointing at Electron's
    // BrowserWindow.
    // https://playwright.dev/#path=docs%2Fapi.md&q=class-jshandle
    await page.browserWindow.evaluate(browserWindow => browserWindow.maximize());
  });

});
```
