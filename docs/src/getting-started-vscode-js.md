---
id: getting-started-vscode
title: "Getting started - VS Code"
---

import LiteYouTube from '@site/src/components/LiteYouTube';

Playwright Test was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation of Google Chrome for Android and Mobile Safari. 

Get started by installing Playwright and generating a test to see it in action. Alternatively you can also get started and run your tests using the [CLI](./intro.md).

<LiteYouTube
    id="Xz6lhEzgI5I"
    title="Getting Started with Playwright in VS Code"
/>

## Installation

Install the [VS Code extension from the marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) or from the extensions tab in VS Code.

<img width="1111" alt="VS Code extension for Playwright" src="https://user-images.githubusercontent.com/13063165/212734786-e8054b73-6f3b-41fe-bec9-16112a3d0aac.png" />

Once installed, open the command panel and type:

```bash
Install Playwright
```

<img width="1111" alt="Install Playwright" src="https://user-images.githubusercontent.com/13063165/212735039-4fd84b61-c1ca-4296-90de-e5fb307304d8.png" />


Select **Test: Install Playwright** and Choose the browsers you would like to run your tests on. These can be later configured in the [playwright.config](./test-configuration.md) file. You can also choose if you would like to have a GitHub Actions setup to [run your tests on CI](./ci-intro.md).

<img width="1119" alt="Choose Browsers" src="https://user-images.githubusercontent.com/13063165/212735257-de837172-676f-4c31-8527-7b4b9b34266f.png" />

## Running Tests

You can run a single test by clicking the green triangle next to your test block to run your test. Playwright will run through each line of the test and when it finishes you will see a green tick next to your test block as well as the time it took to run the test.

<img width="1314" alt="Run a single test" src="https://user-images.githubusercontent.com/13063165/212735762-51bae36b-8c91-46f1-bd3a-24bd29f853d2.png" />

### Run Tests and Show Browsers

You can also run your tests and show the browsers by selecting the option **Show Browsers** in the testing sidebar. Then when you click the green triangle to run your test the browser will open and you will visually see it run through your test. Leave this selected if you want browsers open for all your tests or uncheck it if you prefer your tests to run in headless mode with no browser open.

<img width="1394" alt="Show browsers while running tests" src="https://user-images.githubusercontent.com/13063165/212736666-955bbb68-9fa9-4de3-baf3-1eab289c96a4.png" />

Use the **Close all browsers** button to close all browsers.

### View and Run All Tests

View all tests in the testing sidebar and extend the tests by clicking on each test. Tests that have not been run will not have the green check next to them. Run all tests by clicking on the white triangle as you hover over the tests in the testing sidebar.

<img width="1314" alt="Run all tests in file" src="https://user-images.githubusercontent.com/13063165/212737059-0c52cda1-829d-4cda-9ca8-33741c87dfff.png" />

### Run Tests on Specific Browsers

The VS Code test runner runs your tests on the default browser of Chrome. To run on other/multiple browsers click the play button's dropdown and choose another profile or modify the default profile by clicking **Select Default Profile** and select the browsers you wish to run your tests on.

<img width="1067" alt="selecting browsers" src="https://user-images.githubusercontent.com/13063165/212737627-bcfd0cf1-0c84-4d63-bee1-ac4a09ab765f.png" />

Choose various or all profiles to run tests on multiple profiles. These profiles are read from the [playwright.config](./test-configuration.md) file. To add more profiles such as a mobile profile, first add it to your config file and it will then be available here.

<img width="1067" alt="choosing default profiles" src="https://user-images.githubusercontent.com/13063165/212737795-dcb93b2d-dc4e-4cb2-abc5-9eff58cf48ac.png" />

## Debugging Tests

With the VS Code extension you can debug your tests right in VS Code see error messages, create breakpoints and live debug your tests.

<LiteYouTube
    id="tJF7UhA59Gc"
    title="Debugging Playwright tests in VS Code"
/>

### Error Messages

If your test fails VS Code will show you error messages right in the editor showing what was expected, what was received as well as a complete call log.

<img width="1269" alt="error messaging in vs code" src="https://user-images.githubusercontent.com/13063165/212738654-b573b7c9-05be-476f-ab4c-201bf4265bc0.png" />

### Live Debugging

You can debug your test live in VS Code. After running a test with the `Show Browser` option checked, click on any of the locators in VS Code and it will be highlighted in the Browser window. Playwright will highlight it if it exists and show you if there is more than one result

<img width="1394" alt="live debugging in VS Code" src="https://user-images.githubusercontent.com/13063165/212884329-0755b007-0d69-4987-b084-38fd5bfb577d.png" />

You can also edit the locators in VS Code and Playwright will show you the changes live in the browser window.

<img width="1394" alt="live debugging in VS Code" src="https://user-images.githubusercontent.com/13063165/212884772-5022d4b1-6fab-456f-88e3-506f2354e238.png" />

### Run in Debug Mode

To set a breakpoint click next to the line number where you want the breakpoint to be until a red dot appears. Run the tests in debug mode by right clicking on the line next to the test you want to run. 

<img width="1269" alt="setting debug test mode" src="https://user-images.githubusercontent.com/13063165/212739847-ecb7dcfe-8929-45f3-b24e-f9c4b592f430.png" />

A browser window will open and the test will run and pause at where the breakpoint is set. You can step through the tests, pause the test and rerun the tests from the menu in VS Code.

<img width="1269" alt="running test in debug mode" src="https://user-images.githubusercontent.com/13063165/212740233-3f278825-13e7-4a88-a118-dd4478d43a16.png" />

### Debug in different Browsers

By default debugging is done using the Chromium profile. You can debug your tests on different browsers by right clicking on the debug icon in the testing sidebar and clicking on the 'Select Default Profile' option from the dropdown.

<img width="1312" alt="debugging on specific profile" src="https://user-images.githubusercontent.com/13063165/212879469-436f8130-c62a-49e1-9d67-c1903b478d5f.png" />

Then choose the test profile you would like to use for debugging your tests. Each time you run your test in debug mode it will use the profile you selected. You can run tests in debug mode by right clicking the line number where your test is and selecting 'Debug Test' from the menu.

<img width="1312" alt="choosing a profile for debugging" src="https://user-images.githubusercontent.com/13063165/212880198-eac22c3e-68ce-47da-9163-d6b376ae7575.png" />

To learn more about debugging, see [Debugging in Visual Studio Code](https://code.visualstudio.com/docs/editor/debugging).

## Generating Tests

CodeGen will auto generate your tests for you as you perform actions in the browser and is a great way to quickly get started. The viewport for the browser window is set to a specific width and height. See the [configuration guide](./test-configuration.md) to change the viewport or emulate different environments.

<LiteYouTube
    id="LM4yqrOzmFE"
    title="Generating Playwright tests in VS Code"
/>

### Record a New Test

To record a test click on the **Record new** button from the Testing sidebar. This will create a `test-1.spec.ts` file as well as open up a browser window. In the browser go to the URL you wish to test and start clicking around. Playwright will record your actions and generate a test for you. Once you are done recording click the **cancel** button or close the browser window. You can then inspect your `test-1.spec.ts` file and see your generated test.


<video width="100%" height="100%" controls muted>
  <source src="https://user-images.githubusercontent.com/13063165/197721416-e525dd60-51a6-4740-ad8b-0f56f4d20045.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

### Record at Cursor

To record from a specific point in your test file click the **Record at cursor** button from the Testing sidebar. This generates actions into the existing test at the current cursor position. You can run the test, position the cursor at the end of the test and continue generating the test.

### Picking a Locator

Pick a [locator](./locators.md) and copy it into your test file by clicking the **Pick locator** button form the testing sidebar. Then in the browser click the element you require and it will now show up in the **Pick locator** box in VS Code. Press 'enter' on your keyboard to copy the locator into the clipboard and then paste anywhere in your code. Or press 'escape' if you want to cancel.

<img width="1394" alt="Pick locators" src="https://user-images.githubusercontent.com/13063165/212741666-6479a702-2517-44a3-9eca-e719e13b379c.png" />

Playwright will look at your page and figure out the best locator, prioritizing [role, text and test id locators](./locators.md). If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [See test reports](./running-tests.md#test-reports)
- [See a trace of your tests](./trace-viewer-intro.md)
