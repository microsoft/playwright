/**
 * Example 22: FFmpeg Video Recording Pipeline
 * 
 * This script demonstrates Playwright's built-in video recording capabilities.
 * Under the hood, this spawns a physical `ffmpeg` process via child_process
 * with a hardcoded pipeline (vp8 codec, 25fps, 1M bitrate, no audio).
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  
  // To record a video, you set the recordVideo option at the Context level.
  // The dimensions are explicitly configured here.
  const context = await browser.newContext({
    recordVideo: {
      dir: 'videos/', // Directory to output the .webm files
      size: { width: 1024, height: 768 } // The FFmpeg -vf crop/pad dimensions
    }
  });

  const page = await context.newPage();

  // Any actions performed here will be encoded to VP8 at 25 fps.
  // Playwright strictly omits audio using the ffmpeg '-an' flag.
  await page.goto('https://example.com');
  await page.locator('button').click();

  // Closing the context flushes the remaining frames and gracefully terminates
  // the ffmpeg child process via stdin closure.
  await context.close();
  await browser.close();
})();
