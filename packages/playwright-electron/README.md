# playwright-electron
This package contains the [Electron](https://www.electronjs.org/) flavor of [Playwright](http://github.com/microsoft/playwright).

## How to demo

```bash
npm i --save-dev electron@beta playwright-electron
npx mocha
```


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
    this.app = await electron.launch(electronPath, {
      path: electronPath,
      args: [path.join(__dirname, '..')]  // loads index.js
    });
  });

  afterEach(async () => {
    // After each test close Electron application.
    await this.app.close();
  });

  it('script application', async () => {
    const appPath = await this.app.evaluate(async ({ app }) => {
      // This runs in the main Electron process, first parameter is
      // the result of the require('electron') in the main app script.
      return app.getAppPath();
    });
    assert.equal(appPath, path.join(__dirname, '..'));
  });

  it('window title', async () => {
    // Return value of this.app.firstWindow a Playwright Page.
    // See https://playwright.dev/#path=docs%2Fapi.md&q=class-page.

    // Get a Playwright page for the first Electron window.
    // It awaits for the page to be available. Alternatively use 
    // this.app.windows() or this.app.waitForEvent('window').
    const page = await this.app.firstWindow();
    assert.equal(await page.title(), 'Hello World!');
  });

  it('capture screenshot', async () => {
    const page = await this.app.firstWindow();

    // Capture window screenshot.
    await page.screenshot({ path: 'intro.png' });
  });

  it('sniff console', async () => {
    const page = await this.app.firstWindow();

    // Collect console logs.
    let consoleText;
    page.on('console', message => consoleText = message.text());

    // Click button.
    await page.click('text=Click me');

    // Check that click produced console message.
    assert.equal(consoleText, 'click');
  });

  it('intercept network', async () => {
    await this.app.firstWindow();

    // Return value of this.app.context() is a Playwright BrowserContext.
    // See https://playwright.dev/#path=docs%2Fapi.md&q=class-browsercontext.

    await await this.app.context().route('**/empty.html', (route, request) => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<title>Hello World</title>',
      })
    });

    // Helper method to create BrowserWindow.
    const page = await this.app.newBrowserWindow({ width: 800, height: 600 });
    await page.goto('https://localhost:1000/empty.html');

    assert.equal(await page.title(), 'Hello World');
  });

  it('should maximize window', async () => {
    await this.app.firstWindow();

    const page = await this.app.newBrowserWindow({ width: 800, height: 600 });
    // page.browserWindow is a Playwright JSHandle pointing at Electron's
    // BrowserWindow.
    // https://playwright.dev/#path=docs%2Fapi.md&q=class-jshandle
    await page.browserWindow.evaluate(browserWindow => browserWindow.maximize());
  });

});
```
