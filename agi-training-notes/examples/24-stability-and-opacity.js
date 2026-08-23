/**
 * Example 24: Auto-Waiting "Stable" Check vs Opacity
 * 
 * This script illustrates a limitation in Playwright's actionability checks.
 * In `injectedScript.ts`, _checkElementIsStable() verifies stability by polling
 * `getBoundingClientRect()` across animation frames. It does NOT check CSS
 * opacity or computed visibility styles for transitions.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://example.com');

  // Assume #fade-in-btn is inserted into the DOM with opacity: 0
  // and slowly transitions to opacity: 1 over 2 seconds, but its bounding 
  // rect coordinates are static.
  
  // Playwright's click() waits for: Visible, Stable, Receives Events, Enabled.
  // Because its coordinates don't change, _checkElementIsStable() passes instantly.
  // Playwright may successfully fire a click event on the element while it is 
  // still completely invisible to the human eye!
  await page.locator('#fade-in-btn').click();

  // If you specifically need to wait for a CSS transition like opacity to finish,
  // you must use a custom waitForFunction instead of relying on built-in stability.
  await page.waitForFunction(() => {
    const btn = document.querySelector('#fade-in-btn');
    return window.getComputedStyle(btn).opacity === '1';
  });

  await browser.close();
})();
