/**
 * 07-codegen-selector-scoring.js
 *
 * Demonstrates how Playwright's injected SelectorGenerator evaluates candidate selectors
 * using a strict score-based heuristic (lower score wins) to generate resilient locators.
 *
 * Real source code references studied:
 * - Selector Generator Algorithm:
 *   - `packages/injected/src/selectorGenerator.ts` -> `generateSelector(targetElement, options)`
 *     Evaluates DOM element attributes and context to build candidate selector tokens.
 * - Score Table (`packages/injected/src/selectorGenerator.ts`):
 *   - `kTestIdScore = 1`        -> data-testid attribute (or custom test ID attribute)
 *   - `kOtherTestIdScore = 2`   -> data-test, data-qa, data-cy attributes
 *   - `kRoleWithNameScore = 100` -> getByRole(role, { name })
 *   - `kPlaceholderScore = 120` -> getByPlaceholder(placeholder)
 *   - `kLabelScore = 140`       -> getByLabel(labelText)
 *   - `kAltTextScore = 160`     -> getByAltText(altText)
 *   - `kTextScore = 180`        -> getByText(textContent)
 *   - `kTitleScore = 200`       -> getByTitle(titleText)
 *   - `kEndPenalizedScore = 300` -> generic CSS class / id / tag / XPath fallback
 * - Custom Test ID Attribute Config:
 *   - CLI flag: `--test-id-attribute=data-qa`
 *   - `packages/playwright-core/src/client/locator.ts` -> `testIdAttributeName()`
 *   - Configured in `generateSelector` options as `testIdAttributeName`.
 */

const { chromium } = require('playwright-core');

/**
 * Example DOM Element to Generated Locator Resolution Mapping:
 *
 * 1. Element: <button data-testid="submit-btn" class="btn btn-primary">Submit Form</button>
 *    Candidates:
 *    - data-testid="submit-btn" -> Score: 1 (BEST -> Selected: getByTestId('submit-btn'))
 *    - role="button" name="Submit Form" -> Score: 100
 *    - text="Submit Form" -> Score: 180
 *    - css=".btn.btn-primary" -> Score: 300
 *
 * 2. Element: <input type="email" placeholder="Enter your email" />
 *    Candidates:
 *    - placeholder="Enter your email" -> Score: 120 (Selected: getByPlaceholder('Enter your email'))
 *    - css="input[type='email']" -> Score: 300
 *
 * 3. Element: <img src="logo.png" alt="Acme Corporation Logo" />
 *    Candidates:
 *    - alt="Acme Corporation Logo" -> Score: 160 (Selected: getByAltText('Acme Corporation Logo'))
 *    - css="img" -> Score: 300
 */

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();

  // Programmatically enable recorder with custom testIdAttributeName
  // Inside injected/src/selectorGenerator.ts, this overrides kTestIdScore attribute matching
  await context._enableRecorder({
    language: 'javascript',
    mode: 'recording',
    testIdAttributeName: 'data-qa' // custom attribute: data-qa="login-button" gets score 1
  });

  const page = await context.newPage();

  // Simulate navigating to page with structured HTML
  await page.goto('data:text/html,' + encodeURIComponent(`
    <!text/html>
    <html>
      <body>
        <label for="user">Username</label>
        <input id="user" placeholder="Enter username" />

        <button data-qa="login-submit" class="btn-login">Log In</button>
      </body>
    </html>
  `));

  console.log('Page loaded with custom data-qa attribute.');
  console.log('SelectorGenerator will pick getByTestId("login-submit") (Score 1) over class selector .btn-login (Score 300).');

  await context.close();
  await browser.close();
}

if (require.main === module) {
  main().catch(console.error);
}
