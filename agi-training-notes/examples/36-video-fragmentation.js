/**
 * Example 36: Multi-Tab Video Fragmentation
 * 
 * This script demonstrates the structural fragmentation of `recordVideo`.
 * Even though the video is configured at the Context level, Playwright natively
 * spawns an independent video file for every new Page created.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch();
  
  // Configure recording at the Context level
  const context = await browser.newContext({
    recordVideo: { dir: 'videos/' }
  });

  // Tab 1 is created. `startAutomaticVideoRecording` assigns it a file 
  // (e.g. videos/<page1-guid>.webm).
  const page1 = await context.newPage();
  await page1.goto('https://example.com');
  await page1.click('a[target="_blank"]'); // Assume this opens Tab 2

  // Tab 2 is caught.
  const page2 = await context.waitForEvent('page');
  
  // Tab 2 is assigned its OWN separate video file (videos/<page2-guid>.webm).
  // Neither video file contains metadata linking them together.
  await page2.waitForLoadState();
  await page2.close();

  await page1.click('button');

  await context.close();
  await browser.close();
  
  // Result: Two totally unlinked .webm files exist in 'videos/'.
  console.log(fs.readdirSync('videos/'));
})();
