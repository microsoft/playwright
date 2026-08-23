/**
 * 06-codegen-language-targets.js
 *
 * Demonstrates codegen multi-language code generation (--target flag) and how Playwright's
 * language generators emit code across different programming languages and test runners.
 *
 * Real source code references studied:
 * - CLI Flag Parsing:
 *   - `packages/playwright-core/src/cli/program.ts` -> `codegenId()`
 *     Maps target strings (`playwright-test`, `javascript`, `python`, `python-pytest`, `python-async`, `csharp`, `csharp-mstest`, `csharp-nunit`, `csharp-xunit`, `java`, `java-junit`) to internal generator IDs.
 *   - `packages/playwright-core/src/cli/browserActions.ts` -> `codegen(options, url)`
 *     Accepts options.target and passes it to `context._enableRecorder({ language: options.target })`.
 * - Language Generators Registry:
 *   - `packages/isomorphic/codegen/languages.ts` -> `languageSet()`
 *     Returns a set of language generators:
 *     1. `JavaScriptLanguageGenerator(true/false)` (`packages/isomorphic/codegen/javascript.ts`) - Node.js Playwright Test / Library
 *     2. `PythonLanguageGenerator(isAsync, isPyTest)` (`packages/isomorphic/codegen/python.ts`) - Pytest / Sync Library / Async Library
 *     3. `CSharpLanguageGenerator(framework)` (`packages/isomorphic/codegen/csharp.ts`) - MSTest / NUnit / xUnit / Library
 *     4. `JavaLanguageGenerator(framework)` (`packages/isomorphic/codegen/java.ts`) - JUnit / Library
 *     5. `JsonlLanguageGenerator()` (`packages/isomorphic/codegen/jsonl.ts`) - Raw JSON lines format
 * - Server Code Generation Engine:
 *   - `packages/playwright-core/src/server/recorder.ts` -> `Recorder.setLanguage(language)`
 *   - `packages/playwright-core/src/server/recorder/recorderApp.ts` -> `RecorderApp`
 *     Streams generated code to `outputFile` using `ThrottledFile` (`server/recorder/throttledFile.ts`).
 */

const { chromium } = require('playwright-core');

/**
 * CLI Equivalent Examples for different language targets:
 *
 * 1. Playwright Test (TypeScript/JavaScript default):
 *    npx playwright codegen --target=playwright-test -o ./tests/login.spec.ts https://example.com
 *
 * 2. Python Pytest:
 *    npx playwright codegen --target=python-pytest -o ./tests/test_login.py https://example.com
 *
 * 3. C# NUnit:
 *    npx playwright codegen --target=csharp-nunit -o ./Tests/LoginTest.cs https://example.com
 *
 * 4. Java JUnit:
 *    npx playwright codegen --target=java-junit -o ./src/test/java/TestLogin.java https://example.com
 */

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Target 1: JavaScript / Playwright Test Runner
  // Uses JavaScriptLanguageGenerator(true) in packages/isomorphic/codegen/javascript.ts
  await context._enableRecorder({
    language: 'playwright-test',
    mode: 'recording',
    outputFile: './examples/scratch/generated_test.spec.js'
  });

  const page = await context.newPage();
  await page.goto('https://example.com');

  console.log('Codegen initialized with target: playwright-test');
  console.log('Language generator formats actions into Playwright Test runner code.');

  // Note: To switch target language programmatically on the server, Recorder.setLanguage() is called,
  // which updates the active LanguageGenerator in isomorphic/codegen/language.ts.

  await context.close();
  await browser.close();
}

if (require.main === module) {
  main().catch(console.error);
}
