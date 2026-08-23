/**
 * Example 29: Emulation Scope
 * 
 * This script illustrates that emulation parameters like viewport, offline mode,
 * geolocation, and userAgent are inherently bound to the BrowserContext.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  
  // Emulation is defined globally for all pages residing within this context.
  // It is captured in the BrowserContextOptions interface.
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, // Emulate Mobile Viewport
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X)',
    geolocation: { longitude: 48.858455, latitude: 2.294474 }, // Paris
    offline: true, // Emulate no network connectivity
    permissions: ['geolocation']
  });

  const page1 = await context.newPage();
  const page2 = await context.newPage();

  // Both page1 and page2 share the exact same emulated characteristics.
  await page1.goto('https://example.com').catch(() => {}); // Will fail due to offline
  await page2.goto('https://example.com').catch(() => {}); // Will fail due to offline

  await browser.close();
})();
