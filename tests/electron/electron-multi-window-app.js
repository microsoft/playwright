const { app, BrowserWindow } = require('electron');
const { join } = require('path');

let i = 0;

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  });
  win.loadFile(join(__dirname, 'electron-multi-window-app.html'), {
    query: { i: `${++i}` },
  });
};

const main = async () => {
  const hasLock = app.requestSingleInstanceLock();
  if (hasLock) {
    await app.whenReady();
    createWindow();
    app.on('second-instance', createWindow);
  } else {
    app.quit();
  }
};

main();
