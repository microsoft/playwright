const { app } = require('electron');

globalThis.__playwrightLog = [];

globalThis.__playwrightLog.push(`isReady == ${app.isReady()}`);
app.whenReady().then(() => {
  globalThis.__playwrightLog.push(`whenReady resolved`);
  globalThis.__playwrightLog.push(`isReady == ${app.isReady()}`);
});

app.on('will-finish-launching', () => globalThis.__playwrightLog.push('will-finish-launching fired'));
app.on('ready', () => globalThis.__playwrightLog.push('ready fired'));
