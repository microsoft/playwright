const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to example.com...');
  await page.goto('https://example.com');

  console.log('Programmatically pausing execution. The Inspector UI will open.');
  console.log('Script is blocked on this line until you click "Resume" or "Close".');
  
  // 1. page.pause() temporarily clears timeouts and sends a pause channel message.
  // 2. Debugger.onBeforeCall intercepts it on the server and creates an unresolved promise.
  // 3. BrowserContext emits PausedStateChanged, launching RecorderApp in a separate context.
  await page.pause();

  // 4. When the user clicks "Resume" (triggering __pw_resume binding or dispatcher.doResume)
  //    or clicks the native window "Close" button (triggering the 'close' event in recorderApp.ts),
  //    Debugger.resume() is called, resolving the promise.
  // 5. The inspected browser and context remain ALIVE and execution continues here.
  console.log('Execution resumed! The inspected browser context was NOT closed.');

  console.log('Continuing script execution normally...');
  await page.setContent('<h1>Execution Continued!</h1>');
  
  await browser.close();
})();
