# playwright-electron
This package contains the [Electron](https://www.electronjs.org/) flavor of [Playwright](http://github.com/microsoft/playwright).

## How to demo

```bash
npm i --save-dev electron@beta
npm i --save-dev playwright-electron@next
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
    // Before each test close Electron application.
    await this.app.close();
  });

  it('sanity checks', async () => {
    // Wait for the first window to appear.
    const window = await this.app.firstWindow();

    // Assert window title.
    assert.equal(await window.title(), 'Hello World!');

    // Capture window screenshot.
    await window.screenshot({ path: 'intro.png' });

    // Collect console logs.
    let consoleText;
    window.on('console', message => consoleText = message.text());

    // Click button.
    await window.click('text=Click me');

    // Check that click produced console message.
    assert.equal(consoleText, 'click');
  });
});
```