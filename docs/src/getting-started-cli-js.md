---
id: getting-started-cli
title: "Getting started (CLI)"
---

Playwright Test was created specifically to accommodate the needs of end-to-end testing. It does everything you would expect from a regular test runner, and more. Playwright test allows you to:

- Run tests across all browsers.
- Execute tests in parallel.
- Enjoy context isolation out of the box.
- Capture videos, screenshots and other artifacts on failure.
- Integrate your POMs as extensible fixtures.

## Installation

This guide is for getting started with Playwright using the CLI. If you prefer to use the VS Code Extension then please see the [Getting Started (VS Code)](./getting-started-vscode.md) doc.

### Install Playwright in project's root directory

```bash
npm init playwright@latest
```

```bash
yarn create playwright@latest
```

### Install Playwright in a new project

```bash
npm init playwright@latest new-project
```

```bash
yarn create playwright@latest new-project
```

Playwright will now ask you 3 questions to help you get started quickly.

## Generating Tests with Codegen

[CodeGen](./codegen.md) will auto generate your tests for you and is a great way to quickly get started. You can also write your tests manually if you prefer.

```bash
npx playwright codegen playwright.dev
```

This will launch a browser window as well as the Playwright inspector. The inspector will record and write your tests based on your user actions in the browser.

<img width="961" alt="image" src="https://user-images.githubusercontent.com/13063165/177549951-0fbfa00d-257b-4719-a5ea-53b518989339.png" />

### Recording User Actions

Tests are generated in the Playwright Inspector as you interact with the browser.

<img width="1916" alt="image" src="https://user-images.githubusercontent.com/13063165/177550119-4e202a56-7d8e-43ac-ad91-bf2f7b2579bd.png"/>

To learn more about codegen please see the [Playwright Inspector](./codegen.md) docs.

## Running the Tests

You can run a single test, all tests in a file or all tests in the tests folder. Tests can be run on one browser or multiple browsers.

### Running a Single Test

Run tests in a headless manner, meaning it will not open up a browser window.

```bash
npx playwright test test-1.spec.ts
```

### Running Tests - Headed

Run tests in a headed manner, meaning it will open up a browser window for each browser being tested and run through the tests.

```bash
npx playwright test test-1.spec.ts --headed
```

Test output can be seen in the terminal. While the tests are being run it will output which browser Playwright is testing.

### Running All Tests

Run all tests in your tests folder.

```bash
npx playwright test
```

### Running Tests on Specific Browsers

Use the `--project` flag to run your test only on a specific browser.

```bash
npx playwright test test-1.spec.ts --project=chromium
```

## Debugging Tests

Playwright comes with an inspector to help with debugging. You can step through each line of the test as well as explore other available [selectors](./selectors.md).

### Using the Playwright Inspector

You can debug your tests by running your tests using the `--debug` flag. This will open up a browser window as well as the Playwright inspector.

```bash
npx playwright test test-1.spec.ts --debug
```

Step through your test until you come to the line where the test is failing. Click the Explore button to hover over elements in the screen and click them to automatically generate [selectors](./selectors.md). Copy the new selector and paste it in to your test and then re run the test to see it pass.

<img width="1904" alt="image" src="https://user-images.githubusercontent.com/13063165/177560786-c561f428-3a81-415f-a3d4-9ba889ead99e.png"></img>

To learn more about the Playwright Inspector please see the [Playwright Inspector](./inspector.md) docs.

## Writing Assertions

Playwright Test uses the [expect](https://jestjs.io/docs/expect) library for test assertions. It extends it with the Playwright-specific matchers to achieve greater testing ergonomics.

Learn more about [test assertions here](./test-assertions.md).

Here is a quick example of using them:

```js tab=js-js
// example.spec.js
const { test, expect } = require("@playwright/test");

test("my test", async ({ page }) => {
  await page.goto("https://playwright.dev/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);

  // Expect an attribute "to be strictly equal" to the value.
  await expect(page.locator("text=Get Started").first()).toHaveAttribute(
    "href",
    "/docs/intro"
  );

  await page.click("text=Get Started");
  // Expect some text to be visible on the page.
  await expect(page.locator("text=Introduction").first()).toBeVisible();
});
```

```js tab=js-ts
// example.spec.ts
import { test, expect } from "@playwright/test";

test("my test", async ({ page }) => {
  await page.goto("https://playwright.dev/");

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);

  // Expect an attribute "to be strictly equal" to the value.
  await expect(page.locator("text=Get Started").first()).toHaveAttribute(
    "href",
    "/docs/intro"
  );

  await page.click("text=Get Started");
  // Expect some text to be visible on the page.
  await expect(page.locator("text=Introduction").first()).toBeVisible();
});
```

## Using test fixtures

You noticed an argument `{ page }` that the test above has access to:

```js tab=js-js
test('basic test', async ({ page }) => {
  ...
```

```js tab=js-ts
test('basic test', async ({ page }) => {
  ...
```

We call these arguments `fixtures`. Fixtures are objects that are created for each test run. Playwright Test comes loaded with those fixtures, and you can add your own fixtures as well. When running tests, Playwright Test looks at each test declaration, analyses the set of fixtures the test needs and prepares those fixtures specifically for the test.

Here is a list of the pre-defined fixtures that you are likely to use most of the time:

| Fixture     | Type             | Description                                                                                                                                        |
| :---------- | :--------------- | :------------------------------------------------------------------------------------------------------------------------------------------------- |
| page        | [Page]           | Isolated page for this test run.                                                                                                                   |
| context     | [BrowserContext] | Isolated context for this test run. The `page` fixture belongs to this context as well. Learn how to [configure context](./test-configuration.md). |
| browser     | [Browser]        | Browsers are shared across tests to optimize resources. Learn how to [configure browser](./test-configuration.md).                                 |
| browserName | [string]         | The name of the browser currently running the test. Either `chromium`, `firefox` or `webkit`.                                                      |

## Using test hooks

You can use `test.beforeAll` and `test.afterAll` hooks to set up and tear down resources shared between tests.
And you can use `test.beforeEach` and `test.afterEach` hooks to set up and tear down resources for each test individually.

```js tab=js-js
// example.spec.js
const { test, expect } = require("@playwright/test");

test.describe("feature foo", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto("https://playwright.dev/");
  });

  test("my test", async ({ page }) => {
    // Assertions use the expect API.
    await expect(page).toHaveURL("https://playwright.dev/");
  });
});
```

```js tab=js-ts
// example.spec.ts
import { test, expect } from "@playwright/test";

test.describe("feature foo", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto("https://playwright.dev/");
  });

  test("my test", async ({ page }) => {
    // Assertions use the expect API.
    await expect(page).toHaveURL("https://playwright.dev/");
  });
});
```

## HTML Reporter

The Playwright report shows you a full report of your tests allowing you to filter the report by browsers, failed tests, skipped tests etc.

```bash
npx playwright show-report
```

<img width="741" alt="image" src="https://user-images.githubusercontent.com/13063165/177343600-eebc9d1c-e602-4a96-aac5-474b11035f3f.png"></img>

To learn more about the HTML Reporter please see the [HTML Reporter](./html-reporter.md) docs.

## Running on CI

Run your tests locally or on CI on each pull request with GitHub actions. Tests can be run on a local dev environment or on a staging URL. Checkout our guide for more options on [CI Configurations](./ci.md)

## Trace Viewer

Playwright Trace Viewer is a GUI tool that where you can explore recorded Playwright traces after the script ahs ran. Open traces locally or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

<img width="1212" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/883973/120585896-6a1bca80-c3e7-11eb-951a-bd84002480f5.png"></img>

To learn more about the Trace Viewer please see the [Trace Viewer](./trace-viewer.md) docs.
