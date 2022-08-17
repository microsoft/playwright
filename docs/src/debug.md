---
id: debug
title: "Debugging Tests"
---

The Playwright inspector is a great tool to help with debugging. It opens up a browser window highlighting the selectors as you step through each line of the test. You can also use the explore button to find other available [selectors](./selectors.md) which you can then copy into your test file and rerun your tests to see if it passes. For debugging selectors, see [here](./debug-selectors.md).

## Playwright Inspector

Playwright Inspector is a GUI tool that helps authoring and debugging Playwright scripts. That's our default recommended tool for scripts troubleshooting.

<img width="712" alt="Playwright Inspector" src="https://user-images.githubusercontent.com/883973/108614092-8c478a80-73ac-11eb-9597-67dfce110e00.png"></img>

There are several ways of opening Playwright Inspector:

### --debug
* langs: js

* Debugging all Tests

  ```bash
  npx playwright test --debug
  ```

* Debugging one test

  ```bash
  npx playwright test example --debug
  ```

### PWDEBUG

Set the `PWDEBUG` environment variable to run your scripts in debug mode. This
configures Playwright for debugging and opens the inspector.

```bash tab=bash-bash lang=js
PWDEBUG=1 npm run test
```

```batch tab=bash-batch lang=js
set PWDEBUG=1
npm run test
```

```powershell tab=bash-powershell lang=js
$env:PWDEBUG=1
npm run test
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

- Browsers launch in the headed mode
- Default timeout is set to 0 (= no timeout)

Using `PWDEBUG=console` will configure the browser for debugging in Developer tools console:

- **Runs headed**: Browsers always launch in headed mode
- **Disables timeout**: Sets default timeout to 0 (= no timeout)
- **Console helper**: Configures a `playwright` object in the browser to generate and highlight
  [Playwright selectors](./selectors.md). This can be used to verify text or
  composite selectors.

```bash tab=bash-bash lang=js
PWDEBUG=console npm run test
```

```batch tab=bash-batch lang=js
set PWDEBUG=console
npm run test
```

```powershell tab=bash-powershell lang=js
$env:PWDEBUG="console"
npm run test
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

### page.pause

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
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen wikipedia.org"
```

```bash python
playwright codegen wikipedia.org
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen wikipedia.org
```

### Stepping through the Playwright script

The Inspector opens up a browser window highlighting the selectors as you step through each line of the test. Use the explore button to find other available [selectors](./selectors.md) which you can then copy into your test file and rerun your tests to see if they pass.

<img width="557" alt="Paused on line" src="https://user-images.githubusercontent.com/883973/108614337-71761580-73ae-11eb-9f61-3d29c52c9520.png"></img>

Use the toolbar to play the test or step over each action using the "Step over" action (keyboard shortcut: `F10`) or resume script without further pauses (`F8`):

<center><img width="98" alt="Stepping toolbar" src="https://user-images.githubusercontent.com/883973/108614389-f9f4b600-73ae-11eb-8df2-8d9ce9da5d5c.png"></img></center>

Now we know what action is about to be performed and we can look into the details on that
action. For example, when stopped on an input action such as `click`, the exact point Playwright is about to click is highlighted with the large red dot on the inspected page:

<img width="344" alt="Red dot on inspected page" src="https://user-images.githubusercontent.com/883973/108614363-b69a4780-73ae-11eb-8f5e-51f9c91ec9b4.png"></img>

### Actionability Logs

By the time Playwright has paused on that click action, it has already performed [actionability checks](./actionability.md) that can be found in the log:

<img width="712" alt="Action log" src="https://user-images.githubusercontent.com/883973/108614564-72a84200-73b0-11eb-9de2-828b28d78b36.png"></img>

If actionability can't be reached, it'll show action as pending:

<img width="712" alt="Pending action" src="https://user-images.githubusercontent.com/883973/108614840-e6e3e500-73b2-11eb-998f-0cf31b2aa9a2.png"></img>

### Exploring selectors

Use the Explore button to hover over an element on the page and explore it's selector by clicking on it. You can then copy this selector into your tests and rerun your tests to see if they now pass with this selector. You can also debug selectors, checkout our [debugging selectors](./debug-selectors.md) guide for more details.

## Browser Developer Tools

You can use browser developer tools in Chromium, Firefox and WebKit while running
a Playwright script in headed mode. Developer tools help to:

- Inspect the DOM tree and **find element selectors**
- **See console logs** during execution (or learn how to [read logs via API](./api/class-page.md#page-event-console))
- Check **network activity** and other developer tools features

<a href="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png"><img src="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png" width="500" alt="Chromium Developer Tools"></img></a>

Using a [`method: Page.pause`] method is an easy way to pause the Playwright script execution
and inspect the page in Developer tools. It will also open Playwright Inspector to help with debugging.

**For Chromium**: you can also open developer tools through a launch option.

```js
await chromium.launch({ devtools: true });
```

```java
chromium.launch(new BrowserType.LaunchOptions().setDevtools(true));
```

```python async
await chromium.launch(devtools=True)
```

```python sync
chromium.launch(devtools=True)
```

```csharp
await using var browser = await playwright.Chromium.LaunchAsync(new()
{
  Devtools: true
});
```

:::note
**For WebKit**: launching WebKit Inspector during the execution will
prevent the Playwright script from executing any further.
:::

## Headed mode

Playwright runs browsers in headless mode by default. To change this behavior,
use `headless: false` as a launch option. You can also use the [`option: slowMo`] option
to slow down execution and follow along while debugging.

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


