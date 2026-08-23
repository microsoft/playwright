/**
 * Example 17: Multi-Tab & Page Switching
 * 
 * This script demonstrates Playwright's multi-tab tracking architecture.
 * Playwright relies on Target.attachedToTarget events to track tabs and
 * maintains independent CDP sessions per tab, avoiding any "active tab" lock.
 * 
 * Note: This is a standalone, well-commented example for documentation
 * purposes only and is not meant to be executed directly in this environment.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  
  // Creates a BrowserContext, acting as an isolated profile
  const context = await browser.newContext();
  
  // context.pages() filters the internal _crPages map based on this context.
  console.log(`Initial pages count: ${context.pages().length}`);

  // 1. New Tab / Popup tracking
  // Whenever the browser spawns a new tab (e.g. via window.open or target="_blank"),
  // Chromium fires 'Target.attachedToTarget'. CRBrowser catches it, instantiates 
  // a new CRPage with the openerId linked to the parent, and bubbles up a 'page' event.
  context.on('page', async newPage => {
    console.log(`New tab detected! URL: ${newPage.url()}`);
    
    // The relationship is recorded; we can fetch the opener page.
    const opener = await newPage.opener();
    if (opener) {
      console.log(`Tab was opened by: ${opener.url()}`);
    }
  });

  const page = await context.newPage();
  await page.goto('https://example.com');
  
  // Trigger a popup to fire the context.on('page') listener above
  await page.evaluate(() => { window.open('https://example.com/popup', '_blank'); });

  // 2. Active Tab & Visibility
  // Playwright automation scripts do NOT depend on a tab being visually "active".
  // Commands are routed to the specific child CDP session (FrameSession) belonging
  // to each CRPage, allowing simultaneous background interactions.
  const allPages = context.pages();
  const backgroundTab = allPages[allPages.length - 1];

  // However, if we *want* to emulate user visibility (e.g., to trigger page visibility
  // APIs or requestAnimationFrame), we can bring a specific tab to the foreground.
  // This fires the 'Page.bringToFront' CDP command under the hood.
  await backgroundTab.bringToFront();

  await browser.close();
})();
