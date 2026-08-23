/**
 * Example 16: Page Load Detection & Lifecycle
 * 
 * This script demonstrates how Playwright tracks various lifecycle events
 * (such as load, domcontentloaded, and networkidle), as well as
 * tracking visual stability (fonts and animations) vs data readiness (responses).
 * 
 * Note: This is a standalone, well-commented example for documentation
 * purposes only and is not meant to be executed directly in this environment.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Frame Lifecycle Events
  // Calling page.goto inherently waits for the 'load' lifecycle event by default.
  // The 'load' event is dispatched by the FrameManager when the frame completes its load.
  await page.goto('https://example.com');

  // Alternatively, you can wait for 'networkidle'.
  // Under the hood, this requires the frame's _inflightRequests.size to be exactly 0
  // for at least 500 milliseconds, tracked by a setTimeout inside frames.ts.
  await page.waitForLoadState('networkidle');

  // 2. Data Readiness
  // You can wait for a specific network response, bypassing frame lifecycle events entirely.
  // This taps into Events.Page.Response, tracked directly by the client's Page object.
  const responsePromise = page.waitForResponse(response => {
    return response.url().includes('/api/data') && response.status() === 200;
  });
  await page.evaluate(() => fetch('/api/data')); // trigger the request
  const response = await responsePromise;
  console.log(`Received data from ${response.url()}`);

  // 3. Visual Stability (Screenshot)
  // When capturing a screenshot, Playwright automatically checks visual stability.
  // By passing `animations: 'disabled'`, it injects CSS to stop transitions/animations.
  // It also implicitly evaluates `document.fonts.ready` in the utility world to ensure
  // typography is fully resolved before snapping the image.
  await page.screenshot({
    path: 'stable-screenshot.png',
    animations: 'disabled'
  });

  await browser.close();
})();
