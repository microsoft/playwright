/**
 * Example 32: Worker, Service Worker, and WebSocket Hooks
 * 
 * This script demonstrates the hooks Playwright exposes for background execution
 * contexts and WebSockets.
 * 
 * Note: This is an engineered pattern based on real Playwright primitives.
 * It is meant for documentation purposes only and not to be executed directly.
 */

const { chromium } = require('playwright-core');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // 1. Web Workers: Captured via `page.on('worker')` yielding a `Worker` instance.
  page.on('worker', worker => {
    console.log(`Worker spawned: ${worker.url()}`);
    // You can evaluate code directly inside the worker's execution context
    worker.evaluate(() => console.log('Hello from inside the worker'));
  });

  // 2. Service Workers: Tracked at the Context level via `context.serviceWorkers()`
  page.on('load', () => {
    const sws = context.serviceWorkers();
    console.log(`Currently active Service Workers: ${sws.length}`);
  });

  // 3. WebSockets: Captured via `page.on('websocket')` yielding a `WebSocket` instance.
  page.on('websocket', ws => {
    console.log(`WebSocket opened: ${ws.url()}`);
    
    // You can intercept or inspect frame data payloads natively.
    ws.on('framesent', frame => console.log(`Sent: ${frame.payload}`));
    ws.on('framereceived', frame => console.log(`Received: ${frame.payload}`));
  });

  await page.goto('https://example.com');
  
  await browser.close();
})();
