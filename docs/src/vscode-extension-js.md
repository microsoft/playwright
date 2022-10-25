---
id: vscode-extension
title: "VS Code Extension"
---

# Playwright VS Code Extension

Install the Playwright VS Code extension from the extensions panel in VS Code or from the [marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright). With the extension you can easily install Playwright and run tests right from your editor. From the testing panel, see all tests, run individual tests or multiple tests as well as run tests across multiple folders. The extension gives you the option to show browsers when running tests, run tests in debug mode, pick selectors and record a new test as well as set the default profile to run and debug tests on.

<img width="1100" alt="VS Code extension for Playwright" src="https://user-images.githubusercontent.com/13063165/197744119-5ed72385-2037-450b-b988-83b2f7554cf1.png" />

## Install Playwright

If you don't have the Playwright NPM package installed in your project, or if you are starting with a new testing project, the "Install Playwright" action from the command panel will help you get started.

<img width="1100" alt="Install Playwright" src="https://user-images.githubusercontent.com/13063165/197744677-edd437e7-15b2-4e3a-8c6b-e728cfe7b65c.png" />

Pick the browsers you'd like to install and configure. These can be changed later in the `playwright.config.js` file. Choose to add a GitHub Action so that tests run on Continuous Integration on every pull request or push.

<img width="1115" alt="Choose Browsers" src="https://user-images.githubusercontent.com/13063165/197704489-72744c50-81ea-4716-a5f1-52ca801edf1f.png" />

## Running Tests

Click the green triangle next to the test you want to run. While tests are running, the execution line is highlighted. Once the line has completed, the duration of each step of the test is shown.

<img width="1114" alt="Run a single test" src="https://user-images.githubusercontent.com/13063165/197712138-f4593c0d-ec7e-4a61-b2cd-59fc2af39c6a.png" />

### Run Multiple Tests

Use the Testing panel to run a single test or a group of tests by clicking the grey triangle next to the tests folder name to run all tests in that folder, or the test file name to run all tests in that file or test name to run a single test. 

<img width="1114" alt="Run all tests in file" src="https://user-images.githubusercontent.com/13063165/197712455-496f5300-79ed-4eae-9cc1-52cc9f3c019b.png" />

### Run Tests on a specific profile

Select a profile from the dropdown and run your test on that profile.

<img width="956" alt="Select Profile" src="https://user-images.githubusercontent.com/13063165/197705523-04f03905-ec2a-4dad-ba11-81f2c565ee89.png" />

### Selecting Default Profiles

The extension automatically detects if you have [Playwright] installed and loads the browsers, known as [Playwright] projects, into Visual Studio Code. By default it will select the first project as a run profile. Inside the test explorer in VS Code you can change this behavior to run tests in a different browser by clicking on the "Select Configuration" dropdown and clicking the "Select Default Profile" option

<img width="1116" alt="selecting browsers" src="https://user-images.githubusercontent.com/13063165/197728519-5381efc0-30d4-490e-82a8-e43eb35daf9f.png" />


Select a profile to set it as the default. Once selected all tests will then run using this profile. Choose various or all profiles to run tests on multiple profiles. These profiles are read from the `playwright.config.js` file. To add more profiles such as a mobile profile, first add it to your `playwright.config.js` file and it will then be available here.

<img width="956" alt="Select default profile" src="https://user-images.githubusercontent.com/13063165/197706221-0aafcc64-681d-459e-913a-1440e6181468.png" />

### Multiple Folders

When working with multiple folders in your workspace each with their own `playwright.config.js` file, choose which profile to use for the current test file by clicking the "select configuration" dropdown in the testing sidebar. This will open a dropdown showing all projects that are set in each config file of each folder. Any time you run a test it will run with the selected profile for that folder. If you select more than one default then it will run on all profiles selected.

<img width="1012" alt="choosing default profiles" src="https://user-images.githubusercontent.com/13063165/197710323-ec752f91-86c5-45c8-81b3-eac2e8ed0bfb.png" />

Select all default profiles and run all your tests for each folder by clicking the run tests icon next to the dropdown selector. This will run all the tests in all your folders with all the profiles selected for each folder.

<img width="1009" alt="Running tests on all profiles" src="https://user-images.githubusercontent.com/13063165/197711031-44bb9886-fb2a-47cb-adbe-19a75201ff32.png" />

### Run a test on a Specific Profile

Click on any of the profiles from any of the folders to see the current test run with that profile.

<img width="969" alt="multiple folders selecting profile" src="https://user-images.githubusercontent.com/13063165/197709233-eb71180a-94a8-4462-8333-857039530e66.png" />

### Show Browsers

Check the "show browsers" checkbox to run tests with the browser open so that you can visually see what is happening while your test is running. Click on "close all browsers" to close the browsers.

<img width="1350" alt="Show browsers while running tests" src="https://user-images.githubusercontent.com/13063165/197714311-1d8c0955-9c5b-44ec-b429-160fa3d6b7a4.png" />

## Pick Selectors

Click on "pick selectors" from the testing panel and hover over the browser to see the available selectors. Clicking a selector will store it in the selectors box in VS Code. Pressing enter will save it to the clipboard so you can paste it into your code, or press the escape key to cancel.

<img width="1394" alt="Pick selectors" src="https://user-images.githubusercontent.com/13063165/197714946-cb82231d-a6f8-4183-b54b-3375ffaa7092.png" />

## Debugging Tests

Right click and start breakpoint debugging. Set a breakpoint and hover over a value. When your cursor is on some Playwright action or a locator, the corresponding element (or elements) are highlighted in the browser.

<img width="1149" alt="setting debug test mode" src="https://user-images.githubusercontent.com/13063165/197715919-98f32957-2ae1-478b-9588-d93cc4548c67.png" />

Easily set and remove breakpoints and toggle breakpoints on and off.

<img width="1221" alt="VS Code debugging" src="https://user-images.githubusercontent.com/13063165/197736979-c5da604d-6325-403f-8147-132843db49ee.png" />

Edit the source code to fine-tune selectors while on a breakpoint. Test out different selectors and see them highlighted in the browser.

<img width="1350" alt="tuning selectors" src="https://user-images.githubusercontent.com/13063165/197716993-c7a2c5fa-ad4c-4b66-a9b7-5a96a120ccc1.png" />

Debug your tests on specific profiles by selecting a profile from the dropdown. Set the default profile to debug always on this profile. Selecting more than one profile to debug various profiles. Playwright will launch the first profile and once finished debugging it will then launch the next one.

<img width="1221" alt="debugging on specific profile" src="https://user-images.githubusercontent.com/13063165/197738552-06aa8a83-6a6b-4aad-ab23-d449640e1f5f.png" />

To learn more about debugging, see [Debugging in Visual Studio Code](https://code.visualstudio.com/docs/editor/debugging).

## Record New Tests

Record new tests by clicking on the "record tests" button in the testing sidebar. This will open a browser window where you can navigate to a URL and perform actions on the page which will be recorded to a new test file in VS Code.

<video width="100%" height="100%" controls muted>
  <source src="https://user-images.githubusercontent.com/13063165/197721416-e525dd60-51a6-4740-ad8b-0f56f4d20045.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

### Record From Here

Record a new test snippet. This creates a new empty test file but the recording starts from the current browser state from the previous test instead of starting a new browser. This snippet can then be pasted into a previous test file so it can be properly run. Note in the example below the test starts from the last state of a previous test and therefore has no `page.goto()` action.


<img width="1392" alt="record a test from a specific browser state" src="https://user-images.githubusercontent.com/13063165/197740755-fa845cbb-6292-44a4-8134-af1ce15f438a.png" />
## Reveal Test Output

Use this option to reveal the test output in the terminal. This can be really helpful when running tests in headless mode on multiple profiles.

<img width="1352" alt="Reveal Test Output" src="https://user-images.githubusercontent.com/13063165/197724312-28677ac0-2225-4a08-a108-e32922fd94ca.png" />

[Playwright]: https://playwright.dev "Playwright"
