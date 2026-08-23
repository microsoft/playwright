/**
 * Example 34: Chromium Code Coverage
 * 
 * This script demonstrates the Chromium-specific code coverage feature.
 * Backed by `crCoverage.ts`, Playwright exposes native V8 profiling APIs 
 * directly on the Page object.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Start coverage collection (Chromium only feature)
  // `resetOnNavigation` controls whether the accumulated coverage is cleared 
  // upon subsequent navigations.
  await page.coverage.startJSCoverage({ resetOnNavigation: false });
  await page.coverage.startCSSCoverage({ resetOnNavigation: false });

  await page.goto('https://example.com');
  
  // Wait for any dynamic scripts/styles to execute
  await page.waitForLoadState('networkidle');

  // Stop collection and retrieve the raw V8 coverage arrays
  const jsCoverage = await page.coverage.stopJSCoverage();
  const cssCoverage = await page.coverage.stopCSSCoverage();

  // Example: Log the URLs of every executed script
  for (const entry of jsCoverage) {
    console.log(`Executed Script URL: ${entry.url}`);
  }

  await browser.close();
})();
