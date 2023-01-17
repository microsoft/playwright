---
id: debug
title: "Debugging Tests"
---

## VS Code debugger
* langs: js

We recommend using the [VS Code Extension](./getting-started-vscode.md) for debugging for a better developer experience. With the VS Code extension you can debug your tests right in VS Code, see error messages, set breakpoints and live debug your tests.

<img width="1269" alt="running test in debug mode" src="https://user-images.githubusercontent.com/13063165/212740233-3f278825-13e7-4a88-a118-dd4478d43a16.png" />

## Playwright Inspector

The Playwright Inspector is a GUI tool to help you author and debug Playwright scripts. 

<img width="864" alt="Playwright Inspector" src="https://user-images.githubusercontent.com/13063165/212924587-4b84e5f6-b147-40e9-8c75-d7b9ab6b7ca1.png" />

### Stepping through the Playwright script

You can play, pause or step through each line of your test using the toolbar at the top of the Inspector. Underneath the toolbar the code of your test is shown and as you step through each line, the line of code that is being run is highlighted in the Inspector as well as in the browser window.

<img width="1340" alt="Playwright Inspector and browser" src="https://user-images.githubusercontent.com/13063165/212936618-84b87acc-bc2e-46ed-994b-32b2ef742e60.png" />

### Live editing locators

Next to the 'Pick Locator' button is a field showing the [locator](./locators.md) that the test is paused on. You can edit this locator and it will show you if any elements or more than one element has been found on the page. This allows you to easily tweak and improve your locators.

<img width="1348" alt="live editing locators" src="https://user-images.githubusercontent.com/13063165/212980815-1cf6ef7b-e69a-496c-898a-ec603a3bc562.png" />

### Picking locators

You can also click on the 'Pick Locator' button and then hover over any element on the page to see the locator highlighted underneath. Clicking an element in the browser will add the locator into the field where you can then either tweak it or copy it into your code.

<img width="1392" alt="Picking locators" src="https://user-images.githubusercontent.com/13063165/212968640-ce82a027-9277-4bdf-b0a9-6282fb2becb7.png" />

### Actionability logs

By the time Playwright has paused on a click action, it has already performed [actionability checks](./actionability.md) that can be found in the log. This can help you understand what happened during your test and what Playwright did or tried to do. The log tells you if the element was visible, enabled and stable, if the locator resolved to an element, scrolled into view and so much more. If actionability can't be reached, it will show action as pending.

<img width="883" alt="Actionability Logs" src="https://user-images.githubusercontent.com/13063165/212968907-5dede739-e0e3-482a-91cd-726a0f5b0b6d.png" />

### Opening the Inspector
There are several ways of opening Playwright Inspector:

#### --debug
* langs: js

* Debugging all Tests

  ```bash
  npx playwright test --debug
  ```

* Debugging one test on a specific line

  ```bash
  npx playwright test example.spec.ts:10 --debug
  ```

* Debugging one test on a specific browser

  ```bash
  npx playwright test example.spec.ts:10 --project=webkit --debug
  ```

#### PWDEBUG

Set the `PWDEBUG` environment variable to run your scripts in debug mode. This
configures Playwright for debugging and opens the inspector.

```bash tab=bash-bash lang=js
PWDEBUG=1 npx playwright test
```

```batch tab=bash-batch lang=js
set PWDEBUG=1
npx playwright test
```

```powershell tab=bash-powershell lang=js
$env:PWDEBUG=1
npx playwright test
```

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

Additional useful defaults are configured when `PWDEBUG=1` is set:

- Browsers launch in headed mode
- Default timeout is set to 0 (= no timeout)

Using `PWDEBUG=console` will configure the browser for debugging in Developer tools console:

- **Runs headed**: Browsers always launch in headed mode
- **Disables timeout**: Sets default timeout to 0 (= no timeout)
- **Console helper**: Configures a `playwright` object in the browser to generate and highlight
  [Playwright locators](./locators.md). This can be used to verify locators.

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
PWDEBUG=console mvn test
```

```batch tab=bash-batch lang=java
set PWDEBUG=console
mvn test
```

```powershell tab=bash-powershell lang=java
$env:PWDEBUG="console"
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
$env:PWDEBUG="console"
pytest -s
```

#### page.pause

Call [`method: Page.pause`] method from your script when running in headed browser.

```js
// Pause on the following line.
await page.pause();
```

```java
// Pause on the following line.
page.pause();
```

```python async
# Pause on the following line.
await page.pause()
```

```python sync
# Pause on the following line.
page.pause()
```

```csharp
// Pause on the following line.
await page.PauseAsync();
```

Use `open` or `codegen` commands in the Playwright [CLI](./cli.md):

```bash js
npx playwright codegen wikipedia.org
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen wikipedia.org"
```

```bash python
playwright codegen wikipedia.org
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen wikipedia.org
```



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


