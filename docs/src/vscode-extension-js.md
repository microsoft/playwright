---
id: vscode-extension
title: "VS Code Extension"
---

# Playwright Test for VS Code

This extension integrates Playwright into your VS Code workflow. Here is what it can do:

- [Playwright Test for VS Code](#playwright-test-for-vs-code)
  - [Install Playwright](#install-playwright)
  - [Run tests with a single click](#run-tests-with-a-single-click)
  - [Run Multiple Tests](#run-multiple-tests)
  - [Show browsers](#show-browsers)
  - [Pick selectors](#pick-selectors)
  - [Debug step-by-step, explore selectors](#debug-step-by-step-explore-selectors)
  - [Tune selectors](#tune-selectors)
  - [Record new tests](#record-new-tests)
  - [Record from here](#record-from-here)
  - [Multiple folders](#multiple-folders)


<img width="1268" alt="example test in vs code" src="https://user-images.githubusercontent.com/13063165/194532498-b7f88d69-65a3-49f4-b701-5ef7134bc551.png" />

## Install Playwright

If you don't have the Playwright NPM package installed in your project, or if you are starting with a new testing project, the "Install Playwright" action from the command panel will help you get started.


<img width="1189" alt="Install Playwright" src="https://user-images.githubusercontent.com/13063165/193314391-6c1df069-857f-4fff-b4fd-5a228bd2fb5d.png"/>

Pick the browsers you'd like to use by default, don't worry, you'll be able to change them later to add or configure the browsers used. You can also choose to add a GitHub Action so that you can easily run tests on Continuous Integration on every pull request or push.

<img width="1189" alt="Choose browsers" src="https://user-images.githubusercontent.com/13063165/193314396-a32e6344-89ad-429e-a886-5367917602f3.png" />



The extension automatically detects if you have [Playwright] installed and loads the browsers, known as [Playwright] projects, into Visual Studio Code. By default it will select the first project as a run profile. Inside the test explorer in VS Code you can change this behavior to run a single test in multiple or different browsers.


![select-profile](https://user-images.githubusercontent.com/13063165/194548273-c7034777-e510-49af-9834-99e9eb528a45.gif)



## Run tests with a single click

Click the green triangle next to the test you want to run. You can also run the test from the testing sidebar by clicking the grey triangle next to the test name.


![runtest](https://user-images.githubusercontent.com/13063165/194504291-c797fab1-7ad2-47dc-8d6f-371ce22d01d7.gif)


## Run Multiple Tests

You can use the Testing sidebar to run a single test or a group of tests with a single click. While tests are running, the execution line is highlighted. Once the line has completed, the duration of each step of the test is shown.


![runtests](https://user-images.githubusercontent.com/13063165/193856188-4103cbb6-9115-42eb-aed3-d06ffc78c2cc.gif)


## Show browsers

Check the "show browsers" checkbox to run tests with the browser open so that you can visually see what is happening while your test is running. Click on "close all browsers" to close the browsers.


![show-browser](https://user-images.githubusercontent.com/13063165/194509233-b2b708cb-e7c4-48ec-b9ea-80587371bbbd.gif)


## Pick selectors

Click the "pick selectors" button and hover over the browser to see the selectors available. Clicking a selector will store it in the selectors box in VS Code. Pressing enter will save it to the clip board so you can easily paste it into your code or press the escape key to cancel.

![pick-selector](https://user-images.githubusercontent.com/13063165/194384763-96263c13-8435-425f-ba4b-6029a7c67f3d.gif)


## Debug step-by-step, explore selectors

Right click and start breakpoint debugging. Set a breakpoint and hover over a value. When your cursor is on some Playwright action or a locator, the corresponding element (or elements) are highlighted in the browser.

![debugging](https://user-images.githubusercontent.com/13063165/194526375-9d2b339e-e108-45d5-a53b-e884661c1954.gif)


## Tune selectors

You can edit the source code to fine-tune selectors while on a breakpoint. Test out different selectors and see them highlighted in the browser.


![edit-selectors](https://user-images.githubusercontent.com/13063165/194527588-5d7d1e7f-6eac-4050-8a87-ac009c221f65.gif)


## Record new tests

Record new tests by clicking on the "record tests" button in the testing sidebar. This will open a browser window where you can navigate to a URL and perform actions on the page which will be recorded to a new test file in VS Code.

![record-new2](https://user-images.githubusercontent.com/13063165/194530684-2f8b89b4-8973-4ae7-a327-27ec51fc6d51.gif)


## Record from here

Record a new test snippet. This creates a new empty test file but the recording starts from the current browser state from the previous test instead of starting a new browser. This snippet can then be pasted into a previous test file so it can be properly run.

## Multiple folders

If you have multiple folders in your workspace each with their own `playwright.config.js` file, you can choose which profile to use for the current test file by clicking the "select configuration" dropdown in the testing sidebar. This will open a dropdown showing all projects that are set in each config file of each folder. Click on any of profiles to see the current test run with that profile.

<img width="1204" alt="selecting a profile to run your test on" src="https://user-images.githubusercontent.com/13063165/197599427-26599bc3-6b82-4517-899c-b257e2a4bc24.png" />

You can set the default profiles for each folder by clicking on the "select configuration" dropdown and clicking "Select Default profile". Any time you run a test it will run with the selected profile for that folder. If you selected more than one then it will run on all profiles selected.

<img width="1204" alt="Screenshot 2022-10-24 at 20 33 41" src="https://user-images.githubusercontent.com/13063165/197601568-769338d5-19ee-459e-9722-ad9a978664d0.png" />


You can select all profiles and run all your tests for each folder by clicking the run tests icon next to the dropdown selector. This will run all the tests in all your folders with all the profiles selected for each folder.

<img width="969" alt="Screenshot 2022-10-24 at 21 06 17" src="https://user-images.githubusercontent.com/13063165/197605788-1ff3132a-0283-4b71-946c-b8aec9d79757.png" />



[Playwright]: https://playwright.dev "Playwright"
