---
id: test-ui-mode
title: "UI Mode"
---

import LiteYouTube from '@site/src/components/LiteYouTube';

## Introduction

UI Mode lets you explore, run and debug tests with a time travel experience complete with watch mode. All test files are loaded into the testing sidebar where you can expand each file and describe block to individually run, view, watch and debug each test. Filter tests by **text** or **@tag** or by **passed**, **failed** and **skipped** tests as well as by [**projects**](./test-projects) as set in your `playwright.config` file. See a full trace of your tests and hover back and forward over each action to see what was happening during each step and pop out the DOM snapshot to a separate window for a better debugging experience.

<LiteYouTube
    id="d0u6XhXknzU"
    title="Playwrights UI Mode"
/>

## Opening UI Mode

To open UI mode, run the following command in your terminal:

  ```bash
  npx playwright test --ui
  ```
## Running your tests

Once you launch UI Mode you will see a list of all your test files. You can run all your tests by clicking the triangle icon in the sidebar. You can also run a single test file, a block of tests or a single test by hovering over the name and clicking on the triangle next to it. 

![running tests in ui mode](https://github.com/microsoft/playwright/assets/13063165/6b87712f-64a5-4d73-a91d-6562b864712c)

## Filtering tests

Filter tests by text or `@tag` or by passed, failed or skipped tests. You can also filter by [projects](./test-projects) as set in your `playwright.config` file. If you are using project dependencies make sure to run your setup tests first before running the tests that depend on them. The UI mode will not take into consideration the setup tests and therefore you will have to manually run them first.

![filtering tests in ui mode](https://github.com/microsoft/playwright/assets/13063165/6f05e589-036d-45d5-9078-38134e1261e4)


## Timeline view

At the top of the trace you can see a timeline view of your test with different colors to highlight navigation and actions. Hover back and forth to see an image snapshot for each action. Double click on an action to see the time range for that action. You can use the slider in the timeline to increase the actions selected and these will be shown in the Actions tab and all console logs and network logs will be filtered to only show the logs for the actions selected.

![timeline view in ui mode](https://github.com/microsoft/playwright/assets/13063165/811a9985-32aa-4a3e-9869-de32053cf468)


## Actions

In the Actions tab you can see what locator was used for every action and how long each one took to run. Hover over each action of your test and visually see the change in the DOM snapshot. Go back and forward in time and click an action to inspect and debug. Use the Before and After tabs to visually see what happened before and after the action. 
![use before and after actions in ui mode](https://github.com/microsoft/playwright/assets/13063165/7b22fab5-7346-4b98-8fdd-a78ed280647f)

## Pop out and inspect the DOM

Pop out the DOM snapshot into its own window for a better debugging experience by clicking on the pop out icon above the DOM snapshot. From there you can open the browser DevTools and inspect the HTML, CSS, Console etc. Go back to UI Mode and click on another action and pop that one out to easily compare the two side by side or debug each individually.

![pop out dom snapshot in ui mode](https://github.com/microsoft/playwright/assets/13063165/f9f43a0c-78d7-4574-9a58-c69d2ec53c8f)

## Pick locator

Click on the pick locator button and hover over the DOM snapshot to see the locator for each element highlighted as you hover. Click on an element to add the locator playground. You can modify the locator in the playground and see if your modified locator matches any locators in the DOM snapshot. Once you are satisfied with the locator you can use the copy button to copy the locator and paste it into your test.

![pick locator in ui mode](https://github.com/microsoft/playwright/assets/13063165/9e7eeb84-bd26-4010-8614-75e24b56c716)

## Source

As you hover over each action of your test the line of code for that action is highlighted in the source panel.

![showing source code of tests in ui mode](https://github.com/microsoft/playwright/assets/13063165/49b9fa2a-8a57-4044-acaa-0a2ea4784c5c)

## Call

The call tab shows you information about the action such as the time it took, what locator was used, if in strict mode and what key was used.

![showing call tab in ui mode](https://github.com/microsoft/playwright/assets/13063165/442314c3-0b16-4400-bf25-c198f8654849)

## Log

See a full log of your test to better understand what Playwright is doing behind the scenes such as scrolling into view, waiting for element to be visible, enabled and stable and performing actions such as click, fill, press etc.

![showing log of tests in ui mode](https://github.com/microsoft/playwright/assets/13063165/1d214ee5-2c07-414d-a342-f88d0864ac89)

## Errors

If your test fails you will see the error messages for each test in the Errors tab. The timeline will also show a red line highlighting where the error occurred. You can also click on the source tab to see on which line of the source code the error is.

![showing errors in ui mode](https://github.com/microsoft/playwright/assets/13063165/ffca2fd1-5349-41fb-ade9-ace143bb2c58)

## Console

See console logs from the browser as well as from your test. Different icons are displayed to show you if the console log came from the browser or from the test file.

![showing console logs from tests in ui mode](https://github.com/microsoft/playwright/assets/13063165/b6a44763-da04-4152-bbac-3369ca4a60ac)

## Network

The Network tab shows you all the network requests that were made during your test. You can sort by different types of requests, status code, method, request, content type, duration and size. Click on a request to see more information about it such as the request headers, response headers, request body and response body.

![showing network requests from tests in ui mode](https://github.com/microsoft/playwright/assets/13063165/946c2722-447a-4005-9518-b4e9b73a8240)

## Attachments

The "Attachments" tab allows you to explore attachments. If you're doing [visual regression testing](./test-snapshots.md), you'll be able to compare screenshots by examining the image diff, the actual image and the expected image. When you click on the expected image you can use the slider to slide one image over the other so you can easily see the differences in your screenshots.

![ui mode with attachments](https://github.com/microsoft/playwright/assets/13063165/bb83b406-84ed-4380-a96c-0e62d1388093)

## Metadata

Next to the Actions tab you will find the Metadata tab which will show you more information on your test such as the Browser, viewport size, test duration and more.

![metadata tab in ui mode](https://github.com/microsoft/playwright/assets/13063165/befff46e-381a-41c2-8259-e47442add425)

## Watch mode

Next to the name of each test in the sidebar you will find an eye icon. Clicking on the icon will activate watch mode which will re-run the test when you make changes to it. You can watch a number of tests at the same time be clicking the eye icon next to each one or all tests by clicking the eye icon at the top of the sidebar. If you are using VS Code then you can easily open your test by clicking on the file icon next to the eye icon. This will open your test in VS Code right at the line of code that you clicked on.

![watch mode in ui mode](https://github.com/microsoft/playwright/assets/13063165/20d7d44c-b52d-43ff-8871-8b828671f3da)

## Docker & GitHub Codespaces

For Docker and GitHub Codespaces environments, you can run UI mode in the browser. In order for an endpoint to be accessible outside of the container, it needs to be bound to the `0.0.0.0` interface:

```bash
npx playwright test --ui-host=0.0.0.0
```

In the case of GitHub Codespaces, the port gets [forwarded automatically](https://docs.github.com/en/codespaces/developing-in-codespaces/forwarding-ports-in-your-codespace#about-forwarded-ports), so you can open UI mode in the browser by clicking on the link in the terminal.

To have a static port, you can pass the `--ui-port` flag:

```bash
npx playwright test --ui-port=8080 --ui-host=0.0.0.0
```

:::note
Be aware that when specifying the `--ui-host=0.0.0.0` flag, UI Mode with your traces, the passwords and secrets is accessible from other machines inside your network. In the case of GitHub Codespaces, the ports are only accessible from your account by default.
:::
