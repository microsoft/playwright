const { _electron: electron } = require('playwright');

(async () => {
  // Launch Electron app.
  const electronApp = await electron.launch({ args: ['/home/yurys/electron-multi-webcontents/dist/main.js'] });

  console.log('electronApp launched\n\n\n');

  electronApp.on('window', (window) => {
    console.log('window opened:', window.url());
  });

  const pages = electronApp.windows();
  for (const page of pages)
    console.log('page:', page.url());

  // Evaluation expression in the Electron context.
  const appPath = await electronApp.evaluate(async ({ app }) => {
    // This runs in the main Electron process, parameter here is always
    // the result of the require('electron') in the main app script.
    return app.getAppPath();
  });
  console.log(appPath);

  // Get the first window that the app opens, wait if necessary.
  const window = await electronApp.firstWindow();
  // Print the title.
  console.log(await window.title());

  let i = 0;
  for (const page of electronApp.windows()) {
    console.log('page:', page.url());
    await page.screenshot({ path: `intro-${i}.png` });
    console.log(`screenshot saved to intro-${i}.png`);
    i++;
  }
})();
