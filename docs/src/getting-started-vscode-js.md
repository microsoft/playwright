---
id: getting-started-vscode
title: "Getting started - VS Code"
---

Playwright Test was created specifically to accommodate the needs of end-to-end testing. Playwright supports all modern rendering engines including Chromium, WebKit, and Firefox. Test on Windows, Linux, and macOS, locally or on CI, headless or headed with native mobile emulation of Google Chrome for Android and Mobile Safari. 

Get started by installing Playwright and generating a test to see it in action. Alternatively you can also get started and run your tests using the [CLI](./intro.md).

## Installation

Install the [VS Code extension from the marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright).

<img width="535" alt="image" src="https://user-images.githubusercontent.com/13063165/182146928-b2a46ce5-3008-409c-be10-d2b255bd5e91.jpeg"></img>

Once installed, open the command panel and type:

```bash
Install Playwright
```

<img width="538" alt="image" src="https://user-images.githubusercontent.com/13063165/177199115-ce90eb84-f12a-4b95-bd3a-17ff870fcec2.png"></img>

Select "Test: Install Playwright" and Choose the browsers you would like to run your tests on. These can be later configured in the [playwright.config](./test-configuration.md) file. You can also choose if you would like to have a GitHub Actions setup to run your tests on CI.



## Running Tests

You can run a single test by clicking the green triangle next to your test block to run your test. Playwright will run through each line of the test and when it finishes you will see a green tick next to your test block as well as the time it took to run the test.



<img width="750" alt="image" src="https://user-images.githubusercontent.com/13063165/182153398-101bf809-deca-40f8-9ac7-314eab2ff119.png" />

### View and Run All Tests

View all tests in the testing sidebar and extend the tests by clicking on each test. Tests that have not been run will not have the green check next to them. Run all tests by clicking on the white triangle as you hover over the tests in the testing sidebar.

<img width="755" alt="image" src="https://user-images.githubusercontent.com/13063165/182154055-6ff7af95-3787-475e-b0c0-8aa521aaa31b.png" />


### Run Tests on Specific Browsers

The VS Code test runner runs your tests on the default browser of Chrome. To run on other/multiple browsers click the play button's dropdown and choose the option of "Select Default Profile" and select the browsers you wish to run your tests on.

<img width="753" alt="image" src="https://user-images.githubusercontent.com/13063165/182154251-89f8d4f1-a9c3-42bc-9659-7db6412e96fe.png" />

## Debugging Tests

With the VS Code extension you can debug your tests right in VS Code see error messages, create breakpoints and live debug your tests.

### Error Messages

If your test fails VS Code will show you error messages right in the editor showing what was expected, what was received as well as a complete call log.

<img width="848" alt="image" src="https://user-images.githubusercontent.com/13063165/182155225-d91ec237-f69e-4ace-9a5f-a149800aba75.png" />

### Run in Debug Mode

To set a breakpoint click next to the line number where you want the breakpoint to be until a red dot appears. Run the tests in debug mode by right clicking on the line next to the test you want to run. A browser window will open and the test will run and pause at where the breakpoint is set.

<img width="847" alt="image" src="https://user-images.githubusercontent.com/13063165/182156149-f683f62d-9555-4ce2-93d2-e80de8087411.png" />


### Live Debugging

You can modify your test right in VS Code while debugging and Playwright will highlight the selector in the browser. This is a great way of seeing if the selector exits or if there is more than one result. You can step through the tests, pause the test and rerun the tests from the menu in VS Code.

<img width="858" alt="image" src="https://user-images.githubusercontent.com/13063165/182157241-c8da5eff-edbc-4ae1-80e3-8e42fa5fe659.png" />


## Generating Tests

CodeGen will auto generate your tests for you as you perform actions in the browser and is a great way to quickly get started. The viewport for the browser window is set to a specific width and height. See the [configuration guide](./test-configuration.md) to change the viewport or emulate different environments.

### Recording a Test

To record a test click on the record icon. This will create a `test-1.spec.ts` file as well as open up a browser window.


<img width="798" alt="image" src="https://user-images.githubusercontent.com/13063165/182149486-a30fbd3f-5e88-4ac2-b1df-4e33d4a893c7.png" />

### Selector Highlighting

As you interact with the page Codegen will generate the test for you in the newly created file in VS Code. When you hover over an element Playwright will highlight the element and show the [selector](./selectors.md) underneath it.

<img width="860" alt="image" src="https://user-images.githubusercontent.com/13063165/182151374-03273172-38cd-4f27-add5-cb3d3cdc7bcd.png" />



## What's next

- [Write tests using web first assertions, page fixtures and locators](./writing-tests.md)
- [See test reports](./running-tests.md#test-reports)
- [See a trace of your tests](./trace-viewer-intro.md)
