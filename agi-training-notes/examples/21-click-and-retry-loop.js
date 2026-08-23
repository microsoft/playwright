/**
 * Example 21: "Click and Retry" Loop (Brute-Force Fallback)
 * 
 * This script demonstrates manually wrapping actions in a try/catch loop.
 * Playwright's built-in `locator.click()` already uses an internal 
 * `_retryPointerAction()` to poll for structural actionability (visible, stable, etc).
 * 
 * However, this manual loop is necessary when dealing with application-level
 * rejections (e.g., clicking triggers an error because the frontend state isn't ready)
 * or when bypassing standard actionability checks entirely using `{ force: true }`.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

// Example 100ms retry delay. This is a design choice, NOT a Playwright default.
const RETRY_DELAY_MS = 100;

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://example.com/dashboard');

  const dropdownBtn = page.locator('#open-dropdown-btn');
  let success = false;
  let attempts = 0;

  // The custom retry loop
  while (!success && attempts < 50) { // arbitrary max 50 attempts = ~5 seconds
    try {
      attempts++;
      
      // We use force: true to bypass Playwright's structural actionability checks.
      // Or we could be executing a custom page.evaluate() script that throws
      // an application-level error if the dropdown's internal data structure isn't ready.
      await dropdownBtn.click({ force: true, timeout: 50 });
      
      // If we reach here, the click succeeded without throwing an error
      success = true;
    } catch (e) {
      // The action failed (e.g., the element was detached mid-click, or a custom error was thrown)
      // We catch the error, wait 100ms (our chosen delay), and try again.
      await page.waitForTimeout(RETRY_DELAY_MS);
    }
  }

  if (!success) {
    throw new Error('Failed to click the dropdown button after multiple retries.');
  }

  console.log('Successfully brute-forced the interaction!');
  await browser.close();
})();
