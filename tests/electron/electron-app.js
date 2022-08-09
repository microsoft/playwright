const { app, protocol } = require('electron');
const path = require('path');

// PaintHolding - https://crbug.com/1322971
app.commandLine.appendSwitch('disable-features', 'PaintHolding,AutoExpandDetailsElement');

app.on('window-all-closed', e => e.preventDefault());

app.whenReady().then(() => {
  protocol.registerFileProtocol('vscode-file', (request, callback) => {
    const url = request.url.substring('vscode-file'.length + 3);
    callback({ path: path.join(__dirname, 'assets', url) });
  });
});
