// Demonstrates the migration paths from removed launch options to
// built-in Electron APIs. Behavior is configured via PWTEST_OPTION_* env vars.

if (process.env.PWTEST_OPTION_TZ)
  process.env.TZ = process.env.PWTEST_OPTION_TZ;

const { app, BrowserWindow } = require('electron');

if (!process.env.PWTEST_ELECTRON_USER_DATA_DIR)
  throw new Error('PWTEST_ELECTRON_USER_DATA_DIR env var is not set');
app.setPath('appData', process.env.PWTEST_ELECTRON_USER_DATA_DIR);

if (process.env.PWTEST_OPTION_IGNORE_HTTPS_ERRORS)
  app.commandLine.appendSwitch('ignore-certificate-errors');

app.on('window-all-closed', e => e.preventDefault());

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 800, height: 600 });
  win.loadURL('about:blank');
});
