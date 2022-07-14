---
id: getting-started-vscode
title: "Getting started - VS Code"
---

Playwright Test was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation of Google Chrome for Android and Mobile Safari. 

Get started by installing Playwright and generating a test to see it in action.

## Installation

Install the [VS Code extension from the marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright).

<img width="535" alt="image" src="https://user-images.githubusercontent.com/13063165/177198887-de49ec12-a7a9-48c2-8d02-ad53ea312c91.png"></img>

Once installed, open the command panel and type "Install Playwright" and select "Test: Install Playwright". Choose the browsers you would like to run your tests on. These can be later configured in the [playwright.config file](./test-configuration.md) file.


<img width="538" alt="image" src="https://user-images.githubusercontent.com/13063165/177199115-ce90eb84-f12a-4b95-bd3a-17ff870fcec2.png"></img>


## Generating Tests with Codegen

[CodeGen](./codegen.md) will auto generate your tests for you and is a great way to quickly get started. Click on the Testing icon in the left menu to open the testing sidebar. To record a test click on the record icon. This will create a `test-1.spec.ts` file as well as open up a browser window. As you record your user actions your test code will be generated in the newly created file.

<img width="810" alt="image" src="https://user-images.githubusercontent.com/13063165/177197869-40b32235-ae7c-4a6e-8b7e-e69aea17ea1b.png"></img>

As you hover over an element Playwright will highlight the element with the [selector](./selectors.md) shown underneath it. If you click the element [CodeGen](./codegen.md) will generate the test for you in the test file that was created.
<img width="958" alt="image" src="https://user-images.githubusercontent.com/13063165/177199982-42dc316f-3438-48b1-a6a6-417be77be658.png"></img>


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

