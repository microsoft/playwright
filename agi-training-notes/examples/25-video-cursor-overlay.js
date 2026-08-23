/**
 * Example 25: Cursor Visibility in Video Recordings
 * 
 * This script demonstrates the distinction between headless video recordings
 * and the "Screencast Annotation" overlay used by codegen/trace viewers.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  
  // Normal video recordings contain NO cursor by default. Playwright's interactions
  // are synthetic CDP `Input.dispatchMouseEvent` commands that do not drive
  // the host OS's mouse pointer.
  const context = await browser.newContext({
    recordVideo: {
      dir: 'videos/'
    }
  });

  const page = await context.newPage();
  await page.goto('https://example.com');

  // This click will happen, and the video will show the button reacting (e.g. 
  // active states or navigation), but NO mouse cursor will travel across the screen.
  await page.locator('button').click();

  // If you see a cursor in a Playwright Trace Viewer or Codegen session,
  // it is actually a fake DOM element injected into the page via 
  // `injected.setScreencastAnnotation()` in `screencast.ts` when 
  // `recordVideo.showActions` is explicitly enabled by the tooling.
  // It is NOT a real OS pointer.

  await browser.close();
})();
