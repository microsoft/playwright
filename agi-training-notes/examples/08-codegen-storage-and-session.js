/**
 * 08-codegen-storage-and-session.js
 *
 * Demonstrates codegen session state persistence (--save-storage and --load-storage)
 * and the structural differences between spawning a fresh recording session versus
 * attaching the Recorder to an already existing BrowserContext/Page.
 *
 * Real source code references studied:
 * - Session State Persistence:
 *   - `packages/playwright-core/src/cli/browserActions.ts` -> `codegen(options, url)`
 *     On codegen termination, `launchContext()` executes `context.storageState({ path: options.saveStorage })`
 *     to dump cookies, origins, and localStorage to disk as JSON.
 *   - `packages/playwright-core/src/client/browserContext.ts` -> `BrowserContext.storageState(options)`
 *     Fetches storage state from server via `_channel.storageState()`.
 *   - `packages/playwright-core/src/server/browserContext.ts` -> `BrowserContext.storageState(progress, options)`
 *     Serializes browser cookies and localStorage key-value maps per origin.
 * - Fresh Recording Session vs Attaching to Existing Context:
 *   - **Fresh Codegen Session**:
 *     - CLI command `playwright codegen [url]` calls `launchContext()` in `cli/browserActions.ts`.
 *     - Spawns a dedicated browser process, creates a fresh `BrowserContext`, calls `context._enableRecorder()`,
 *       and opens the target URL (`openPage(context, url)`).
 *   - **Attaching to Existing Context (e.g. `page.pause()` or programmatic `_enableRecorder` mid-session)**:
 *     - `Recorder.forContext(context, params)` in `packages/playwright-core/src/server/recorder.ts` retrieves or creates the `Recorder` singleton attached to `context[recorderSymbol]`.
 *     - `Recorder._onPage(page)` binds to both existing pages in `context.pages()` and listens for new pages (`context.on('page')`).
 *     - `_context.extendInjectedScript()` injects the recorder script into all current and future documents in the context.
 *     - `_pickLocatorPage`: when inspect mode is activated, locator picking is isolated to `_pickLocatorPage` while other pages continue normal execution.
 */

const { chromium } = require('playwright-core');

/**
 * CLI Usage Example for Storage State Persistence:
 *
 * Step 1: Save authentication cookies & localStorage during manual login:
 * npx playwright codegen https://example.com/login --save-storage=auth.json
 *
 * Step 2: Reuse saved session state to record actions as an authenticated user:
 * npx playwright codegen https://example.com/dashboard --load-storage=auth.json
 */

async function attachRecorderToExistingContextDemo() {
  const browser = await chromium.launch({ headless: false });

  // Load existing session state if available (simulates --load-storage flag)
  const contextOptions = {
    // storageState: './auth.json' // restores cookies and localStorage
  };
  const context = await browser.newContext(contextOptions);

  // Open pages and perform standard automation work
  const page1 = await context.newPage();
  await page1.goto('https://example.com');

  console.log('Attaching Recorder to an existing, live BrowserContext...');

  // Programmatically attach Recorder to the active context (simulates page.pause())
  // Recorder.forContext() in server/recorder.ts detects existing pages in context.pages()
  // and injects rawRecorderSource into all current and future frame execution contexts.
  await context._enableRecorder({
    language: 'javascript',
    mode: 'recording'
  });

  console.log('Recorder successfully attached to existing session.');

  // Open a second page — Recorder._onPage() automatically hooks into new pages via context.on('page')
  const page2 = await context.newPage();
  await page2.goto('https://example.com');

  // Save session state explicitly before closing (simulates --save-storage flag)
  // const state = await context.storageState({ path: './examples/scratch/auth.json' });

  await context.close();
  await browser.close();
}

if (require.main === module) {
  attachRecorderToExistingContextDemo().catch(console.error);
}
