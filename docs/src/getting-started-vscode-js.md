---
id: getting-started-vscode
title: "Getting started (VSCode)"
---

Playwright Test was created specifically to accommodate the needs of end-to-end testing. It does everything you would expect from a regular test runner, and more. Playwright test allows you to:

- Run tests across all browsers.
- Execute tests in parallel.
- Enjoy context isolation out of the box.
- Capture videos, screenshots and other artifacts on failure.
- Integrate your POMs as extensible fixtures.

## Installation

This guide is getting started with Playwright using the [VS Code extension](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright). If you prefer to use the CLI then please see the [Getting Started (CLI)](./getting-started-cli.md) doc.

### Install the VS Code Extension

Install the VS Code extension from the [marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright).

<img width="535" alt="image" src="https://user-images.githubusercontent.com/13063165/177198887-de49ec12-a7a9-48c2-8d02-ad53ea312c91.png"></img>

### Install Playwright

Open the command panel in VSCode (cmd/ctrl + shift + p) and type "Install Playwright" and select "Test: Install Playwright".

<img width="538" alt="image" src="https://user-images.githubusercontent.com/13063165/177199115-ce90eb84-f12a-4b95-bd3a-17ff870fcec2.png"></img>

### Choose the Browsers

Choose the browsers you'd like to run your tests on. These can be later configured in the `playwright.config.ts` file.

<img width="536" alt="image" src="https://user-images.githubusercontent.com/13063165/177199008-a71248c6-48b8-4e2d-8000-481f3c35191b.png" />

### What's Installed

You should now have the following files and folders installed:

<img width="373" alt="image" src="https://user-images.githubusercontent.com/13063165/177196704-a05649b7-d27c-4d84-8b17-fc0736f1785a.png"></img>

## Generating Tests with Codegen

[CodeGen](./codegen.md) will auto generate your tests for you and is a great way to quickly get started. You can also write your tests manually if you prefer.

### Starting the Recording

Click on the Testing icon in the left menu to open the testing sidebar. To record a test using [CodeGen](./codegen.md) click on the record icon, the first icon at the top of the testing sidebar. This will create a `test-1.spec.ts` file as well as open up a browser window. As you record your user actions your test code will be generated here.

<img width="810" alt="image" src="https://user-images.githubusercontent.com/13063165/177197869-40b32235-ae7c-4a6e-8b7e-e69aea17ea1b.png"></img>

### Recording User Actions

In the browser window open the URL that you want to test and click on the element you want to interact with.

<img width="958" alt="image" src="https://user-images.githubusercontent.com/13063165/177199982-42dc316f-3438-48b1-a6a6-417be77be658.png"></img>

As you hover over an element Playwright will highlight the element with the [selector](./selectors.md) shown underneath it.
<img width="956" alt="image" src="https://user-images.githubusercontent.com/13063165/177200382-8945a369-da5a-402e-9b7c-e6e793b810fe.png"></img>

If you click the element [CodeGen](./codegen.md) will generate the test for you in the test file that was created.

```js title="test.spec.ts"
import { test, expect } from "@playwright/test";

test("test", async ({ page }) => {
  // Go to https://playwright.dev/
  await page.goto("https://playwright.dev/");

  // Click text=Get started
  await page.locator("text=Get started").click();
  await expect(page).toHaveURL("https://playwright.dev/docs/intro");

  // Click h1:has-text("Getting started")
  await page.locator('h1:has-text("Getting started")').click();
});
```

### Stopping the Recording

Press the cancel button in VS Code to stop the recording or close the browser window.

<img width="401" alt="image" src="https://user-images.githubusercontent.com/13063165/177200122-7504b4f7-fb9e-427c-b392-a4109f41591b.png"></img>

To learn more about codegen please see the [Test Generator](./codegen.md) docs.

## Running Tests

You can run a single test, all tests in a file or all tests in the tests folder. Tests can be run on one browser or multiple browsers.

### Running a Single Test

Click the green triangle next to your test block to run your test.

<img width="813" alt="image" src="https://user-images.githubusercontent.com/13063165/177201109-e0a17553-88cc-496e-a717-9a60247db935.png"></img>

Playwright will run through each line of the test and when it finishes you will see a green tick next to your test block as well as the time it took to run the test.

### Viewing all Tests

In the sidebar you can extend the tests by clicking on each test. Test that have not been run will not have the green check next to them.

<img width="812" alt="image" src="https://user-images.githubusercontent.com/13063165/177201231-f26e11da-2860-43fa-9a31-b04bba55d52e.png" />

### Running All Tests

You can run all tests by clicking on the white triangle as you hover over the tests in the testing sidebar.

<img width="283" alt="image" src="https://user-images.githubusercontent.com/13063165/177324550-74d4ed66-9be1-4ee7-b316-43a9d09367c3.png"></img>

### Running Tests on multiple browsers

The VS Code test runner runs your tests on the default browser of Chrome. To run on other/multiple browsers click the play button's dropdown and choose the option of "Select Default Profile" and select the browsers you wish to run your tests on.

<img width="814" alt="image" src="https://user-images.githubusercontent.com/13063165/177201716-e4392930-13af-49f0-b60d-be6381ce645d.png" />

## Debugging Tests

You can debug your tests right in VS Code. VS Code comes with some great error handling to help point you in the right direction when your tests fail.

<img width="880" alt="image" src="https://user-images.githubusercontent.com/13063165/177202555-fed3c9a8-215c-46b1-9545-dfc712a9e21c.png"></img>

### Creating Breakpoints

Create a breakpoint by clicking next to the line number so a red dot appears. To run the tests in debug mode right click on the line next to the test you want to run and select "debug test" from the menu.

<img width="880" alt="image" src="https://user-images.githubusercontent.com/13063165/177202631-114855cd-15ba-4040-997b-74ed5b8f0a2d.png"/>

### Editing Code During Debugging

The browser will open and pause on the breakpoint. You can modify your test right in VS Code while debugging and Playwright will highlight the selector you are modifying. Use the menu at the top of the page to step through the tests, pause the tests, rerun the tests etc.

<img width="879" alt="image" src="https://user-images.githubusercontent.com/13063165/177202732-ab847173-09f1-4f58-b706-29060009891d.png"></img>

## HTML Reporter

To sort tests by browsers and see a full report first run your tests using the CLI.

```bash
npx playwright test
```

Once the tests have finished run the following command to open the reporter.

```bash
npx playwright show-report
```

You can then filter the report by browsers, failed tests, skipped tests etc.

<img width="741" alt="image" src="https://user-images.githubusercontent.com/13063165/177343600-eebc9d1c-e602-4a96-aac5-474b11035f3f.png"></img>

## Running on CI

Run your tests locally or on CI on each pull request with GitHub actions. Tests can be run on a local dev environment or on a staging URL. Checkout our guide for more options on [CI Configurations](./ci.md)

## Trace Viewer

Playwright Trace Viewer is a GUI tool that where you can explore recorded Playwright traces after the script ahs ran. Open traces locally or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

<img width="1212" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/883973/120585896-6a1bca80-c3e7-11eb-951a-bd84002480f5.png"></img>

To learn more about the Trace Viewer please see the [Trace Viewer](./trace-viewer.md) docs.
