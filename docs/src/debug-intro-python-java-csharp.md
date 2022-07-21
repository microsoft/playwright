---
id: debug-intro
title: "Debugging Tests"
---

You can debug Playwright with your debugger of choice e.g. inside your IDE. Playwright comes with the Playwright Inspector which allows you to step through Playwright API calls, see their debug logs and explore [selectors](./selectors.md). You can also use [Browser Developer Tools](./debug.md#browser-developer-tools) to debug your scripts as well as [PWDEBUG](./debug.md#PWDEBUG) or [page.pause](./debug.md#page.pause).

## Playwright Inspector

Set the `PWDEBUG` environment variable to run your scripts in debug mode. This configures Playwright for debugging and opens the inspector.

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

<img width="712" alt="Playwright Inspector" src="https://user-images.githubusercontent.com/883973/108614092-8c478a80-73ac-11eb-9597-67dfce110e00.png"></img>

Check out our [advanced debugging guide](./debug.md#PWDEBUG) for more debugging options with [PWDEBUG](./debug.md#PWDEBUG) as well as [page.pause](./debug.md#page.pause) and debugging with [Browser Developer Tools](./debug.md).

### Stepping through the Playwright script

The Inspector opens up a browser window highlighting the selectors as you step through each line of the test. Use the explore button to find other available [selectors](./selectors.md) which you can then copy into your test file and rerun your tests to see if they pass.

<img width="557" alt="Paused on line" src="https://user-images.githubusercontent.com/883973/108614337-71761580-73ae-11eb-9f61-3d29c52c9520.png"></img>

Use the toolbar to play the test or step over each action using the "Step over" action (keyboard shortcut: `F10`) or resume script without further pauses (`F8`):

<center><img width="98" alt="Stepping toolbar" src="https://user-images.githubusercontent.com/883973/108614389-f9f4b600-73ae-11eb-8df2-8d9ce9da5d5c.png"></img></center>

Now we know what action is about to be performed and we can look into the details on that action. For example, when stopped on an input action such as `click`, the exact point Playwright is about to click is highlighted with the large red dot on the inspected page:

<img width="344" alt="Red dot on inspected page" src="https://user-images.githubusercontent.com/883973/108614363-b69a4780-73ae-11eb-8f5e-51f9c91ec9b4.png"></img>

### Actionability Logs

By the time Playwright has paused on that click action, it has already performed [actionability checks](./actionability.md) that can be found in the log:

<img width="712" alt="Action log" src="https://user-images.githubusercontent.com/883973/108614564-72a84200-73b0-11eb-9de2-828b28d78b36.png"></img>

If actionability can't be reached, it'll show action as pending:

<img width="712" alt="Pending action" src="https://user-images.githubusercontent.com/883973/108614840-e6e3e500-73b2-11eb-998f-0cf31b2aa9a2.png"></img>

### Exploring selectors

Use the Explore button to hover over an element on the page and explore it's selector by clicking on it. You can then copy this selector into your tests and rerun your tests to see if they now pass with this selector. You can also debug selectors, checkout our [debugging selectors](./debug-selectors.md) guide for more details.

## What's Next

- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer.md)
