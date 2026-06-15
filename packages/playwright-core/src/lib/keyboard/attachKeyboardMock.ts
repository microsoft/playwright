import type { BrowserContext } from 'playwright-core';
import { KEYBOARD_INIT_SCRIPT } from './keyboard-init.js';

/**
 * Attach the mobile QWERTY keyboard mock to a Playwright BrowserContext.
 * Idempotent — the init script guards itself with
 * `window.__MOBILE_KEYBOARD_MOCK_INSTALLED__` so multiple attachments on
 * the same context are harmless.
 *
 * Discipline: every site that obtains a BrowserContext must call this
 * with the user's keyboardMock preference. A grep for unattached
 * context creation is the regression test (see
 * tests/call-site-coverage.test.ts).
 */
export async function attachKeyboardMock(
  context: BrowserContext,
  enabled: boolean
): Promise<void> {
  if (!enabled) return;
  await context.addInitScript({ content: KEYBOARD_INIT_SCRIPT });
}
