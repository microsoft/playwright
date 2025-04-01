---
id: debug
title: "Debugging Tests"
---

## VS Code debugger
* langs: js

We recommend using the [VS Code Extension](./getting-started-vscode.md) for debugging for a better developer experience. With the VS Code extension you can debug your tests right in VS Code, see error messages, set breakpoints and step through your tests.

<img width="1269" alt="running test in debug mode" src="https://user-images.githubusercontent.com/13063165/212740233-3f278825-13e7-4a88-a118-dd4478d43a16.png" />

### Error Messages

If your test fails VS Code will show you error messages right in the editor showing what was expected, what was received as well as a complete call log.

<img width="1269" alt="error messaging in vs code" src="https://user-images.githubusercontent.com/13063165/212738654-b573b7c9-05be-476f-ab4c-201bf4265bc0.png" />

### Live Debugging

You can debug your test live in VS Code. After running a test with the `Show Browser` option checked, click on any of the locators in VS Code and it will be highlighted in the Browser window. Playwright will also show you if there are multiple matches.

<img width="1394" alt="live debugging in VS Code" src="https://user-images.githubusercontent.com/13063165/212884329-0755b007-0d69-4987-b084-38fd5bfb577d.png" />

You can also edit the locators in VS Code and Playwright will show you the changes live in the browser window.

<img width="1394" alt="live debugging in VS Code" src="https://user-images.githubusercontent.com/13063165/212884772-5022d4b1-6fab-456f-88e3-506f2354e238.png" />

### Picking a Locator

Pick a [locator](./locators.md) and copy it into your test file by clicking the **Pick locator** button form the testing sidebar. Then in the browser click the element you require and it will now show up in the **Pick locator** box in VS Code. Press 'enter' on your keyboard to copy the locator into the clipboard and then paste anywhere in your code. Or press 'escape' if you want to cancel.

<img width="1394" alt="Pick locators" src="https://user-images.githubusercontent.com/13063165/212741666-6479a702-2517-44a3-9eca-e719e13b379c.png" />

Playwright will look at your page and figure out the best locator, prioritizing [role, text and test id locators](./locators.md). If Playwright finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

### Run in Debug Mode

To set a breakpoint click next to the line number where you want the breakpoint to be until a red dot appears. Run the tests in debug mode by right clicking on the line next to the test you want to run.

<img width="1269" alt="setting debug test mode" src="https://user-images.githubusercontent.com/13063165/212739847-ecb7dcfe-8929-45f3-b24e-f9c4b592f430.png" />

A browser window will open and the test will run and pause at where the breakpoint is set. You can step through the tests, pause the test and rerun the tests from the menu in VS Code.

<img width="1269" alt="running test in debug mode" src="https://user-images.githubusercontent.com/13063165/212740233-3f278825-13e7-4a88-a118-dd4478d43a16.png" />

### Debug Tests Using Chrome DevTools

Instead of using `Debug Test`, choose `Run Test` in VS Code. With `Show Browser` enabled, the browser session is reused, letting you open Chrome DevTools for continuous debugging of your tests and the web application.

### Debug in different Browsers

By default, debugging is done using the Chromium profile. You can debug your tests on different browsers by right clicking on the debug icon in the testing sidebar and clicking on the 'Select Default Profile' option from the dropdown.

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

To debug all tests run the test command with the `--debug` flag. This will run tests one by one, and open the inspector and a browser window for each test.

```bash
npx playwright test --debug
```
#### Debug one test on all browsers

To debug one test on a specific line, run the test command followed by the name of the test file and the line number of the test you want to debug, followed by the `--debug` flag. This will run a single test in each browser configured in your [`playwright.config`](./test-projects.md#configure-projects-for-multiple-browsers) and open the inspector.

```bash
npx playwright test example.spec.ts:10 --debug
```
#### Debug on a specific browser

In Playwright you can configure projects in your [`playwright.config`](./test-projects.md#configure-projects-for-multiple-browsers). Once configured you can then debug your tests on a specific browser or mobile viewport using the `--project` flag followed by the name of the project configured in your `playwright.config`.

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

#### Configure source location
* langs: java

To tell Playwright where to look for the source code that you are debugging, pass
a list of the source directories via `PLAYWRIGHT_JAVA_SRC` environment variable. Paths in
the list should be separated by : on macOS and Linux, and by ; on Windows.

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

### Stepping through your tests

You can play, pause or step through each action of your test using the toolbar at the top of the Inspector. You can see the current action highlighted in the test code, and matching elements highlighted in the browser window.

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

Once you add a `page.pause()` call, run your tests in debug mode. Clicking the "Resume" button in the Inspector will run the test and only stop on the `page.pause()`.

<img width="1350" alt="test with page.pause" src="https://user-images.githubusercontent.com/13063165/219473050-122be4c2-31d0-4cbd-aa8b-8588e8b781a6.png" />

### Live editing locators

While running in debug mode you can live edit the locators. Next to the 'Pick Locator' button there is a field showing the [locator](./locators.md) that the test is paused on. You can edit this locator directly in the **Pick Locator** field, and matching elements will be highlighted in the browser window.

<img width="1348" alt="live editing locators" src="https://user-images.githubusercontent.com/13063165/212980815-1cf6ef7b-e69a-496c-898a-ec603a3bc562.png" />

### Picking locators

While debugging, you might need to choose a more resilient locator. You can do this by clicking on the **Pick Locator** button and hovering over any element in the browser window. While hovering over an element you will see the code needed to locate this element highlighted below. Clicking an element in the browser will add the locator into the field where you can then either tweak it or copy it into your code.

<img width="1392" alt="Picking locators" src="https://user-images.githubusercontent.com/13063165/212968640-ce82a027-9277-4bdf-b0a9-6282fb2becb7.png" />

Playwright will look at your page and figure out the best locator, prioritizing [role, text and test id locators](./locators.md). If Playwright finds multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, so you don't have to worry about failing tests due to locators.

### Actionability logs

By the time Playwright has paused on a click action, it has already performed [actionability checks](./actionability.md) that can be found in the log. This can help you understand what happened during your test and what Playwright did or tried to do. The log tells you if the element was visible, enabled and stable, if the locator resolved to an element, scrolled into view, and so much more. If actionability can't be reached, it will show the action as pending.

<img width="883" alt="Actionability Logs" src="https://user-images.githubusercontent.com/13063165/212968907-5dede739-e0e3-482a-91cd-726a0f5b0b6d.png" />

## Trace Viewer

Playwright [Trace Viewer](/trace-viewer.md) is a GUI tool that lets you explore recorded Playwright traces of your tests. You can go back and forward through each action on the left side, and visually see what was happening during the action. In the middle of the screen, you can see a DOM snapshot for the action. On the right side you can see action details, such as time, parameters, return value and log. You can also explore console messages, network requests and the source code.

<video width="100%" height="100%" controls muted>
  <source src="https://user-images.githubusercontent.com/13063165/219132713-17b9d75b-71e3-42c4-a43f-3f9e2e15f834.mp4" type="video/mp4" />
</video>

To learn more about how to record traces and use the Trace Viewer, check out the [Trace Viewer](/trace-viewer.md) guide.

## Browser Developer Tools

When running in Debug Mode with `PWDEBUG=console`, a `playwright` object is available in the Developer tools console. Developer tools can help you to:

- Inspect the DOM tree and **find element selectors**
- **See console logs** during execution (or learn how to [read logs via API](./api/class-page.md#page-event-console))
- Check **network activity** and other developer tools features

This will also set the default timeouts of Playwright to 0 (= no timeout).

<img width="1399" alt="Browser Developer Tools with Playwright object" src="https://user-images.githubusercontent.com/13063165/219128002-898f604d-9697-4b7f-95b5-a6a8260b7282.png" />

To debug your tests using the browser developer tools, start by setting a breakpoint in your test to pause the execution using the [`method: Page.pause`] method.

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

Once you have set a breakpoint in your test, you can then run your test with `PWDEBUG=console`.

```bash tab=bash-bash lang=js
PWDEBUG=console npx playwright test
```

```batch tab=bash-batch lang=js
set PWDEBUG=console
npx playwright test
```

```powershell tab=bash-powershell lang=js
$env:PWDEBUG="console"
npx playwright test
```

```bash tab=bash-bash lang=java
# Source directories in the list are separated by : on macos and linux and by ; on win.
PWDEBUG=console PLAYWRIGHT_JAVA_SRC=<java source dirs> mvn test
```

```batch tab=bash-batch lang=java
# Source directories in the list are separated by : on macos and linux and by ; on win.
set PLAYWRIGHT_JAVA_SRC=<java source dirs>
set PWDEBUG=console
mvn test
```

```powershell tab=bash-powershell lang=java
# Source directories in the list are separated by : on macos and linux and by ; on win.
$env:PLAYWRIGHT_JAVA_SRC="<java source dirs>"
$env:PWDEBUG=console
mvn test
```

```bash tab=bash-bash lang=python
PWDEBUG=console pytest -s
```

```batch tab=bash-batch lang=python
set PWDEBUG=console
pytest -s
```

```powershell tab=bash-powershell lang=python
$env:PWDEBUG=console
pytest -s
```

```bash tab=bash-bash lang=csharp
PWDEBUG=console dotnet test
```

```batch tab=bash-batch lang=csharp
set PWDEBUG=console
dotnet test
```

```powershell tab=bash-powershell lang=csharp
$env:PWDEBUG=console
dotnet test
```

Once Playwright launches the browser window, you can open the developer tools.
The `playwright` object will be available in the console panel.

#### playwright.$(selector)

Query the Playwright selector, using the actual Playwright query engine, for example:

```bash
playwright.$('.auth-form >> text=Log in');

<button>Log in</button>
```

#### playwright.$$(selector)

Same as `playwright.$`, but returns all matching elements.

```bash
playwright.$$('li >> text=John')

[<li>, <li>, <li>, <li>]
```

#### playwright.inspect(selector)

Reveal element in the Elements panel.

```bash
playwright.inspect('text=Log in')
```

#### playwright.locator(selector)

Create a locator and query matching elements, for example:

```bash
playwright.locator('.auth-form', { hasText: 'Log in' });

Locator ()
  - element: button
  - elements: [button]
```

#### playwright.selector(element)

Generates selector for the given element. For example, select an element in the Elements panel and pass `$0`:

```bash
playwright.selector($0)

"div[id="glow-ingress-block"] >> text=/.*Hello.*/"
```

## Verbose API logs

Playwright supports verbose logging with the `DEBUG` environment variable.

```bash tab=bash-bash lang=js
DEBUG=pw:api npx playwright test
```

```batch tab=bash-batch lang=js
set DEBUG=pw:api
npx playwright test
```

```powershell tab=bash-powershell lang=js
$env:DEBUG="pw:api"
npx playwright test
```

```bash tab=bash-bash lang=java
DEBUG=pw:api mvn test
```

```batch tab=bash-batch lang=java
set DEBUG=pw:api
mvn test
```

```powershell tab=bash-powershell lang=java
$env:DEBUG="pw:api"
mvn test
```

```bash tab=bash-bash lang=python
DEBUG=pw:api pytest -s
```

```batch tab=bash-batch lang=python
set DEBUG=pw:api
pytest -s
```

```powershell tab=bash-powershell lang=python
$env:DEBUG="pw:api"
pytest -s
```

```bash tab=bash-bash lang=csharp
DEBUG=pw:api dotnet run
```

```batch tab=bash-batch lang=csharp
set DEBUG=pw:api
dotnet run
```

```powershell tab=bash-powershell lang=csharp
$env:DEBUG="pw:api"
dotnet run
```

:::note
**For WebKit**: launching WebKit Inspector during the execution will
prevent the Playwright script from executing any further and
will reset pre-configured user agent and device emulation.
:::

## Headed mode

Playwright runs browsers in headless mode by default. To change this behavior,
use `headless: false` as a launch option.

You can also use the [`option: BrowserType.launch.slowMo`] option
to slow down execution (by N milliseconds per operation) and follow along while debugging.

```js
// Chromium, Firefox, or WebKit
await chromium.launch({ headless: false, slowMo: 100 });
```

```java
// Chromium, Firefox, or WebKit
chromium.launch(new BrowserType.LaunchOptions()
  .setHeadless(false)
  .setSlowMo(100));
```

```python async
# Chromium, Firefox, or WebKit
await chromium.launch(headless=False, slow_mo=100)
```

```python sync
# Chromium, Firefox, or WebKit
chromium.launch(headless=False, slow_mo=100)
```

```csharp
// Chromium, Firefox, or WebKit
await using var browser = await playwright.Chromium.LaunchAsync(new()
{
    Headless = false,
    SlowMo = 100
});
```
