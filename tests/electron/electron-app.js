const assert = require('node:assert/strict');
const { app, protocol, BrowserWindow } = require('electron');
const path = require('path');

assert(process.env.PWTEST_ELECTRON_USER_DATA_DIR, 'PWTEST_ELECTRON_USER_DATA_DIR env var is not set');
app.setPath('appData', process.env.PWTEST_ELECTRON_USER_DATA_DIR);

app.on('window-all-closed', e => e.preventDefault());

app.whenReady().then(() => {
  protocol.registerFileProtocol('vscode-file', (request, callback) => {
    const url = request.url.substring('vscode-file'.length + 3);
    callback({ path: path.join(__dirname, 'assets', url) });
  });
  // Sandboxed windows share process with their window.open() children
  // and can script them. We use that heavily in our tests.
  const window = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { sandbox: true },
  });
  window.loadURL('about:blank');
});
