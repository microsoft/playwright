const { chromium, webkit } = require('playwright');
const assert = require('assert');

/**
 * In this script, we will login on GitHub.com through Chromium,
 * and reuse login state inside WebKit. This recipe can be
 * used to speed up tests by logging in once and reusing login state.
 *
 * Steps summary
 * 1. Login on GitHub.com in Chromium
 * 2. Export storage state from Chromium browser context
 * 3. Set storage state in WebKit browser context and verify login
 */

const account = { login: '', password: '' };

(async () => {
  // Create a Chromium browser context
  const crBrowser = await chromium.launch();
  const crContext = await crBrowser.newContext();
  const crPage = await crContext.newPage();

  // Navigate and auto-wait on the page to load after navigation
  await crPage.goto('https://github.com/login');

  // Fill login form elements
  await crPage.fill('input[name="login"]', account.login);
  await crPage.fill('input[name="password"]', account.password);

  // Submit form and auto-wait for the navigation to complete
  await crPage.click('input[type="submit"]');
  await verifyIsLoggedIn(crPage);

  // Get storage state from Chromium browser context
  const storageState = await crContext.storageState();
  await crBrowser.close();

  // Create WebKit browser context with saved storage state
  const wkBrowser = await webkit.launch();
  const wkContext = await wkBrowser.newContext({ storageState });

  // Navigate to GitHub.com and verify that we are logged in
  const wkPage = await wkContext.newPage();
  await wkPage.goto('http://github.com');
  await wkPage.screenshot({ path: 'webkit.png' });
  await verifyIsLoggedIn(wkPage);
  await wkBrowser.close();
})();

const verifyIsLoggedIn = async (page) => {
  await page.click('summary[aria-label="View profile and more"]')
  assert(await page.waitForSelector(`text="Your profile"`));
}
