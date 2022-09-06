---
id: getting-started-vscode
title: "Getting started - VS Code"
---

Playwright Test was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation of Google Chrome for Android and Mobile Safari. 

Get started by installing Playwright and generating a test to see it in action. Alternatively you can also get started and run your tests using the [CLI](./intro.md).

## Installation

Install the [VS Code extension from the marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright) or from the extensions tab in VS Code.

<img width="1099" alt="VS Code extension for Playwright" src="https://user-images.githubusercontent.com/13063165/188664251-e6e28648-25fb-45bb-98f5-ac6044938475.png" />

Once installed, open the command panel and type:

```bash
Install Playwright
```

<img width="1093" alt="Install Playwright in VS code" src="https://user-images.githubusercontent.com/13063165/188664853-7b3b610b-70ce-4674-ac51-3f2b48dcc589.png" />

Select **Test: Install Playwright** and Choose the browsers you would like to run your tests on. These can be later configured in the [playwright.config](./test-configuration.md) file. You can also choose if you would like to have a GitHub Actions setup to [run your tests on CI](./ci-intro.md).

<img width="1093" alt="choose browsers for Playwright in VS Code" src="https://user-images.githubusercontent.com/13063165/188664742-371f2321-67a1-4799-99ba-253a125de838.png" />

## Running Tests

You can run a single test by clicking the green triangle next to your test block to run your test. Playwright will run through each line of the test and when it finishes you will see a green tick next to your test block as well as the time it took to run the test.

<img width="1272" alt="Running Tests in VS Code" src="https://user-images.githubusercontent.com/13063165/188641041-e7f49b0e-758c-4154-b719-b873ba58dca4.png" />

### Run Tests and Show Browsers

You can also run your tests and show the browsers by selecting the option **Show Browsers** in the testing sidebar. Then when you click the green triangle to run your test the browser will open and you will visually see it run through your test. Leave this selected if you want browsers open for all your tests or uncheck it if you prefer your tests to run in headless mode with no browser open. 

<img width="1394" alt="Run Tests and Show Browsers in VS Code" src="https://user-images.githubusercontent.com/13063165/188662739-5b191b2d-7055-4f33-9399-bc8626163293.png" />

Use the **Close all browsers** button to close all browsers.

<img width="1272" alt="Close Browsers in VS Code" src="https://user-images.githubusercontent.com/13063165/188663381-c0293d02-75f9-46d4-852f-43aebe508d4a.png" />

### View and Run All Tests

View all tests in the testing sidebar and extend the tests by clicking on each test. Tests that have not been run will not have the green check next to them. Run all tests by clicking on the white triangle as you hover over the tests in the testing sidebar.

<img width="1272" alt="View and Run All Tests in VS Code" src="https://user-images.githubusercontent.com/13063165/188641364-3bfa74f8-2e8a-45e5-92e1-4cbee0660e8a.png" />

### Run Tests on Specific Browsers

The VS Code test runner runs your tests on the default browser of Chrome. To run on other/multiple browsers click the play button's dropdown and choose the option of "Select Default Profile" and select the browsers you wish to run your tests on.

<img width="1272" alt="Run Tests on Specific Browsers in VS Code" src="https://user-images.githubusercontent.com/13063165/188642000-f3c59179-8b44-40cb-a573-c2d9965737a6.png" />

## Debugging Tests

With the VS Code extension you can debug your tests right in VS Code see error messages, create breakpoints and live debug your tests.

### Error Messages

If your test fails VS Code will show you error messages right in the editor showing what was expected, what was received as well as a complete call log.

<img width="1272" alt="Error Messages in VS Code" src="https://user-images.githubusercontent.com/13063165/188642424-37da9e6c-b24a-4755-b14c-ceefa59483d2.png" />

### Run in Debug Mode

To set a breakpoint click next to the line number where you want the breakpoint to be until a red dot appears. Run the tests in debug mode by right clicking on the line next to the test you want to run. A browser window will open and the test will run and pause at where the breakpoint is set.

<img width="1272" alt="Run tests in Debug Mode in VS Code" src="https://user-images.githubusercontent.com/13063165/188642947-48f4eeaa-486d-4657-9819-63ad742ee7e2.png" />


### Live Debugging

You can modify your test right in VS Code while debugging and Playwright will highlight the selector in the browser. This is a great way of seeing if the selector exits or if there is more than one result. You can step through the tests, pause the test and rerun the tests from the menu in VS Code.


<img width="1394" alt="Live debugging in VS Code" src="https://user-images.githubusercontent.com/13063165/188644314-89967ab8-2415-4e55-bbca-b3840d347ca4.png" />



## Generating Tests

CodeGen will auto generate your tests for you as you perform actions in the browser and is a great way to quickly get started. The viewport for the browser window is set to a specific width and height. See the [configuration guide](./test-configuration.md) to change the viewport or emulate different environments.
### Record a New Test

To record a test click on the **Record new** button from the Testing sidebar. This will create a `test-1.spec.ts` file as well as open up a browser window. In the browser go to the URL you wish to test and start clicking around. Playwright will record your actions and generate a test for you. Once you are done recording click the **cancel** button or close the browser window. You can then inspect your `test-1.spec.ts` file and see your generated test.


<img width="1272" alt="Recording a Test in VS Code" src="https://user-images.githubusercontent.com/13063165/188644755-2ab9c826-79a9-4c52-8963-26bb9e853170.png" />

### Record a Test Starting From Another Test

Use the **Record from here** button to record a test from a specific line in your test file. This will open up a browser window and record the test from the line you selected. A new test file will now be created with the name `test-2.spec.ts` and will include the test code up to the selected line of the test file where you ran the **Record from here** button. You can then continue to generate the new test by clicking around in the browser window. 

<img width="1272" alt="Record a test from here in VS Code" src="https://user-images.githubusercontent.com/13063165/188654397-dc6e8677-e957-48ca-906e-8dd38da97c3b.png" />

### Selector Highlighting

As you interact with the page Codegen will generate the test for you in the newly created file in VS Code. When you hover over an element Playwright will highlight the element and show the [selector](./selectors.md) underneath it.

<img width="1394" alt="Selector Highlighting in VS Code" src="https://user-images.githubusercontent.com/13063165/188645469-cd9e925a-fb75-4250-bbdd-f14f2338ba34.png" />

### Picking a Selector

Pick a selector and copy it into your test file by clicking the **Pick selector** button form the testing sidebar. Then in the browser click the selector you require and it will now show up in the **Pick selector** box in VS Code. Press 'enter' on your keyboard to copy the selector into the clipboard and then paste anywhere in your code. Or press 'escape' if you want to cancel.

<img width="1394" alt="Selector Highlighting in VS Code" src="https://user-images.githubusercontent.com/13063165/188645977-2d5d1a50-d0f0-4d2e-ba30-59899bd3c77c.png" />



## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [See test reports](./running-tests.md#test-reports)
- [See a trace of your tests](./trace-viewer-intro.md)
