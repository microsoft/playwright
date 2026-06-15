import type { BrowserContext } from 'playwright-core';

/**
 * Navigate the context's first page to the dev server URL on launch.
 * Best-effort: a navigation failure is logged but does not prevent the
 * backend from starting. The caller can use `playwright_browser_navigate`
 * to retry.
 */
export async function attachAutoNavigate(
  context: BrowserContext,
  baseUrl: string | undefined
): Promise<void> {
  if (!baseUrl) return;
  const existing = context.pages();
  const page = existing[0] ?? (await context.newPage());
  try {
    await page.goto(baseUrl);
  } catch (err) {
    console.error(`[auto-navigate] failed to navigate to ${baseUrl}:`, err);
  }
}
