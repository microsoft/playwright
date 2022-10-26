---
id: getting-started-vscode
title: "Getting started - VS Code"
---

Playwright Test was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation of Google Chrome for Android and Mobile Safari. 

Get started by installing Playwright and generating a test to see it in action. Alternatively you can also get started and run your tests using the [CLI](./intro.md).

## Installation

Install the [VS Code extension from the marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) or from the extensions tab in VS Code.

<img width="1100" alt="VS Code extension for Playwright" src="https://user-images.githubusercontent.com/13063165/197744119-5ed72385-2037-450b-b988-83b2f7554cf1.png" />

Once installed, open the command panel and type:

```bash
Install Playwright
```

<img width="1100" alt="Install Playwright" src="https://user-images.githubusercontent.com/13063165/197744677-edd437e7-15b2-4e3a-8c6b-e728cfe7b65c.png" />

Select **Test: Install Playwright** and Choose the browsers you would like to run your tests on. These can be later configured in the [playwright.config](./test-configuration.md) file. You can also choose if you would like to have a GitHub Actions setup to [run your tests on CI](./ci-intro.md).

<img width="1115" alt="Choose Browsers" src="https://user-images.githubusercontent.com/13063165/197704489-72744c50-81ea-4716-a5f1-52ca801edf1f.png" />

## Running Tests

You can run a single test by clicking the green triangle next to your test block to run your test. Playwright will run through each line of the test and when it finishes you will see a green tick next to your test block as well as the time it took to run the test.

<img width="1114" alt="Run a single test" src="https://user-images.githubusercontent.com/13063165/197712138-f4593c0d-ec7e-4a61-b2cd-59fc2af39c6a.png" />

### Run Tests and Show Browsers

You can also run your tests and show the browsers by selecting the option **Show Browsers** in the testing sidebar. Then when you click the green triangle to run your test the browser will open and you will visually see it run through your test. Leave this selected if you want browsers open for all your tests or uncheck it if you prefer your tests to run in headless mode with no browser open. 

<img width="1350" alt="Show browsers while running tests" src="https://user-images.githubusercontent.com/13063165/197714311-1d8c0955-9c5b-44ec-b429-160fa3d6b7a4.png" />

Use the **Close all browsers** button to close all browsers.

### View and Run All Tests

View all tests in the testing sidebar and extend the tests by clicking on each test. Tests that have not been run will not have the green check next to them. Run all tests by clicking on the white triangle as you hover over the tests in the testing sidebar.

<img width="1114" alt="Run all tests in file" src="https://user-images.githubusercontent.com/13063165/197712455-496f5300-79ed-4eae-9cc1-52cc9f3c019b.png" />

### Run Tests on Specific Browsers

The VS Code test runner runs your tests on the default browser of Chrome. To run on other/multiple browsers click the play button's dropdown and choose another profile or modify the default profile by clicking **Select Default Profile** and select the browsers you wish to run your tests on.

<img width="1116" alt="selecting browsers" src="https://user-images.githubusercontent.com/13063165/197728519-5381efc0-30d4-490e-82a8-e43eb35daf9f.png" />


Choose various or all profiles to run tests on multiple profiles. These profiles are read from the [playwright.config](./test-configuration.md) file. To add more profiles such as a mobile profile, first add it to your config file and it will then be available here.

<img width="1012" alt="choosing default profiles" src="https://user-images.githubusercontent.com/13063165/197710323-ec752f91-86c5-45c8-81b3-eac2e8ed0bfb.png" />

## Debugging Tests

With the VS Code extension you can debug your tests right in VS Code see error messages, create breakpoints and live debug your tests.

### Error Messages

If your test fails VS Code will show you error messages right in the editor showing what was expected, what was received as well as a complete call log.

<img width="1339" alt="error messaging in vs code" src="https://user-images.githubusercontent.com/13063165/197967016-b4c35689-0c04-4ea3-a288-35b98056efec.png" />

### Run in Debug Mode

To set a breakpoint click next to the line number where you want the breakpoint to be until a red dot appears. Run the tests in debug mode by right clicking on the line next to the test you want to run. A browser window will open and the test will run and pause at where the breakpoint is set.

<img width="1149" alt="setting debug test mode" src="https://user-images.githubusercontent.com/13063165/197715919-98f32957-2ae1-478b-9588-d93cc4548c67.png" />


### Live Debugging

You can modify your test right in VS Code while debugging and Playwright will highlight the selector in the browser. This is a great way of seeing if the selector exits or if there is more than one result. You can step through the tests, pause the test and rerun the tests from the menu in VS Code.


<img width="1350" alt="Live Debugging in VS Code" src="https://user-images.githubusercontent.com/13063165/197967885-512df81f-12e3-45e5-b90f-42ed0f064eac.png" />

### Debug in different Browsers

Debug your tests on specific browsers by selecting a profile from the dropdown. Set the default profile or select more than one profile to debug various profiles. Playwright will launch the first profile and once finished debugging it will then launch the next one.

<img width="1221" alt="debugging on specific profile" src="https://user-images.githubusercontent.com/13063165/197738552-06aa8a83-6a6b-4aad-ab23-d449640e1f5f.png" />

To learn more about debugging, see [Debugging in Visual Studio Code](https://code.visualstudio.com/docs/editor/debugging).

## Generating Tests

CodeGen will auto generate your tests for you as you perform actions in the browser and is a great way to quickly get started. The viewport for the browser window is set to a specific width and height. See the [configuration guide](./test-configuration.md) to change the viewport or emulate different environments.

### Record a New Test

To record a test click on the **Record new** button from the Testing sidebar. This will create a `test-1.spec.ts` file as well as open up a browser window. In the browser go to the URL you wish to test and start clicking around. Playwright will record your actions and generate a test for you. Once you are done recording click the **cancel** button or close the browser window. You can then inspect your `test-1.spec.ts` file and see your generated test.


<video width="100%" height="100%" controls muted>
  <source src="https://user-images.githubusercontent.com/13063165/197721416-e525dd60-51a6-4740-ad8b-0f56f4d20045.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

### Record From Here

Record a new test snippet. This creates a new empty test file but the recording starts from the current browser state from the previous test instead of starting a new browser. This snippet can then be pasted into a previous test file so it can be properly run. Note in the example below the test starts from the last state of a previous test and therefore has no `page.goto()` action.


<img width="1392" alt="record a test from a specific browser state" src="https://user-images.githubusercontent.com/13063165/197740755-fa845cbb-6292-44a4-8134-af1ce15f438a.png" />

### Picking a Selector

Pick a selector and copy it into your test file by clicking the **Pick selector** button form the testing sidebar. Then in the browser click the selector you require and it will now show up in the **Pick selector** box in VS Code. Press 'enter' on your keyboard to copy the selector into the clipboard and then paste anywhere in your code. Or press 'escape' if you want to cancel.

<img width="1394" alt="Pick selectors" src="https://user-images.githubusercontent.com/13063165/197714946-cb82231d-a6f8-4183-b54b-3375ffaa7092.png" />



## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [See test reports](./running-tests.md#test-reports)
- [See a trace of your tests](./trace-viewer-intro.md)
