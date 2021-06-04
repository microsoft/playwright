---
id: debug
title: "Debugging tools"
---

Playwright scripts work with existing debugging tools, like Node.js debuggers
and browser developer tools. Playwright also introduces new debugging features
for browser automation.

<!-- TOC -->

## Playwright Inspector

[Playwright Inspector](./inspector.md) is a GUI tool that helps authoring and debugging Playwright scripts. That's our default recommended tool for scripts troubleshooting.

<img width="712" alt="Playwright Inspector" src="https://user-images.githubusercontent.com/883973/108614092-8c478a80-73ac-11eb-9597-67dfce110e00.png"></img>


## Playwright Trace Viewer

[Playwright Trace Viewer](./trace-viewer.md) is a GUI tool that helps troubleshooting test runs in a post-mortem manner.

<img width="1212" alt="Playwright Trace Viewer" src="https://user-images.githubusercontent.com/883973/120585896-6a1bca80-c3e7-11eb-951a-bd84002480f5.png"></img>

## Run in headed mode

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
await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
{
    Headless = false,
    SlowMo = 100
});
```

## Browser Developer Tools

You can use browser developer tools in Chromium, Firefox and WebKit while running
a Playwright script in headed mode. Developer tools help to:

* Inspect the DOM tree and **find element selectors**
* **See console logs** during execution (or learn how to [read logs via API](./verification.md#console-logs))
* Check **network activity** and other developer tools features

<a href="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png"><img src="https://user-images.githubusercontent.com/284612/77234134-5f21a500-6b69-11ea-92ec-1c146e1333ec.png" width="500" alt="Chromium Developer Tools"></img></a>

Using a [`method: Page.pause`] method is an easy way to pause the Playwright script execution
and inspect the page in Developer tools. It will also open [Playwright Inspector](./inspector.md) to help with debugging.

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
await using var browser = await playwright.Chromium.LaunchAsync(new BrowserTypeLaunchOptions
{
    Devtools: true
});
```

:::note
**For WebKit**: launching WebKit Inspector during the execution will
  prevent the Playwright script from executing any further.
:::

## Run in Debug Mode

Set the `PWDEBUG` environment variable to run your scripts in debug mode. Using `PWDEBUG=1` will open [Playwright Inspector](./inspector.md).

Using `PWDEBUG=console` will configure the browser for debugging in Developer tools console:
* **Runs headed**: Browsers always launch in headed mode
* **Disables timeout**: Sets default timeout to 0 (= no timeout)
* **Console helper**: Configures a `playwright` object in the browser to generate and highlight
[Playwright selectors](./selectors.md). This can be used to verify text or
composite selectors.

```bash js
# Linux/macOS
PWDEBUG=console npm run test

# Windows with cmd.exe
set PWDEBUG=console
npm run test

# Windows with PowerShell
$env:PWDEBUG="console"
npm run test
```

```bash java
# Linux/macOS
PWDEBUG=console mvn test

# Windows with cmd.exe
set PWDEBUG=console
mvn test

# Windows with PowerShell
$env:PWDEBUG="console"
mvn test
```

```bash python
# Linux/macOS
PWDEBUG=console pytest -s

# Windows with cmd.exe
set PWDEBUG=console
pytest -s

# Windows with PowerShell
$env:PWDEBUG="console"
pytest -s
```

## Selectors in Developer Tools Console

When running in Debug Mode with `PWDEBUG=console`, a `playwright` object is available in Developer tools console.

1. Run with `PWDEBUG=console`
1. Setup a breakpoint to pause the execution
1. Open the console panel in browser developer tools
1. Use the `playwright` API
    * `playwright.$(selector)`: Highlight the first occurrence of the selector. This reflects
      how `page.$` would see the page.
    * `playwright.$$(selector)`: Highlight all occurrences of the selector. This reflects
      how `page.$$` would see the page.
    * `playwright.inspect(selector)`: Inspect the selector in the Elements panel.
    * `playwright.clear()`: Clear existing highlights.
    * `playwright.selector(element)`: Generate a selector that points to the element.

<a href="https://user-images.githubusercontent.com/284612/86857345-299abc00-c073-11ea-9e31-02923a9f0d4b.png"><img src="https://user-images.githubusercontent.com/284612/86857345-299abc00-c073-11ea-9e31-02923a9f0d4b.png" width="500" alt="Highlight selectors"></img></a>

## Visual Studio Code debugger (Node.js)

The VS Code debugger can be used to pause and resume execution of Playwright
scripts with breakpoints. The debugger can be configured in two ways.

### Use launch config

Setup [`launch.json` configuration](https://code.visualstudio.com/docs/nodejs/nodejs-debugging)
for your Node.js project. Once configured launch the scripts with F5 and use
breakpoints.

### Use the JavaScript Debug Terminal

1. Open [JavaScript Debug Terminal](https://code.visualstudio.com/docs/nodejs/nodejs-debugging#_javascript-debug-terminal)
1. Set a breakpoint in VS Code
    * Use the `debugger` keyword or set a breakpoint in the VS Code UI
1. Run your Node.js script from the terminal

## Verbose API logs

Playwright supports verbose logging with the `DEBUG` environment variable.

```bash js
# Linux/macOS
DEBUG=pw:api npm run test

# Windows with cmd.exe
set DEBUG=pw:api
npm run test

# Windows with PowerShell
$env:DEBUG="pw:api"
npm run test
```

```bash java
# Linux/macOS
DEBUG=pw:api mvn test

# Windows with cmd.exe
set DEBUG=pw:api
mvn test

# Windows with PowerShell
$env:DEBUG="pw:api"
mvn test
```

```bash python
# Linux/macOS
DEBUG=pw:api pytest -s

# Windows with cmd.exe
set DEBUG=pw:api
pytest -s

# Windows with PowerShell
$env:DEBUG="pw:api"
pytest -s
```

```bash csharp
# Linux/macOS
DEBUG=pw:api dotnet run

# Windows with cmd.exe
set DEBUG=pw:api
dotnet run

# Windows with PowerShell
$env:DEBUG="pw:api"
dotnet run
```