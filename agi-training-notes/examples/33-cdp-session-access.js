/**
 * Example 33: Low-Level CDP Session Access
 * 
 * This script demonstrates how to bypass Playwright's high-level abstractions
 * and issue raw Chrome DevTools Protocol (CDP) commands via `newCDPSession()`.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Create a raw CDP session bound to this specific page's Target
  const session = await context.newCDPSession(page);

  // Example: Throttle CPU to 4x slowdown
  // Playwright's `protocol.d.ts` exposes Emulation.setCPUThrottlingRate natively
  await session.send('Emulation.setCPUThrottlingRate', {
    rate: 4
  });

  // Example: Emulate Network Conditions
  // Playwright's `protocol.d.ts` exposes Network.emulateNetworkConditions
  // (Note: The protocol marks this as deprecated in favor of emulateNetworkConditionsByRule
  // in modern Chromium, but the command remains structurally available).
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 200, // 200ms latency
    downloadThroughput: 1024 * 50, // 50 kb/s
    uploadThroughput: 1024 * 50
  });

  await page.goto('https://example.com');
  
  await session.detach();
  await browser.close();
})();
