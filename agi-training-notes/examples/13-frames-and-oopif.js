/**
 * 13-frames-and-oopif.js
 *
 * Demonstrates Playwright's Frame tree hierarchy (mainFrame, childFrames), frame lifecycle events,
 * and how Playwright seamlessly interacts with cross-origin Out-Of-Process IFrames (OOPIF).
 *
 * Real source code references studied:
 * - Frame Hierarchy & Client API:
 *   - `packages/playwright-core/src/client/frame.ts` -> `Frame` class
 *     Methods: `childFrames()`, `parentFrame()`, `name()`, `url()`, `locator()`.
 *   - `packages/playwright-core/src/client/page.ts` -> `Page` class
 *     Properties: `page.mainFrame()`, `page.frames()`.
 *     Events: `frameattached`, `framenavigated`, `framedetached`.
 * - Server Frame Manager & Lifecycle:
 *   - `packages/playwright-core/src/server/frames.ts` -> `Frame` & `FrameManager` classes
 *     Tracks the frame tree structure (`_mainFrame`, `_childFrames`, `_parentFrame`).
 *     Emits lifecycle events (`Page.Events.FrameAttached`, `FrameNavigated`, `FrameDetached`).
 * - Cross-Origin IFrame (OOPIF) Handling:
 *   - `packages/playwright-core/src/server/chromium/crPage.ts` -> `_onAttachedToTarget()`
 *     Chromium isolates cross-origin iframes into separate renderer processes (OOPIF).
 *     Playwright enables auto-attach (`Target.setAutoAttach` with `flatten: true`).
 *     When a cross-origin iframe navigates, Chrome fires `Target.attachedToTarget` with type `'iframe'`.
 *     Playwright creates a child CDP session (`session.createChildSession()`) wrapped in a `FrameSession`,
 *     transparently unifying execution contexts while routing protocol commands to the target process.
 */

const { chromium } = require('playwright-core');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to frame lifecycle events on Page
  // Emitted by Page in client/page.ts when server FrameManager fires FrameAttached/FrameNavigated/FrameDetached
  page.on('frameattached', frame => {
    console.log(`[Event: frameattached] New frame created. URL: ${frame.url()}`);
  });

  page.on('framenavigated', frame => {
    console.log(`[Event: framenavigated] Frame navigated. Name: "${frame.name()}", URL: ${frame.url()}`);
  });

  page.on('framedetached', frame => {
    console.log(`[Event: framedetached] Frame detached. URL: ${frame.url()}`);
  });

  await page.goto('https://example.com');

  // Inspect frame tree
  const mainFrame = page.mainFrame(); // top-level frame (Frame in client/frame.ts)
  console.log('Main frame URL:', mainFrame.url());
  console.log('Child frames count:', mainFrame.childFrames().length);

  // Accessing elements inside iframes (same-origin or cross-origin OOPIF)
  // FrameLocator in client/locator.ts delegates selector queries into the target frame context,
  // regardless of whether the frame is in-process or out-of-process.
  const iframeButton = page.frameLocator('iframe#payment-frame').getByRole('button', { name: 'Pay Now' });

  console.log('FrameLocator constructed for iframe target.');
  console.log('Under the hood, if payment-frame is cross-origin, crPage.ts attaches a child CDP session');
  console.log('to route commands directly to the OOPIF renderer process.');

  await context.close();
  await browser.close();
}

if (require.main === module) {
  main().catch(console.error);
}
