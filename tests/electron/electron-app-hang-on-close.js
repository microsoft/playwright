const assert = require('node:assert/strict');
const { app } = require('electron');

assert(process.env.PWTEST_ELECTRON_USER_DATA_DIR, 'PWTEST_ELECTRON_USER_DATA_DIR env var is not set');
app.setPath('appData', process.env.PWTEST_ELECTRON_USER_DATA_DIR);

app.on('window-all-closed', e => e.preventDefault());

// Prevent quit — simulates an app that hangs on close
// (e.g. due to IPC handlers, child processes, or beforeunload).
app.on('before-quit', e => {
  e.preventDefault();
});
