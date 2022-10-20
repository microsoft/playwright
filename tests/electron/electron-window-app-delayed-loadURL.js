const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });
  setTimeout(() => {
    win.loadURL('data:text/html,<h1>Foobar</h1>');
  }, 2_000);
})

app.on('window-all-closed', e => e.preventDefault());
