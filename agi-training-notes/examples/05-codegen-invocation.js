/**
 * 05-codegen-invocation.js
 *
 * Demonstrates how Playwright's Codegen/Recorder can be invoked programmatically
 * or via CLI, explaining the internal event listener, selector generator, and code generator pipeline.
 *
 * Real source code references studied:
 * - CLI Entry point & Programmatic invocation:
 *   - `packages/playwright-core/src/cli/browserActions.ts` -> `codegen(options, url)`
 *     Parses options (`target`, `output`, `device`, `saveStorage`, etc.), launches context,
 *     and calls `context._enableRecorder(params)`.
 *   - `packages/playwright-core/src/client/browserContext.ts` -> `BrowserContext._enableRecorder(params)`
 *     Sends `enableRecorder` RPC request over `_channel` to `BrowserContextDispatcher.enableRecorder`.
 * - Server side Recorder controller:
 *   - `packages/playwright-core/src/server/recorder.ts` -> `Recorder` class
 *     Instantiates server recorder, exposes bindings (`__pw_recorderRecordAction`, `__pw_recorderState`, `__pw_recorderPerformAction`),
 *     and injects page recorder script via `_context.extendInjectedScript(rawRecorderSource.source)`.
 * - Page Injected DOM event listener & selector generator:
 *   - `packages/injected/src/recorder/recorder.ts` -> Injected `Recorder` class
 *     Installs DOM event listeners (`onClick`, `onInput`, `onKeyDown`).
 *   - `packages/injected/src/selectorGenerator.ts` -> `generateSelector(targetElement, options)`
 *     Uses a strict score-based ranking algorithm to pick the most resilient selector:
 *     1. Test ID (`kTestIdScore = 1`)
 *     2. Accessible Role + Name (`kRoleWithNameScore = 100`)
 *     3. Placeholder (`kPlaceholderScore = 120`)
 *     4. Label (`kLabelScore = 140`)
 *     5. Alt text (`kAltTextScore = 160`)
 *     6. Text content (`kTextScore = 180`)
 *     7. CSS / XPath (fallback)
 * - Action debouncing & signal processing:
 *   - `packages/playwright-core/src/server/recorder/recorderSignalProcessor.ts` -> `RecorderSignalProcessor`
 *     Debounces rapid input (e.g. keypresses into a single fill, click + click into dblclick).
 * - Code emission / Formatting:
 *   - `packages/isomorphic/codegen/javascript.ts` -> `JavaScriptLanguageGenerator`
 *   - `packages/isomorphic/codegen/python.ts`, `csharp.ts`, `java.ts`
 *     Formats recorded `ActionInContext` objects into clean target language code.
 */

const { chromium } = require('playwright-core');

/**
 * CLI Usage Example:
 * npx playwright codegen https://example.com --target=javascript --output=./tests/generated.spec.js -b chromium
 *
 * Command Line Flags Explained:
 *   --target <language>        Language to generate (playwright-test, javascript, python, python-pytest, csharp, java)
 *   -b, --browser <browser>    Browser engine to use (chromium, firefox, webkit)
 *   -o, --output <file>        File path to write generated code output
 *   --load-storage <file>      Path to JSON file containing saved storage state (cookies, localStorage)
 *   --save-storage <file>      Path to save storage state upon exiting codegen
 *   --viewport-size <size>     Custom viewport size (e.g. "1280,720")
 *   --device <device>          Emulate a specific device descriptor (e.g. "iPhone 13")
 *   --test-id-attribute <name> Custom attribute for test IDs (default is "data-testid")
 */

async function programmaticCodegenDemo() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Programmatically enable recorder on the browser context.
  // Under the hood, BrowserContext._enableRecorder in client/browserContext.ts calls
  // BrowserContextDispatcher.enableRecorder, which instantiates server/recorder.ts.
  await context._enableRecorder({
    language: 'javascript', // 'javascript' | 'playwright-test' | 'python' | 'csharp' | 'java'
    mode: 'recording',      // 'recording' | 'inspecting' | 'none'
    testIdAttributeName: 'data-testid'
  });

  const page = await context.newPage();
  await page.goto('https://example.com');

  console.log('Codegen recorder enabled programmatically.');
  console.log('User actions in the browser are captured by injected/src/recorder/recorder.ts,');
  console.log('selectors resolved via injected/src/selectorGenerator.ts,');
  console.log('and code generated via isomorphic/codegen/javascript.ts.');

  // Close context and browser when done recording
  // await context.close();
  // await browser.close();
}

if (require.main === module) {
  programmaticCodegenDemo().catch(console.error);
}
