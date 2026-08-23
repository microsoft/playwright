/**
 * Example 35: Automation Evasion via InitScript
 * 
 * This script demonstrates the mechanics of `page.addInitScript()` for bot 
 * evasion / browser fingerprinting modification.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch(); // Note: ignoreDefaultArgs: ['--enable-automation'] does nothing because Playwright never injects that flag to begin with.
  const context = await browser.newContext();
  const page = await context.newPage();

  // Playwright implements `addInitScript` under the hood by issuing the V8/CDP 
  // command `Page.addScriptToEvaluateOnNewDocument`.
  // Because V8 guarantees this command fires instantly upon a new document 
  // instantiation—before the DOM is even populated and before ANY inline or 
  // external scripts are fetched—it is structurally guaranteed to execute 
  // before the target website's anti-bot scripts can run.
  await page.addInitScript(() => {
    // Override the navigator.webdriver property safely
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined
    });
    
    // This script will execute on the initial navigation, and re-execute 
    // seamlessly across every subsequent navigation or iframe creation.
  });

  await page.goto('https://example.com');
  await browser.close();
})();
