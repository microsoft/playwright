/**
 * 03-locator-basics.js
 *
 * Demonstrates Locator creation, selector resolution, and auto-waiting action execution (click, fill).
 *
 * Real source code references studied:
 * - Public API / Client side:
 *   - `packages/playwright-core/src/client/locator.ts` -> `Locator`
 *     Represents a lazy selector descriptor (`this._frame`, `this._selector`).
 *     Methods like `getByRole`, `getByTestId`, `filter` chain selector engines (e.g. `internal:role=button`).
 *     `Locator.click()` delegates to `this._frame.click(this._selector, { strict: true, ...options })`.
 *   - `packages/playwright-core/src/client/frame.ts` -> `Frame.click(selector, options)`
 *     Dispatches `_channel.click(...)` RPC message to server side `FrameDispatcher`.
 * - Server side dispatcher & execution:
 *   - `packages/playwright-core/src/server/dispatchers/frameDispatcher.ts` -> `FrameDispatcher.click(...)`
 *     Calls `this._frame.click(progress, params.selector, params)`.
 *   - `packages/playwright-core/src/server/frames.ts` -> `Frame.click(progress, selector, options)`
 *     Executes `_retryWithProgressIfNotConnected()` which resolves the selector and invokes `ElementHandle._click()`.
 *   - `packages/playwright-core/src/server/dom.ts` -> `ElementHandle._retryPointerAction` & `ElementHandle._performPointerAction`
 *     Performs Playwright's strict auto-waiting checks:
 *     1. attached & visible check (`injected.checkElementStates`)
 *     2. enabled & stable check (ensures element bounding box is not moving)
 *     3. scrollIntoViewIfNeeded (reveals element in viewport)
 *     4. hit target test (`injected.checkElementHitTarget` ensures no overlay elements block pointer events)
 *     5. dispatches raw input event (`Page.mouse.click` / `Page.keyboard.type`)
 */

const { chromium } = require('playwright-core');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://example.com');

  // Creating Locators is lazy and synchronous — no RPC call is made until an action is called.
  // Locator constructor in client/locator.ts builds internal selector strings.
  const searchInput = page.getByPlaceholder('Search documentation...');
  const submitButton = page.getByRole('button', { name: 'Submit' });
  const linkLocator = page.locator('a').filter({ hasText: 'More information' });

  // Locator.fill() -> client/locator.ts calls Frame.fill() -> server/frames.ts -> server/dom.ts ElementHandle._fill()
  // Auto-waits for searchInput to be attached, visible, enabled, and editable.
  await searchInput.fill('Playwright architecture');

  // Locator.click() -> client/locator.ts calls Frame.click() -> server/frames.ts -> server/dom.ts ElementHandle._click()
  // Auto-waits for submitButton to be attached, visible, enabled, stable, scrolled into view, and un-obscured.
  await submitButton.click();

  // Perform action on filtered link locator
  await linkLocator.click();

  await context.close();
  await browser.close();
}

if (require.main === module) {
  main().catch(console.error);
}
