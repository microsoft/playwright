const assert = require('node:assert/strict');
const { app } = require('electron');

assert(process.env.PWTEST_ELECTRON_USER_DATA_DIR, 'PWTEST_ELECTRON_USER_DATA_DIR env var is not set');
app.setPath('appData', process.env.PWTEST_ELECTRON_USER_DATA_DIR);

app.on('window-all-closed', e => e.preventDefault());

// Prevent the app from quitting gracefully to simulate a hung Electron app
// that requires force-kill escalation.
app.on('before-quit', e => e.preventDefault());

// Keep the event loop busy so the process never exits on its own.
setInterval(() => {}, 1000);
