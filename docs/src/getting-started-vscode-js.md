---
id: getting-started-vscode
title: "Getting started (VS Code)"
---

Playwright Test was created specifically to accommodate the needs of end-to-end testing. It does everything you would expect from a regular test runner, and more. Here you will learn how to:

- [Install Playwright using the VS Code Extension](#installation)
- [Generate tests with Codegen right from VS Code](#generating-tests-with-codegen)
- [Write assertions, use test fixtures and test hooks](#writing-assertions)
- [Run tests in VS Code](#running-tests)
- [Create breakpoints and debug tests right in VS Code](#debugging-tests)
- [See a detailed HTML report of your tests](#test-reports)
- [Run tests on CI](#running-tests-on-ci)
- [See a trace view of your test with DOM snapshots](#viewing-test-traces)

## Installation

Install the [VS Code extension from the marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright). Once installed, open the command panel and type "Install Playwright" and select "Test: Install Playwright". Choose the browsers you would like to run your tests on. These can be later configured in the `playwright.config.ts` file.


<!-- <img width="535" alt="image" src="https://user-images.githubusercontent.com/13063165/177198887-de49ec12-a7a9-48c2-8d02-ad53ea312c91.png"></img> -->


<img width="538" alt="image" src="https://user-images.githubusercontent.com/13063165/177199115-ce90eb84-f12a-4b95-bd3a-17ff870fcec2.png"></img>

For installing using the CLI see the [Getting Started (CLI)](./getting-started-cli.md) guide.

## Generating Tests with Codegen

[CodeGen](./codegen.md) will auto generate your tests for you and is a great way to quickly get started. Click on the Testing icon in the left menu to open the testing sidebar. To record a test click on the record icon. This will create a `test-1.spec.ts` file as well as open up a browser window. As you record your user actions your test code will be generated in the newly created file.

<img width="810" alt="image" src="https://user-images.githubusercontent.com/13063165/177197869-40b32235-ae7c-4a6e-8b7e-e69aea17ea1b.png"></img>

As you hover over an element Playwright will highlight the element with the [selector](./selectors.md) shown underneath it. If you click the element [CodeGen](./codegen.md) will generate the test for you in the test file that was created.
<img width="958" alt="image" src="https://user-images.githubusercontent.com/13063165/177199982-42dc316f-3438-48b1-a6a6-417be77be658.png"></img>

To learn more about codegen please see the [Test Generator](./codegen.md) docs.

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

You can run a single test by clicking the green triangle next to your test block to run your test. Playwright will run through each line of the test and when it finishes you will see a green tick next to your test block as well as the time it took to run the test.

<img width="813" alt="image" src="https://user-images.githubusercontent.com/13063165/177201109-e0a17553-88cc-496e-a717-9a60247db935.png"></img>

View all tests in the testing sidebar and extend the tests by clicking on each test. Tests that have not been run will not have the green check next to them.

<img width="812" alt="image" src="https://user-images.githubusercontent.com/13063165/177201231-f26e11da-2860-43fa-9a31-b04bba55d52e.png" />

Run all tests by clicking on the white triangle as you hover over the tests in the testing sidebar.

<img width="252" alt="image" src="https://user-images.githubusercontent.com/13063165/178029941-d9555c43-0966-4699-8739-612a9664e604.png" />

The VS Code test runner runs your tests on the default browser of Chrome. To run on other/multiple browsers click the play button's dropdown and choose the option of "Select Default Profile" and select the browsers you wish to run your tests on.

<img width="506" alt="image" src="https://user-images.githubusercontent.com/13063165/178030111-3c422349-a501-4190-9ad6-ec0bdc187b9e.png" />

## Debugging Tests

With the VS Code extension you can debug your tests right in VS Code see error messages and create breakpoints. Click next to the line number so a red dot appears and then run the tests in debug mode by right clicking on the line next to the test you want to run. A browser window will open and the test will run and pause at where the breakpoint is set.

<img width="1025" alt="image" src="https://user-images.githubusercontent.com/13063165/178027941-0d9d5f88-2426-43fb-b204-62a2add27415.png" />

 Modify your test right in VS Code while debugging and Playwright will highlight the selector you are modifying in the browser. You can step through the tests, pause the test and rerun the tests from the menu in VS Code.

<img width="1044" alt="image" src="https://user-images.githubusercontent.com/13063165/178029249-e0a85f53-b8d4-451f-b3e5-df62b0c57929.png" />

## Test Reports

The [HTML Reporter](./html-reporter.md) shows you a full report of your tests allowing you to filter the report by browsers, passed tests, failed tests, skipped tests and flaky tests. You can click on each test and explore the tests errors as well as each step of the test. By default, the HTML report is opened automatically if some of the tests failed.

- Run your tests using the CLI

  ```bash
  npx playwright test
  ```
  
- Show the HTML Report

  ```bash
  npx playwright show-report
  ```

<img width="739" alt="image" src="https://user-images.githubusercontent.com/13063165/178003817-3bd2f088-4173-406c-a9e9-74c89181f381.png" />

To learn more about the HTML Reporter please see the [HTML Reporter](./html-reporter.md) docs.

## Running Tests on CI

Run your tests locally or on CI on each pull request with GitHub actions. Tests can be run on a local dev environment or on a staging URL. Checkout our guide for more options on [CI Configurations](./ci.md).

## Viewing Test Traces

Playwright Trace Viewer is a GUI tool where you can explore recorded Playwright traces after the script has ran. See your test's DOM snapshot before and after the action item. View the test's timeline, log, source, network and console. Open traces locally or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

<img width="1212" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/883973/120585896-6a1bca80-c3e7-11eb-951a-bd84002480f5.png"></img>

To learn more about the Trace Viewer please see the [Trace Viewer](./trace-viewer.md) docs.