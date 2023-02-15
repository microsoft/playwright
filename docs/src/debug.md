---
id: debug
title: "Debugging Tests"
---

## VS Code debugger
* langs: js

We recommend using the [VS Code Extension](./getting-started-vscode.md) for debugging for a better developer experience. With the VS Code extension you can debug your tests right in VS Code, see error messages, set breakpoints and live debug your tests.

<img width="1269" alt="running test in debug mode" src="https://user-images.githubusercontent.com/13063165/212740233-3f278825-13e7-4a88-a118-dd4478d43a16.png" />

### Error Messages

If your test fails VS Code will show you error messages right in the editor showing what was expected, what was received as well as a complete call log.

<img width="1269" alt="error messaging in vs code" src="https://user-images.githubusercontent.com/13063165/212738654-b573b7c9-05be-476f-ab4c-201bf4265bc0.png" />

### Live Debugging

You can debug your test live in VS Code. After running a test with the `Show Browser` option checked, click on any of the locators in VS Code and it will be highlighted in the Browser window. Playwright will highlight it if it exits and show you if there is more than one result

<img width="1394" alt="live debugging in VS Code" src="https://user-images.githubusercontent.com/13063165/212884329-0755b007-0d69-4987-b084-38fd5bfb577d.png" />

You can also edit the locators in VS Code and Playwright will show you the changes live in the browser window.

<img width="1394" alt="live debugging in VS Code" src="https://user-images.githubusercontent.com/13063165/212884772-5022d4b1-6fab-456f-88e3-506f2354e238.png" />

### Picking a Locator

Pick a [locator](./locators.md) and copy it into your test file by clicking the **Pick locator** button form the testing sidebar. Then in the browser click the element you require and it will now show up in the **Pick locator** box in VS Code. Press 'enter' on your keyboard to copy the locator into the clipboard and then paste anywhere in your code. Or press 'escape' if you want to cancel.

<img width="1394" alt="Pick locators" src="https://user-images.githubusercontent.com/13063165/212741666-6479a702-2517-44a3-9eca-e719e13b379c.png" />

Playwright will look at your page and figure out the best locator, prioritizing [role, text and test id locators](./locators.md). If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

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


## Playwright Inspector

The Playwright Inspector is a GUI tool to help you debug your Playwright tests. It allows you to step through your tests, live edit locators, pick locators and see actionability logs.

<img width="864" alt="Playwright Inspector" src="https://user-images.githubusercontent.com/13063165/212924587-4b84e5f6-b147-40e9-8c75-d7b9ab6b7ca1.png" />

### Run in debug mode
* langs: js

Run your tests with the `--debug` flag to open the inspector. This configures Playwright for debugging and opens the inspector. Additional useful defaults are configured when `--debug` is used:

- Browsers launch in headed mode
- Default timeout is set to 0 (= no timeout)

#### Debug all tests on all browsers

To debug all tests run the test command with the `--debug` flag. This will open the inspector and a browser window for each test and each browser. After stepping through the first test the inspector and browser window will close and the next test will run opening the inspector and a new browser window. Once all tests have finished running on the first browser configured in your [`playwright.config`](/test-configuration.md#multiple-browsers), the inspector and browser window will close and the next browser will open.

```bash
npx playwright test --debug
```
#### Debug one test on all browsers

To debug one test on a specific line run the test command followed by the name of the test file and the line number of the test you want to debug, followed by the `--debug` flag. This will open a browser window for each browser configured in your [`playwright.config`](/test-configuration.md#multiple-browsers) so you can debug a specific test on each browser.

```bash
npx playwright test example.spec.ts:10 --debug
```
#### Debug on a specific browser

In Playwright you can configure projects in your [`playwright.config`](/test-configuration.md#multiple-browsers) for major browsers such as Chromium, Firefox and Safari, branded browsers such as Google Chrome and Edge and mobile viewports such as Mobile Safari on an iPhone 12 or Mobile Chrome on a Pixel 5. For a full list of devices check out the [registry of device parameters](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/deviceDescriptorsSource.json).

```ts
const config: PlaywrightTestConfig = {
/* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },

    /* Test against mobile viewports. */
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
      },
    },

    /* Test against branded browsers. */
    {
      name: 'Microsoft Edge',
      use: {
        channel: 'msedge',
      },
    },
  ],
};
```

Once configured you can then debug your tests on a specific browser or mobile viewport using the `--project` flag followed by the name of the project configured in your `playwright.config`.

```bash
npx playwright test --project=chromium --debug
npx playwright test --project="Mobile Safari" --debug
npx playwright test --project="Microsoft Edge" --debug
```

#### Debug one test on a specific browser

To run one test on a specific browser add the name of the test file and the line number of the test you want to debug as well as the `--project` flag followed by the name of the project.

```bash
npx playwright test example.spec.ts:10 --project=webkit --debug
```
### Run in debug mode
* langs: csharp, java, python

Set the `PWDEBUG` environment variable to run your Playwright tests in debug mode. This
configures Playwright for debugging and opens the inspector. Additional useful defaults are configured when `PWDEBUG=1` is set:

- Browsers launch in headed mode
- Default timeout is set to 0 (= no timeout)


```bash tab=bash-bash lang=java
# Source directories in the list are separated by : on macos and linux and by ; on win.
PWDEBUG=1 PLAYWRIGHT_JAVA_SRC=<java source dirs> mvn test
```

```batch tab=bash-batch lang=java
# Source directories in the list are separated by : on macos and linux and by ; on win.
set PLAYWRIGHT_JAVA_SRC=<java source dirs>
set PWDEBUG=1
mvn test
```

```powershell tab=bash-powershell lang=java
# Source directories in the list are separated by : on macos and linux and by ; on win.
$env:PLAYWRIGHT_JAVA_SRC="<java source dirs>"
$env:PWDEBUG=1
mvn test
```

```bash tab=bash-bash lang=python
PWDEBUG=1 pytest -s
```

```batch tab=bash-batch lang=python
set PWDEBUG=1
pytest -s
```

```powershell tab=bash-powershell lang=python
$env:PWDEBUG=1
pytest -s
```

```bash tab=bash-bash lang=csharp
PWDEBUG=1 dotnet test
```

```batch tab=bash-batch lang=csharp
set PWDEBUG=1
dotnet test
```

```powershell tab=bash-powershell lang=csharp
$env:PWDEBUG=1
dotnet test
```

### Stepping through your tests

You can play, pause or step through each line of your test using the toolbar at the top of the Inspector. Underneath the toolbar the code of your test is shown and as you step through each line, the line of code that is being run is highlighted in the Inspector as well as in the browser window.

<img width="1340" alt="Playwright Inspector and browser" src="https://user-images.githubusercontent.com/13063165/212936618-84b87acc-bc2e-46ed-994b-32b2ef742e60.png" />

### Run a test from a specific breakpoint

To speed up the debugging process you can add a [`method: Page.pause`] method to your test. This way you won't have to step through each action of your test to get to the point where you want to debug.

```js
await page.pause();
```

```java
page.pause();
```

```python async
await page.pause()
```

```python sync
page.pause()
```

```csharp
await page.PauseAsync();
```

Once `page.pause()` is set, you can then run your tests in debug mode and the Playwright inspector will open as well as the browser and your test will run and pause on the line where you called `page.pause()`.

### Live editing locators

While running in debug mode you can live edit the locators. Next to the 'Pick Locator' button there is a field showing the [locator](./locators.md) that the test is paused on. You can edit this locator directly in the **Pick Locator** field. As you edit the locator you will see in the browser window the element the locator refers to and highlighted below it you can see the code needed to locate this element. If more than one element is found for that locator it will show you how many have been found. This allows you to easily tweak and improve your locators.

<img width="1348" alt="live editing locators" src="https://user-images.githubusercontent.com/13063165/212980815-1cf6ef7b-e69a-496c-898a-ec603a3bc562.png" />

### Picking locators

While debugging you might need to choose a more resilient locator. You can do this by clicking on the **Pick Locator** button and hovering over any element in the browser window. While hovering over an element you will see the code needed to locate this element highlighted below. Clicking an element in the browser will add the locator into the field where you can then either tweak it or copy it into your code.

<img width="1392" alt="Picking locators" src="https://user-images.githubusercontent.com/13063165/212968640-ce82a027-9277-4bdf-b0a9-6282fb2becb7.png" />

### Actionability logs

By the time Playwright has paused on a click action, it has already performed [actionability checks](./actionability.md) that can be found in the log. This can help you understand what happened during your test and what Playwright did or tried to do. The log tells you if the element was visible, enabled and stable, if the locator resolved to an element, scrolled into view, and so much more. If actionability can't be reached, it will show the action as pending.

<img width="883" alt="Actionability Logs" src="https://user-images.githubusercontent.com/13063165/212968907-5dede739-e0e3-482a-91cd-726a0f5b0b6d.png" />

## Browser Developer Tools

You can use browser developer tools in Chromium, Firefox and WebKit while running
a Playwright script in headed mode. Developer tools help to:

- Inspect the DOM tree and **find element selectors**
- **See console logs** during execution (or learn how to [read logs via API](./api/class-page.md#page-event-console))
- Check **network activity** and other developer tools features

<a href="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png"><img src="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png" width="500" alt="Chromium Developer Tools"></img></a>

Using a [`method: Page.pause`] method is an easy way to pause the Playwright script execution
and inspect the page in Developer tools. It will also open Playwright Inspector to help with debugging.

:::note
**For WebKit**: launching WebKit Inspector during the execution will
prevent the Playwright script from executing any further.
:::

## Headed mode

Playwright runs browsers in headless mode by default. To change this behavior,
use `headless: false` as a launch option. You can also use the [`option: slowMo`] option
to slow down execution (by N milliseconds per operation) and follow along while debugging.

```js
await chromium.launch({ headless: false, slowMo: 100 }); // or firefox, webkit
```

```java
chromium.launch(new BrowserType.LaunchOptions() // or firefox, webkit
  .setHeadless(false)
  .setSlowMo(100));
```

```python async
await chromium.launch(headless=False, slow_mo=100) # or firefox, webkit
```

```python sync
chromium.launch(headless=False, slow_mo=100) # or firefox, webkit
```

```csharp
// Chromium, Firefox, or Webkit
await using var browser = await playwright.Chromium.LaunchAsync(new()
{
    Headless = false,
    SlowMo = 100
});
```


