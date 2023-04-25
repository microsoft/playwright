---
id: test-ui-mode
title: "UI Mode"
---

import LiteYouTube from '@site/src/components/LiteYouTube';

UI Mode let's you explore, run and debug tests with a time travel experience complete with watch mode. All test files are loaded into the testing sidebar where you can expand each file and describe block to individually run, view, watch and debug each test. Filter tests by **text** or **@tag** or by **passed**, **failed** and **skipped** tests as well as by [**projects**](./test-projects) as set in your `playwright.config` file. See a full trace of your tests and hover back and forward over each action to see what was happening during each step and pop out the DOM snapshot to a separate window for a better debugging experience.

<LiteYouTube
    id="d0u6XhXknzU"
    title="Playwrights UI Mode"
/>

## Running tests in UI Mode

To open UI mode, run the following command:

  ```bash
  npx playwright test --ui
  ```

### Filtering tests

Filter tests by text or `@tag` or by passed, failed or skipped tests. You can also filter by [projects](./test-projects) as set in your `playwright.config` file. If you are using project dependencies make sure to run your setup tests first before running the tests that depend on them. The UI mode will not take into consideration the setup tests and therefore you will have to manually run them first.

![filtering tests in ui mode](https://user-images.githubusercontent.com/13063165/234307854-adb49634-a588-4ea7-aa0e-2c31e845caf9.png)

### Running your tests

Once you launch UI Mode you will see a list of all your test files. You can run all your tests by clicking the triangle icon in the sidebar. You can also run a single test file, a block of tests or a single test by hovering over the name and clicking on the triangle next to it. 

![running tests in ui mode](https://user-images.githubusercontent.com/13063165/234280447-684d4bff-61bd-4a07-881d-e687af8832c7.png)

### Viewing test traces

Traces are shown for each test that has been run, so to see the trace, click on one of the test names. Note that you won't see any trace results if you click on the name of the test file or the name of a describe block.

![running tests in ui mode and visually seeing a trace](https://user-images.githubusercontent.com/13063165/234294773-d643a2b4-8c3a-4cb1-aca4-11327d3654c1.png)

### Actions and metadata

In the Actions tab you can see what locator was used for every action and how long each one took to run. Hover over each action of your test and visually see the change in the DOM snapshot. Go back and forward in time and click an action to inspect and debug. Use the Before and After tabs to visually see what happened before and after the action. Next to the Actions tab you will find the Metadata tab which will show you more information on your test such as the Browser, viewport size, test duration and more.

![use before and after actions in ui mode](https://user-images.githubusercontent.com/13063165/234294652-b32f7c74-6df3-4152-95e3-810e928562a2.png)

### Source, console, log and network

As you hover over each action of your test the source code for the test is highlighted below. Click on the source tab to see the source code for the entire test. Click on the console tab to see the console logs for each action. Click on the log tab to see the logs for each action. Click on the network tab to see the network logs for each action.

![showing log of tests in ui mode](https://user-images.githubusercontent.com/13063165/234323603-3d9a152d-f9fc-48d8-82d2-26c8c1866abb.png)

### Pop out and inspect the DOM

Pop out the DOM snapshot into it's own window for a better debugging experience by clicking on the pop out icon above the DOM snapshot. From there you can open the browser DevTools and inspect the HTML, CSS, Console etc. Go back to UI Mode and click on another action and pop that one out to easily compare the two side by side or debug each individually.

![pop out dom snapshot](https://user-images.githubusercontent.com/13063165/234293178-4754c4a1-880d-46bc-971c-f85ef2672eff.png)


### Timeline view

At the top of the trace you can see a timeline view of each action of your test. Hover back and forth to see an image snapshot for each action.

![timeline view in ui mode](https://user-images.githubusercontent.com/13063165/234295914-f7ee3d8b-33a7-41b3-bc91-d363baaa7305.png)


### Pick locator

Click on the pick locator button and hover over the DOM snapshot to see the locator for each element highlighted as you hover. Click on an element to save the locator into the pick locator field. You can then copy the locator and paste it into your test.

![pick locator in ui mode](https://user-images.githubusercontent.com/13063165/234297860-35722199-3ddc-4c53-a37e-1858be045720.png)

### Watch mode

Next to the name of each test in the sidebar you will find an eye icon. Clicking on the icon will activate watch mode which will re-run the test when you make changes to it. You can watch a number of tests at the same time be clicking the eye icon next to each one or all tests by clicking the eye icon at the top of the sidebar. If you are using VS Code then you can easily open your test by clicking on the file icon next to the eye icon. This will open your test in VS Code right at the line of code that you clicked on.

![watch mode in ui mode](https://user-images.githubusercontent.com/13063165/234304918-dd0fb6d5-bfb1-4182-8c55-33cd3da5f83e.png)