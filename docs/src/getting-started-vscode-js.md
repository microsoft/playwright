---
id: getting-started-vscode
title: "Getting started - VS Code"
---

import LiteYouTube from '@site/src/components/LiteYouTube';

## Introduction

Playwright Test was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation of Google Chrome for Android and Mobile Safari. 

Get started by installing Playwright and generating a test to see it in action. Alternatively you can also get started and run your tests using the [CLI](./intro.md).

<LiteYouTube
    id="Xz6lhEzgI5I"
    title="Getting Started with Playwright in VS Code"
/>

## Installation

Install the [VS Code extension from the marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) or from the extensions tab in VS Code.

![VS Code extension for Playwright](https://github.com/microsoft/playwright/assets/13063165/290f7373-d7ef-4aac-ae38-6c8eae217fba)

Once installed, open the command panel and type:

```bash
Install Playwright
```

![install playwright](https://github.com/microsoft/playwright/assets/13063165/14e91050-24ab-4ff1-a37b-57d7c15e5c35)


Select **Test: Install Playwright** and Choose the browsers you would like to run your tests on. These can be later configured in the [playwright.config](./test-configuration.md) file. You can also choose if you would like to have a GitHub Actions setup to [run your tests on CI](./ci-intro.md).

![choose browsers](https://github.com/microsoft/playwright/assets/13063165/c9e8a25a-e9e8-4419-aeb5-1b8ba58bd71d)

## Running Tests

You can run a single test by clicking the green triangle next to your test block to run your test. Playwright will run through each line of the test and when it finishes you will see a green tick next to your test block as well as the time it took to run the test.

![run a single test](https://github.com/microsoft/playwright/assets/13063165/69dbccfc-4e9f-40e7-bcdf-7d5c5a11f988)

### Run Tests and Show Browsers

You can also run your tests and show the browsers by selecting the option **Show Browsers** in the testing sidebar. Then when you click the green triangle to run your test the browser will open and you will visually see it run through your test. Leave this selected if you want browsers open for all your tests or uncheck it if you prefer your tests to run in headless mode with no browser open.

![show browsers while running tests](https://github.com/microsoft/playwright/assets/13063165/9f231530-0c43-466a-b944-8cf5102f714a)

Use the **Close all browsers** button to close all browsers.

### View and Run All Tests

View all tests in the testing sidebar and extend the tests by clicking on each test. Tests that have not been run will not have the green check next to them. Run all tests by clicking on the white triangle as you hover over the tests in the testing sidebar.

![run all tests](https://github.com/microsoft/playwright/assets/13063165/348e18ff-f819-4caa-8f7e-f16c20724f56)

### Run Tests on Specific Browsers

The VS Code test runner runs your tests on the default browser of Chrome. To run on other/multiple browsers click the play button's dropdown and choose another profile or modify the default profile by clicking **Select Default Profile** and select the browsers you wish to run your tests on.

![run tests on specific browsers](https://github.com/microsoft/playwright/assets/13063165/4fb1fe46-ccfb-44cf-a91e-52dd146dc989)

Choose various or all profiles to run tests on multiple profiles. These profiles are read from the [playwright.config](./test-configuration.md) file. To add more profiles such as a mobile profile, first add it to your config file and it will then be available here.

![choosing default profiles](https://github.com/microsoft/playwright/assets/13063165/8ae73c1e-aca7-4d6b-8051-9410be7f1a05)

### Run tests with Trace Viewer

For a better developer experience you can run your tests with the **Show Trace Viewer** option.

![run tests with trace viewer](https://github.com/microsoft/playwright/assets/13063165/fab8efa6-d5ef-496d-876d-c99e94e6a6b3)

This will open up a full trace of your test where you can step through each action of your tests, explore the timeline, source code and more.

![trace viewer](https://github.com/microsoft/playwright/assets/13063165/ee31a4fe-c786-4d4b-887e-2dcecacfba2c)

To learn more about the trace viewer see our [Trace Viewer guide](./trace-viewer.md).

## Debugging Tests

With the VS Code extension you can debug your tests right in VS Code see error messages, create breakpoints and live debug your tests.

<LiteYouTube
    id="tJF7UhA59Gc"
    title="Debugging Playwright tests in VS Code"
/>

### Error Messages

If your test fails VS Code will show you error messages right in the editor showing what was expected, what was received as well as a complete call log.

![error messaging in vs code](https://github.com/microsoft/playwright/assets/13063165/3b8af12a-4805-4573-9d38-92055a0a7e75)

### Live Debugging

You can debug your test live in VS Code. After running a test with the `Show Browser` option checked, click on any of the locators in VS Code and it will be highlighted in the Browser window. Playwright will highlight it if it exists and show you if there is more than one result

![live debugging in vs code](https://github.com/microsoft/playwright/assets/13063165/7d236ebb-3d2d-4384-b73d-32a2b4e33b9e)

You can also edit the locators in VS Code and Playwright will show you the changes live in the browser window.

### Run in Debug Mode

To set a breakpoint click next to the line number where you want the breakpoint to be until a red dot appears. Run the tests in debug mode by right clicking on the line next to the test you want to run. 

![setting debug mode](https://github.com/microsoft/playwright/assets/13063165/31640629-efac-4cc7-b8b0-80ae18a3af83)

A browser window will open and the test will run and pause at where the breakpoint is set. You can step through the tests, pause the test and rerun the tests from the menu in VS Code.

![running in debug mode](https://github.com/microsoft/playwright/assets/13063165/b96a9f50-0f4d-49f9-a3d8-f093980a5673)

### Debug in different Browsers

By default debugging is done using the Chromium profile. You can debug your tests on different browsers by right clicking on the debug icon in the testing sidebar and clicking on the 'Select Default Profile' option from the dropdown.

![debug different browsers](https://github.com/microsoft/playwright/assets/13063165/cf97866e-3542-4f03-80a8-abd28f90babf)

Then choose the test profile you would like to use for debugging your tests. Each time you run your test in debug mode it will use the profile you selected. You can run tests in debug mode by right clicking the line number where your test is and selecting 'Debug Test' from the menu.

![choosing a profile for debugging](https://github.com/microsoft/playwright/assets/13063165/48c1b428-8dd2-4229-9eb5-24f7168db834)

To learn more about debugging, see [Debugging in Visual Studio Code](https://code.visualstudio.com/docs/editor/debugging).

### Debug with Trace Viewer

For a better developer experience you can debug your tests with the **Show Trace Viewer** option.

![run tests with trace viewer](https://github.com/microsoft/playwright/assets/13063165/fab8efa6-d5ef-496d-876d-c99e94e6a6b3)

This will open up a full trace of your test where you can step through each action and see what happened before and after the action. You can also inspect the DOM snapshot, see console logs, network requests, the source code and more.

![trace viewer](https://github.com/microsoft/playwright/assets/13063165/ee31a4fe-c786-4d4b-887e-2dcecacfba2c)

To learn more about the trace viewer see our [Trace Viewer guide](./trace-viewer.md).

## Generating Tests

CodeGen will auto generate your tests for you as you perform actions in the browser and is a great way to quickly get started. The viewport for the browser window is set to a specific width and height. See the [configuration guide](./test-configuration.md) to change the viewport or emulate different environments.

<LiteYouTube
    id="5XIZPqKkdBA"
    title="Generating Playwright tests in VS Code"
/>

### Record a New Test

To record a test click on the **Record new** button from the Testing sidebar. This will create a `test-1.spec.ts` file as well as open up a browser window. In the browser go to the URL you wish to test and start clicking around. Playwright will record your actions and generate the test code directly in VS Code. You can also generate assertions by choosing one of the icons in the toolbar and then clicking on an element on the page to assert against. The following assertions can be generated:
  * `'assert visibility'` to assert that an element is visible
  * `'assert text'` to assert that an element contains specific text
  * `'assert value'` to assert that an element has a specific value

Once you are done recording click the **cancel** button or close the browser window. You can then inspect your `test-1.spec.ts` file and see your generated test.


![record a new test](https://github.com/microsoft/playwright/assets/13063165/0407f112-e1cd-41e7-a05d-ae64e24d27ed)

### Record at Cursor

To record from a specific point in your test file click the **Record at cursor** button from the Testing sidebar. This generates actions into the existing test at the current cursor position. You can run the test, position the cursor at the end of the test and continue generating the test.

![record at cursor](https://github.com/microsoft/playwright/assets/13063165/96933ea1-4c84-453a-acd7-22b4d3bde185)

### Picking a Locator

Pick a [locator](./locators.md) and copy it into your test file by clicking the **Pick locator** button form the testing sidebar. Then in the browser click the element you require and it will now show up in the **Pick locator** box in VS Code. Press 'enter' on your keyboard to copy the locator into the clipboard and then paste anywhere in your code. Or press 'escape' if you want to cancel.


![pick locators](https://github.com/microsoft/playwright/assets/13063165/9a1b2da9-9ac7-4def-a9e0-f94770364fc2)

Playwright will look at your page and figure out the best locator, prioritizing [role, text and test id locators](./locators.md). If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [Run your tests on CI](./ci-intro.md)
- [Learn more about the Trace Viewer](./trace-viewer.md)
