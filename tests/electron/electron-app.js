const { app, protocol } = require('electron');
const path = require('path');

// Test using pre-ready apis.
protocol.registerSchemesAsPrivileged([]);

app.on('window-all-closed', e => e.preventDefault());

app.whenReady().then(() => {
  protocol.registerFileProtocol('vscode-file', (request, callback) => {
    const url = request.url.substring('vscode-file'.length + 3);
    callback({ path: path.join(__dirname, 'assets', url) });
  });
});
