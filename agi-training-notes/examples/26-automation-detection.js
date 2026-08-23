/**
 * Example 26: Automation Detection and navigator.webdriver
 * 
 * This script demonstrates the limits of Playwright's source code surface
 * regarding browser fingerprinting and automation detection.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  // A search through Playwright's TypeScript source code (like chromiumSwitches.ts
  // and chromium.ts) reveals that Playwright NEVER actively appends the 
  // '--enable-automation' flag to the arguments list.
  
  // However, launchApp.ts references it in an exclusion list:
  // ignoreDefaultArgs: ['--enable-automation']
  // 
  // This implies that '--enable-automation' is natively baked into the Chromium 
  // binary's default headless mode behavior, and Playwright does not manually 
  // inject it. 
  const browser = await chromium.launch({
    // If we wanted to ensure the flag was removed to reduce detection surface, 
    // we would explicitly ignore it here:
    ignoreDefaultArgs: ['--enable-automation']
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // Evaluate inside the page to check if navigator.webdriver is true
  const isWebdriver = await page.evaluate(() => navigator.webdriver);
  console.log(`Is navigator.webdriver true? ${isWebdriver}`);

  await browser.close();
})();
