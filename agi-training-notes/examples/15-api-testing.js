/**
 * Example 15: API Testing and Clock Mocking
 * 
 * This script demonstrates the APIRequestContext for executing network
 * requests via Node.js natively while sharing cookie storage with the browser context,
 * as well as the Clock API for mocking time natively within the page's JS environment.
 * 
 * Note: This is a standalone, well-commented example for documentation
 * purposes only and is not meant to be executed directly in this environment.
 */

const { chromium, request } = require('playwright-core');

(async () => {
  // --- 1. API Testing (`APIRequestContext`) ---
  // Global APIRequestContext: bypasses the browser entirely.
  // Instantiates GlobalAPIRequestContext which uses Node's native http/https request.
  const apiContext = await request.newContext({
    baseURL: 'https://api.example.com',
    extraHTTPHeaders: { 'Authorization': 'Bearer test-token' }
  });

  // Makes a request using http/https natively instead of the CDP network stack.
  const response = await apiContext.get('/users/123');
  console.log(`Status: ${response.status()}`);
  console.log(`Body: ${await response.json()}`);
  await apiContext.dispose();

  // BrowserContextAPIRequestContext: Shares storage/cookies with a BrowserContext.
  const browser = await chromium.launch();
  const context = await browser.newContext();
  
  // context.request yields a BrowserContextAPIRequestContext
  // Under the hood, addCookies/cookies/storageState map directly to `context`.
  const contextRequest = context.request;
  
  // Sets a cookie in the BrowserContext
  await context.addCookies([{ name: 'session_id', value: 'xyz', domain: 'example.com', path: '/' }]);
  
  // This request natively includes the 'session_id' cookie because they share storage.
  const authRes = await contextRequest.get('https://example.com/api/profile');
  console.log(`Profile Fetch Status: ${authRes.status()}`);

  // --- 2. Clock & Time Mocking ---
  const page = await context.newPage();

  // Initialize the mock clock (BrowserContext.clock)
  // This reads packages/playwright-core/src/server/clock.ts and injects a SinonJS-based 
  // rawClockSource.source into the page via _browserContext.addInitScript().
  await page.clock.install({ time: new Date('2026-01-01T00:00:00Z').getTime() });

  // Evaluate some time-dependent code in the page.
  // The page's Date object is completely overridden by the injected script.
  await page.evaluate(() => {
    console.log(`Current mocked time: ${new Date().toISOString()}`);
    
    setTimeout(() => {
      console.log('Timeout fired!');
    }, 5000);
  });

  // Fast-forward the clock by 5000ms.
  // This triggers `globalThis.__pwClock.controller.fastForward(5000)` inside the page.
  await page.clock.fastForward(5000);

  // You can also pause at a specific time.
  await page.clock.pauseAt(new Date('2026-12-31T23:59:59Z').getTime());

  // Cleanup
  await browser.close();
})();
