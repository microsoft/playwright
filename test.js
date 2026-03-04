const { chromium } = require('playwright');

(async () => {
  const wsEndpoint = process.argv[2];
  if (!wsEndpoint) {
    console.error('Usage: node test.js <ws://127.0.0.1:PORT>');
    process.exit(1);
  }

  console.log(`Connecting to ${wsEndpoint}...`);
  const browser = await chromium.connectOverCDP(wsEndpoint);

  const contexts = browser.contexts();
  console.log(`Browser contexts: ${contexts.length}`);

  for (const context of contexts) {
    const pages = context.pages();
    console.log(`  Context has ${pages.length} page(s)`);
    for (const page of pages) {
      console.log(`    Page: "${page.url()}" — title: "${await page.title()}"`);
    }
  }

  // Exercise the first page
  const page = contexts[0]?.pages()[0];
  console.log('page', !!page);
  if (page) {
    console.log('\nNavigating first page to example.org...');
    await page.goto('https://example.org');
    console.log(`  URL: ${page.url()}`);
    console.log(`  Title: "${await page.title()}"`);

    const text = await page.evaluate(() => document.body.innerText.substring(0, 100));
    console.log(`  Body text (first 100 chars): "${text}"`);

    await page.screenshot({ path: 'screenshot.png' });
    console.log('  Screenshot saved to screenshot.png');
  }

  // Listen for new pages
  console.log('\nListening for new pages (open a new tab in Electron to see it)...');
  const newPagePromise = new Promise((resolve) => {
    for (const context of browser.contexts()) {
      context.on('page', (p) => {
        console.log(`  New page appeared: "${p.url()}"`);
        resolve(p);
      });
    }
    // Timeout after 5 seconds
    setTimeout(() => resolve(null), 5000);
  });
  const newPage = await newPagePromise;
  if (!newPage) {
    console.log('  (no new page within 5s, continuing)');
  }

  console.log('\nDone. Disconnecting...');
  await browser.close();
})().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
