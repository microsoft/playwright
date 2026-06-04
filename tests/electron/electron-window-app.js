const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: { sandbox: true },
  });
  win.loadURL('about:blank');
})

app.on('window-all-closed', e => e.preventDefault());
