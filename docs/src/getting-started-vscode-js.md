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

![VS Code extension for Playwright](https://github.com/microsoft/playwright/assets/13063165/cab54568-3168-4b3f-bf3d-854976594903)

Once installed, open the command panel and type:

```bash
Install Playwright
```

![install playwright](https://github.com/microsoft/playwright/assets/13063165/14e91050-24ab-4ff1-a37b-57d7c15e5c35)


Select **Test: Install Playwright** and Choose the browsers you would like to run your tests on. These can be later configured in the [playwright.config](./test-configuration.md) file. You can also choose if you would like to have a GitHub Actions setup to [run your tests on CI](./ci-intro.md).

![choose browsers](https://github.com/microsoft/playwright/assets/13063165/c9e8a25a-e9e8-4419-aeb5-1b8ba58bd71d)

### Opening the testing sidebar

The testing sidebar can be opened by clicking on the testing icon in the activity bar. This will give you access to the test explorer, which will show you all the tests in your project as well as the Playwright sidebar which includes projects, settings, tools and setup.

![Testing Sidebar](https://github.com/microsoft/playwright/assets/13063165/d203fe83-6015-4e7a-b816-35d373906b24)

## Running tests

You can run a single test by clicking the green triangle next to your test block to run your test. Playwright will run through each line of the test and when it finishes you will see a green tick next to your test block as well as the time it took to run the test.

<LiteYouTube
    id="mQmcIBMsc38"
    title="Getting Started with Playwright in VS Code"
/>

![run a single test](https://github.com/microsoft/playwright/assets/13063165/69dbccfc-4e9f-40e7-bcdf-7d5c5a11f988)


### Run tests and show browsers

You can also run your tests and show the browsers by selecting the option **Show Browsers** in the testing sidebar. Then when you click the green triangle to run your test the browser will open and you will visually see it run through your test. Leave this selected if you want browsers open for all your tests or uncheck it if you prefer your tests to run in headless mode with no browser open.

![show browsers while running tests](https://github.com/microsoft/playwright/assets/13063165/9f231530-0c43-466a-b944-8cf5102f714a)

Use the **Close all browsers** button to close all browsers.

### View and run all tests

View all tests in the testing sidebar and extend the tests by clicking on each test. Tests that have not been run will not have the green check next to them. Run all tests by clicking on the white triangle as you hover over the tests in the testing sidebar.

![run all tests](https://github.com/microsoft/playwright/assets/13063165/348e18ff-f819-4caa-8f7e-f16c20724f56)

### Running tests on multiple browsers

The first section in the Playwright sidebar is the projects section. Here you can see all your projects as defined in your Playwright config file. The default config when installing Playwright gives you 3 projects, Chromium, Firefox and WebKit. The first project is selected by default.

![Projects section in VS Code extension](https://github.com/microsoft/playwright/assets/13063165/58fedea6-a2b9-4942-b2c7-2f3d482210cf)

To run tests on multiple projects, select each project by checking the checkboxes next to the project name. Then when you run your tests from the sidebar or by pressing the play button next to the test name, the tests will run on all the selected projects.

![Selecting projects to run tests on](https://github.com/microsoft/playwright/assets/13063165/6dc86ef4-6097-481c-9cab-b6e053ec7ea6)

You can also individually run a test on a specific project by clicking the grey play button next to the project name of the test.

![Running a test on a specific project](https://github.com/microsoft/playwright/assets/13063165/d29a27ab-07b5-4ca6-b4d7-1ad6d44bf222)

### Run tests with trace viewer

For a better developer experience you can run your tests with the **Show Trace Viewer** option.

![run tests with trace viewer](https://github.com/microsoft/playwright/assets/13063165/fab8efa6-d5ef-496d-876d-c99e94e6a6b3)

This will open up a full trace of your test where you can step through each action of your tests, explore the timeline, source code and more.

![trace viewer](https://github.com/microsoft/playwright/assets/13063165/ee31a4fe-c786-4d4b-887e-2dcecacfba2c)

To learn more about the trace viewer see our [Trace Viewer guide](./trace-viewer.md).



## Debugging tests

With the VS Code extension you can debug your tests right in VS Code see error messages, create breakpoints and live debug your tests.

<LiteYouTube
    id="tJF7UhA59Gc"
    title="Debugging Playwright tests in VS Code"
/>

### Error messages

If your test fails VS Code will show you error messages right in the editor showing what was expected, what was received as well as a complete call log.

![error messaging in vs code](https://github.com/microsoft/playwright/assets/13063165/3b8af12a-4805-4573-9d38-92055a0a7e75)

### Live debugging

You can debug your test live in VS Code. After running a test with the `Show Browser` option checked, click on any of the locators in VS Code and it will be highlighted in the Browser window. Playwright will highlight it if it exists and show you if there is more than one result

![live debugging in vs code](https://github.com/microsoft/playwright/assets/13063165/7d236ebb-3d2d-4384-b73d-32a2b4e33b9e)

You can also edit the locators in VS Code and Playwright will show you the changes live in the browser window.

### Run in debug mode

To set a breakpoint click next to the line number where you want the breakpoint to be until a red dot appears. Run the tests in debug mode by right clicking on the line next to the test you want to run. 

![setting debug mode](https://github.com/microsoft/playwright/assets/13063165/31640629-efac-4cc7-b8b0-80ae18a3af83)

A browser window will open and the test will run and pause at where the breakpoint is set. You can step through the tests, pause the test and rerun the tests from the menu in VS Code.

![running in debug mode](https://github.com/microsoft/playwright/assets/13063165/b96a9f50-0f4d-49f9-a3d8-f093980a5673)

![choosing a profile for debugging](https://github.com/microsoft/playwright/assets/13063165/48c1b428-8dd2-4229-9eb5-24f7168db834)

To learn more about debugging, see [Debugging in Visual Studio Code](https://code.visualstudio.com/docs/editor/debugging).

### Debug with trace viewer

For a better developer experience you can debug your tests with the **Show Trace Viewer** option.

![run tests with trace viewer](https://github.com/microsoft/playwright/assets/13063165/fab8efa6-d5ef-496d-876d-c99e94e6a6b3)

This will open up a full trace of your test where you can step through each action and see what happened before and after the action. You can also inspect the DOM snapshot, see console logs, network requests, the source code and more.

![trace viewer](https://github.com/microsoft/playwright/assets/13063165/ee31a4fe-c786-4d4b-887e-2dcecacfba2c)

To learn more about the trace viewer see our [Trace Viewer guide](./trace-viewer.md).

## Generating tests

CodeGen will auto generate your tests for you as you perform actions in the browser and is a great way to quickly get started. The viewport for the browser window is set to a specific width and height. See the [configuration guide](./test-configuration.md) to change the viewport or emulate different environments.

<LiteYouTube
    id="5XIZPqKkdBA"
    title="Generating Playwright tests in VS Code"
/>

### Record a new test

To record a test click on the **Record new** button from the Testing sidebar. This will create a `test-1.spec.ts` file as well as open up a browser window. In the browser go to the URL you wish to test and start clicking around. Playwright will record your actions and generate the test code directly in VS Code. You can also generate assertions by choosing one of the icons in the toolbar and then clicking on an element on the page to assert against. The following assertions can be generated:
  * `'assert visibility'` to assert that an element is visible
  * `'assert text'` to assert that an element contains specific text
  * `'assert value'` to assert that an element has a specific value

Once you are done recording click the **cancel** button or close the browser window. You can then inspect your `test-1.spec.ts` file and see your generated test.


![record a new test](https://github.com/microsoft/playwright/assets/13063165/0407f112-e1cd-41e7-a05d-ae64e24d27ed)

### Record at cursor

To record from a specific point in your test file click the **Record at cursor** button from the Testing sidebar. This generates actions into the existing test at the current cursor position. You can run the test, position the cursor at the end of the test and continue generating the test.

![record at cursor](https://github.com/microsoft/playwright/assets/13063165/96933ea1-4c84-453a-acd7-22b4d3bde185)

### Picking a locator

Pick a [locator](./locators.md) and copy it into your test file by clicking the **Pick locator** button form the testing sidebar. Then in the browser click the element you require and it will now show up in the **Pick locator** box in VS Code. Press 'enter' on your keyboard to copy the locator into the clipboard and then paste anywhere in your code. Or press 'escape' if you want to cancel.


![pick locators](https://github.com/microsoft/playwright/assets/13063165/9a1b2da9-9ac7-4def-a9e0-f94770364fc2)

Playwright will look at your page and figure out the best locator, prioritizing [role, text and test id locators](./locators.md). If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

## Project Dependencies

You can use [project dependencies](./test-projects.md) to run tests that depend on other tests. This is useful for **setup** tests such as logging in to a website. 

### Running setup tests

To run your setup tests select the **setup** project, as defined in your configuration file, from the project section in the Playwright sidebar. This will give you access to the **setup** tests in the test explorer.

![setup tests in vscode](https://github.com/microsoft/playwright/assets/13063165/7a9eccd5-a5b3-431f-9eff-9b2971501e07)

When you run a test that depends on the **setup** tests, the **setup** test will run first. Each time you run the test, the **setup** test will run again. 

![running setup tests in vscode](https://github.com/microsoft/playwright/assets/13063165/a54b3868-3f9f-4e74-8d42-a93443f099fc)

### Running setup tests only once

To run the **setup** test only once, deselect it from the projects section in the Playwright sidebar. The **setup** test is now removed from the test explorer. When you run a test that depends on the **setup** test, it will no longer run the **setup** test, making it much faster and therefore a much better developer experience.

![deselecting setup tests in vscode](https://github.com/microsoft/playwright/assets/13063165/ebc50e38-c98d-4538-82fe-ec08491f8487)

## Global Setup

**Global setup** tests are run when you execute your first test. This runs only once and is useful for setting up a database or starting a server. You can manually run a **global setup** test by clicking the `Run global setup` option from the **Setup** section in the Playwright sidebar. You can also run **global teardown** tests by clicking the `Run global teardown` option.

Global setup will re-run when you debug tests as this ensures an isolated environment and dedicated setup for the test.

![running global setup](https://github.com/microsoft/playwright/assets/13063165/bcf5fec7-2d7d-4cb9-a277-5f41e19b8d52)

## Multiple configurations

If your project contains more than one playwright configuration file, you can switch between them by first clicking on the gear icon in the top right corner of the Playwright sidebar. This will show you all the configuration files in your project. Select the configuration files you want to use by checking the checkbox next to each one and clicking on the 'ok' button.

![Selecting a configuration file](https://github.com/microsoft/playwright/assets/13063165/ff9ff838-d27a-403d-b939-94e6c295e1d7)

You will now have access to all your tests in the test explorer. To run a test click on the grey triangle next to the file or project name. 

![Switching between configuration files](https://github.com/microsoft/playwright/assets/13063165/70930de5-0a0c-45e0-a6ee-b51f727f0e35)

To run all tests from all configurations click on the grey triangle at the top of the test explorer.

![Running all tests from all configurations](https://github.com/microsoft/playwright/assets/13063165/b3de4ce1-d311-4527-b2c7-b3e2f179a685)

To choose a configuration file to work with simply toggle between them by clicking on the configuration file name in the Playwright sidebar. Now when you use the tools, such as Record a test, it will record a test for the selected configuration file. 

![Recording a test for a specific configuration file](https://github.com/microsoft/playwright/assets/13063165/a8ecbcd1-fab8-4012-bdaa-428951f233a2)

You can easily toggle back and forth between configurations by clicking on the configuration file name in the Playwright sidebar.

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [Run your tests on CI](./ci-intro.md)
- [Learn more about the Trace Viewer](./trace-viewer.md)
