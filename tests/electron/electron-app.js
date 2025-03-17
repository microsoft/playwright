const assert = require('node:assert/strict');
const { app, protocol } = require('electron');
const path = require('path');

assert(process.argv.length > 0, 'No arguments provided. First argument needs to be a userDataDir.');
app.setPath('appData', process.argv[2]);

app.on('window-all-closed', e => e.preventDefault());

app.whenReady().then(() => {
  protocol.registerFileProtocol('vscode-file', (request, callback) => {
    const url = request.url.substring('vscode-file'.length + 3);
    callback({ path: path.join(__dirname, 'assets', url) });
  });
});
