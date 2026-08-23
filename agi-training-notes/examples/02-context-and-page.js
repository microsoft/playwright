/**
 * 02-context-and-page.js
 *
 * Demonstrates creating an isolated BrowserContext and spawning Page instances.
 *
 * Real source code references studied:
 * - Client side BrowserContext & Page ownership:
 *   - `packages/playwright-core/src/client/browserContext.ts` -> `BrowserContext`
 *     Manages an isolated session state (cookies, localStorage, cache, proxy, context-level routes in `_routes`).
 *     `BrowserContext.newPage()` sends `_channel.newPage()` RPC request to server side `BrowserContextDispatcher`.
 *   - `packages/playwright-core/src/client/page.ts` -> `Page`
 *     Belongs to a single `BrowserContext` (`_browserContext`), owns main frame (`_mainFrame`), frame hierarchy (`_frames`),
 *     page-level routes (`_routes`), and input devices (`keyboard`, `mouse`, `touchscreen`).
 *   - `packages/playwright-core/src/client/frame.ts` -> `Frame.goto(url, options)`
 *     Delegates navigation request to `_channel.goto(...)` RPC channel call, which executes `FrameDispatcher.goto` on server.
 * - Server side context & page implementations:
 *   - `packages/playwright-core/src/server/browserContext.ts` -> `BrowserContext`
 *     Manages isolation boundaries and browser contexts at engine level.
 *   - `packages/playwright-core/src/server/page.ts` -> `Page`
 *     Coordinates page lifecycle events, frames, and delegating protocol commands to browser engine page delegates.
 */

const { chromium } = require('playwright-core');

async function main() {
  const browser = await chromium.launch({ headless: true });

  // Create an isolated BrowserContext (incognito-like session with independent storage/cookies).
  // BrowserContext in client/browserContext.ts owns context options (viewport, locale, permissions).
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    userAgent: 'Playwright-Core-Research-Bot/1.0',
    locale: 'en-US'
  });

  // Create a new Page inside this context.
  // Page in client/page.ts references its parent context via _browserContext and creates _mainFrame.
  const page = await context.newPage();

  // Navigate to a URL.
  // Page.goto() delegates to mainFrame.goto() in client/frame.ts -> sends RPC goto request to server.
  const response = await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
  console.log('Navigation response status:', response.status());
  console.log('Page title:', await page.title());

  // Clean up: closing context closes all pages owned by it (_pages Set in BrowserContext).
  await context.close();
  await browser.close();
}

if (require.main === module) {
  main().catch(console.error);
}
