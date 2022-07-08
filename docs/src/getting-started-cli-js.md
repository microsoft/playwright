---
id: getting-started-cli
title: "Getting started (CLI)"
---

Playwright Test was created specifically to accommodate the needs of end-to-end testing. It does everything you would expect from a regular test runner, and more. In this guide you will learn how to install Playwright using the CLI, generate tests though user actions with Codegen, learn how to write tests, run tests, debug tests, see a report of your tests, run tests on CI and see a trace view of your tests.
## Installation

This guide is for getting started with Playwright using the CLI. If you prefer to use the VS Code Extension then please see the [Getting Started (VS Code)](./getting-started-vscode.md) doc.

- Install Playwright in project's root directory

  ```bash
  npm init playwright@latest
  ```


- Install Playwright in a new project

  ```bash
  npm init playwright@latest new-project
  ```

Playwright will ask you 3 questions to help you get started quickly. Here you can choose to use JavaScript or TypeScript, what name you would like your tests folder to be called and if you would like GitHub Actions to be set up.

## Generating Tests with Codegen

[CodeGen](./codegen.md) will auto generate your tests for you and is a great way to quickly get started. It will open two windows, a browser window where you interact with the website you wish to test and the Playwright Inspector window where you can record your tests, copy the tests, clear your tests as well as change the language of your tests. The Playwright inspector is also used for debugging your tests.

- Open Codegen

  ```bash
  npx playwright codegen
  ```

- Open Codegen on a specific URL

  ```bash
  npx playwright codegen playwright.dev
  ```

<!-- <img width="961" alt="image" src="https://user-images.githubusercontent.com/13063165/177549951-0fbfa00d-257b-4719-a5ea-53b518989339.png" />

### Recording User Actions

Tests are generated in the Playwright Inspector as you interact with the browser. -->

<img width="1916" alt="image" src="https://user-images.githubusercontent.com/13063165/177550119-4e202a56-7d8e-43ac-ad91-bf2f7b2579bd.png"/>

To learn more about codegen please see the [Playwright Inspector](./codegen.md) docs.

## Writing Assertions

Playwright Test uses the [expect](https://jestjs.io/docs/expect) library for test assertions. It extends it with the Playwright-specific matchers to achieve greater testing ergonomics.

Learn more about [test assertions](./test-assertions.md).

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

You can use `test.beforeAll` and `test.afterAll` hooks to set up and tear down resources shared between tests. And you can use `test.beforeEach` and `test.afterEach` hooks to set up and tear down resources for each test individually.

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

## Running Tests

You can run a single test, a set of tests or all tests. Tests can be run on one browser or multiple browsers. By default tests are run in a headless manner meaning no browser window will be opened while running the tests and results will be seen in the terminal. If you prefer you can run your tests in headed mode by using the `--headed` flag.

- Running all tests

  ```bash
  npx playwright test
  ```

- Running a single test file

  ```bash
  npx playwright test test-1
  ```

- Run a set of test files

  ```bash
  npx playwright test tests/todo-page/ tests/landing-page/
  ```

- Run files that have `my-spec` or `my-spec-2` in the file name

  ```bash
  npx playwright test my-spec my-spec-2
  ```

- Run the test with the title

  ```bash
  npx playwright test -g "add a todo item"
  ```

- Running tests in headed mode

  ```bash
  npx playwright test test-1 --headed
  ```

- Running Tests on specific browsers

  ```bash
  npx playwright test test-1.spec.ts --project=chromium
  ```

## Debugging Tests

The Playwright inspector is a great tool to help with debugging. It opens up a browser window highlighting the selectors as you step through each line of the test. You can also use the explore button to find other available [selectors](./selectors.md) which you can then copy into your test file and rerun your tests to see if it passes.

- Debugging all Tests

  ```bash
  npx playwright test --debug
  ```
- Debugging one test

  ```bash
  npx playwright test test-1 --debug
  ```

Step through your test until you come to the line where the test is failing. Click the Explore button to hover over elements in the screen and click them to automatically generate [selectors](./selectors.md). Copy the new selector and paste it in to your test and then re run the test to see it pass.

<img width="1904" alt="image" src="https://user-images.githubusercontent.com/13063165/177560786-c561f428-3a81-415f-a3d4-9ba889ead99e.png"></img>

To learn more about the Playwright Inspector please see the [Playwright Inspector](./inspector.md) docs.


## Test Reports

The Playwright report shows you a full report of your tests allowing you to filter the report by browsers, failed tests, skipped tests etc.

```bash
npx playwright show-report
```

<img width="741" alt="image" src="https://user-images.githubusercontent.com/13063165/177343600-eebc9d1c-e602-4a96-aac5-474b11035f3f.png"></img>

To learn more about the HTML Reporter please see the [HTML Reporter](./html-reporter.md) docs.

## Running Tests on CI

Run your tests locally or on CI on each pull request with GitHub actions. Tests can be run on a local dev environment or on a staging URL. Checkout our guide for more options on [CI Configurations](./ci.md)

## Viewing Test Traces

Playwright Trace Viewer is a GUI tool that where you can explore recorded Playwright traces after the script ahs ran. Open traces locally or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

<img width="1212" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/883973/120585896-6a1bca80-c3e7-11eb-951a-bd84002480f5.png"></img>

To learn more about the Trace Viewer please see the [Trace Viewer](./trace-viewer.md) docs.
