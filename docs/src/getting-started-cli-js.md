---
id: getting-started-cli
title: "Getting started (CLI)"
---

## Installation

This guide is for anyone who wants to use Playwright with the CLI. If you prefer to install using the VS Code Extension then please see the [Getting Started (VS Code)](./getting-started-vscode.md) docs.

### Install Playwright in project's root directory

```bash
npm init playwright@latest
```
### Install Playwright in a new project

```bash
npm init playwright@latest new-project
```

Playwright will now ask you 3 questions to help you get started quickly.


## Generating Tests with Codegen

Codegen will auto generate your tests for you and is a great way to quickly get started. You can also write your tests manually if you prefer.

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

Playwright comes with an inspector to help with debugging. You can step through each line of the test as well as explore other available selectors.

### Using the Playwright Inspector

You can debug your tests by running your tests using the `--debug` flag. This will open up a browser window as well as the Playwright inspector. 

```bash
npx playwright test test-1.spec.ts --debug
```

Step through your test until you come to the line where the test is failing. Click the Explore button to hover over elements in the screen and click them to automatically generate selectors. Copy the new selector and paste it in to your test and then re run the test to see it pass.

<img width="1904" alt="image" src="https://user-images.githubusercontent.com/13063165/177560786-c561f428-3a81-415f-a3d4-9ba889ead99e.png"></img>


To learn more about the Playwright Inspector please see the [Playwright Inspector](./inspector.md) docs.


## HTML Reporter

The Playwright report shows you a full report of your tests allowing you to filter the report by browsers, failed tests, skipped tests etc.

```bash
npx playwright show-report
```

<img width="741" alt="image" src="https://user-images.githubusercontent.com/13063165/177343600-eebc9d1c-e602-4a96-aac5-474b11035f3f.png"></img>

## Running on CI

Run your tests locally or on CI on each pull request with GitHub actions. Tests can be run on a local dev environment or on a staging URL. Checkout our guide for more options on [CI Configurations](./ci.md)

## Trace Viewer

Playwright Trace Viewer is a GUI tool that where you can explore recorded Playwright traces after the script ahs ran. Open traces locally or in your browser on [`trace.playwright.dev`](https://trace.playwright.dev).

<img width="1212" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/883973/120585896-6a1bca80-c3e7-11eb-951a-bd84002480f5.png"></img>

To learn more about the Trace Viewer please see the [Trace Viewer](./trace-viewer.md) docs.