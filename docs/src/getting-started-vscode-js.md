---
id: getting-started-vscode
title: "Getting started (VSCode)"
---

## Installation

This guide is for anyone who wants to use Playwright with the VS Code extension. If you prefer to install using the CLI then please see the [Getting Started (CLI)](/) docs.

### Install the VS Code Extension

Install the VS Code extension from the [marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright).

<img width="535" alt="image" src="https://user-images.githubusercontent.com/13063165/177198887-de49ec12-a7a9-48c2-8d02-ad53ea312c91.png"></img>

### Install Playwright

Open the command panel in VSCode (cmd/ctrl + shift + p) and type "Install Playwright and select "Test: Install Playwright".

<img width="538" alt="image" src="https://user-images.githubusercontent.com/13063165/177199115-ce90eb84-f12a-4b95-bd3a-17ff870fcec2.png"></img>

### Choose the Browsers

Pick the browsers you'd like to run your tests on. These can be configured later in the `playwright.config.ts` file.

<img width="536" alt="image" src="https://user-images.githubusercontent.com/13063165/177199008-a71248c6-48b8-4e2d-8000-481f3c35191b.png" />


### What's Installed

You should now have the following files and folders installed:

<img width="373" alt="image" src="https://user-images.githubusercontent.com/13063165/177196704-a05649b7-d27c-4d84-8b17-fc0736f1785a.png"></img>


## Generating Tests with Codegen

Codegen will auto generate your tests for you and is a great way to quickly get started. You can also write your tests manually if you prefer.

### Starting the Recording

Clik on the Testing icon in the left menu. This will open the testing sidebar. Click on the record icon, the first icon at the top of the testing sidebar. This will create a `test-1.spec.ts` file with an import and a test block. As you record your user actions your test code will be generated here.

<img width="810" alt="image" src="https://user-images.githubusercontent.com/13063165/177197869-40b32235-ae7c-4a6e-8b7e-e69aea17ea1b.png"></img>

### Recording User Actions

In the browser window that was launched type the URL "playwright.dev" and click enter. Then click on the "get started" button. 

<img width="958" alt="image" src="https://user-images.githubusercontent.com/13063165/177199982-42dc316f-3438-48b1-a6a6-417be77be658.png"></img>

Then click on the "get started" button. Then click on the Getting Started text.

<img width="956" alt="image" src="https://user-images.githubusercontent.com/13063165/177200382-8945a369-da5a-402e-9b7c-e6e793b810fe.png"></img>

### Stopping the Recording

Press the cancel button in VS Code to stop the recording or close the browser window.

<img width="401" alt="image" src="https://user-images.githubusercontent.com/13063165/177200122-7504b4f7-fb9e-427c-b392-a4109f41591b.png"></img>

### Generated Test

You should now having the following code in your test.spec.ts file:

```js title="test.spec.ts"
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {

  // Go to https://playwright.dev/
  await page.goto('https://playwright.dev/');

  // Click text=Get started
  await page.locator('text=Get started').click();
  await expect(page).toHaveURL('https://playwright.dev/docs/intro');

  // Click h1:has-text("Getting started")
  await page.locator('h1:has-text("Getting started")').click();

});
```

## Running the Tests

Click the triangle next to line 3 to run your tests.

<img width="813" alt="image" src="https://user-images.githubusercontent.com/13063165/177201109-e0a17553-88cc-496e-a717-9a60247db935.png"></img>

Playwright will quickily hover over each line of the test until it finishes running and you will then see a green tick on line 3. You will also see the time the the tests took to run. In the sidebar you can extend the tests by clicking on it. This will show you the tests for your generated test as well as the example test which has not been run therefore it is not in green. 


<img width="812" alt="image" src="https://user-images.githubusercontent.com/13063165/177201231-f26e11da-2860-43fa-9a31-b04bba55d52e.png" />

You can rerun a single test or all tests by clicking on the triangle as you hover over each of the tests in the sidebar.

### Running Tests on multiple browsers

The VS Code test runner runs your tests on the default browser of Chrome. To run on other/multiple browsers click the play button's dropdown and choose the option of "Select Default Profile" and select the browsers you wish to run your tests on.

<img width="814" alt="image" src="https://user-images.githubusercontent.com/13063165/177201716-e4392930-13af-49f0-b60d-be6381ce645d.png" />

## Debugging Tests

You can debug your tests right in VS Code. VS Code comes with some great error hanlding to help point you in the right direction when your tests fail.

### Failing Tests

On line 9 of your test change the button text from "Getting Started" to "Hello" and rerun the test to see it fail.

<img width="880" alt="image" src="https://user-images.githubusercontent.com/13063165/177202555-fed3c9a8-215c-46b1-9545-dfc712a9e21c.png"></img>

### Debugging Tests

Create a breakpoint by clicking next to the line number so a red dot appears. To run the tests in debug mode click on the red circled x on line 3 and select "debug test" from the menu.

<img width="880" alt="image" src="https://user-images.githubusercontent.com/13063165/177202631-114855cd-15ba-4040-997b-74ed5b8f0a2d.png"/>

The browser will open and be paused on 9 line. You can now change the text in your test file back to the word "Get Started" and you will see Playwright highlighting the text of the button in the browser as it can now find a text that exists on the page.

<img width="879" alt="image" src="https://user-images.githubusercontent.com/13063165/177202732-ab847173-09f1-4f58-b706-29060009891d.png"></img>


Use the menu at the top of the page to step through the tests, pause the tests, rerun the tests etc. 

To remove the breakpoint click on the red dot next to line 9 so it disappears.


## HTML Reporter

To sort tests by browsers and see a rull report you will need to manually run your tests using the CLI.

```bash	
npx playright test
```

Once the tests have finished run the folling command to open the reporter.

```bash
npx playright report
```

## Running on CI

At the moment we are just running our tests locally but you can run your tests on CI on each pull request thanks to the GitHub actions we setup earlier. Tests can be run on a local machine or on a staging URL. For more info see...
