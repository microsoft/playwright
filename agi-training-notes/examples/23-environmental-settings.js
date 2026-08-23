/**
 * Example 23: Default Environmental Settings
 * 
 * This script demonstrates explicitly overriding environmental settings 
 * that Playwright otherwise defaults behind the scenes.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();

  // If these options were omitted, Playwright's validateBrowserContextOptions
  // (in browserContext.ts) would enforce:
  // - viewport: { width: 1280, height: 720 }
  // - locale: 'en-US'
  // 
  // By contrast, timezoneId has no programmatic default fallback inside
  // Playwright. If omitted, Playwright avoids sending Emulation.setTimezoneOverride
  // and the browser inherits the underlying host machine's timezone natively.
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2, // Emulates a retina display (defaults to 1 if omitted)
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris' 
  });

  const page = await context.newPage();
  await page.goto('https://example.com');
  
  await browser.close();
})();
