/**
 * 01-launch-browser.js
 *
 * Demonstrates direct usage of playwright-core to launch and close a browser instance.
 *
 * Real source code references studied:
 * - Public API / Client side:
 *   - `packages/playwright-core/src/client/browserType.ts` -> `BrowserType.launch(options)`
 *     Wraps client-side launch options, creates channel request `this._channel.launch(...)`
 *     over Playwright RPC connection, and returns a `Browser` client instance.
 * - Server side dispatch & execution:
 *   - `packages/playwright-core/src/server/browserType.ts` -> `BrowserType.launch(progress, options, protocolLogger)`
 *     Validates options via `_validateLaunchOptions()`, prepares temporary user profile directory via
 *     `_prepareToLaunch()`, resolves browser binary using `registry.findExecutable(name)`,
 *     spawns child process via `launchProcess()`, and attaches protocol connection.
 * - Engine specific launcher:
 *   - `packages/playwright-core/src/server/chromium/chromium.ts` -> `Chromium.launch(...)`
 *     Connects to Chrome via CDP (Chrome DevTools Protocol) using `CRBrowser.connect()`.
 */

const { chromium, firefox, webkit } = require('playwright-core');

async function main() {
  // Launch Chromium browser in headless mode.
  // Under the hood, BrowserType.launch() sends an RPC channel request to the server,
  // which invokes registry.findExecutable('chromium') and spawns the browser process.
  const browser = await chromium.launch({
    headless: true, // default is true
    args: ['--no-sandbox'] // custom CLI flags passed to browser arguments array
  });

  console.log('Browser launched successfully. Is connected:', browser.isConnected());

  // Close the browser.
  // Calls Browser.close() in client/browser.ts -> sends RPC close message to BrowserDispatcher ->
  // closes transport and gracefully terminates the browser child process via BrowserProcess.close().
  await browser.close();
  console.log('Browser closed successfully.');
}

if (require.main === module) {
  main().catch(console.error);
}
