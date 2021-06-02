---
id: inspector
title: "Inspector"
---

Playwright Inspector is a GUI tool that helps authoring and debugging Playwright scripts.

<img width="712" alt="Playwright Inspector" src="https://user-images.githubusercontent.com/883973/108614092-8c478a80-73ac-11eb-9597-67dfce110e00.png"></img>

<!-- TOC -->

## Open Playwright Inspector

There are several ways of opening Playwright Inspector:

- Set the `PWDEBUG` environment variable to run your scripts in debug mode. This
configures Playwright for debugging and opens the inspector.
  ```bash js
  # Linux/macOS
  PWDEBUG=1 npm run test

  # Windows with cmd.exe
  set PWDEBUG=1
  npm run test

  # Windows with PowerShell
  $env:PWDEBUG=1
  npm run test
  ```

  ```bash java
  # Linux/macOS
  PWDEBUG=1 PLAYWRIGHT_JAVA_SRC=<java src root> mvn test

  # Windows with cmd.exe
  set PLAYWRIGHT_JAVA_SRC=<java src root>
  set PWDEBUG=1
  mvn test

  # Windows with PowerShell
  $env:PLAYWRIGHT_JAVA_SRC="<java src root>"
  $env:PWDEBUG=1
  mvn test
  ```

  ```bash python
  # Linux/macOS
  PWDEBUG=1 pytest -s

  # Windows with cmd.exe
  set PWDEBUG=1
  pytest -s

  # Windows with PowerShell
  $env:PWDEBUG=1
  pytest -s
  ```

  Additional useful defaults are configured when `PWDEBUG=1` is set:
  - Browsers launch in the headed mode
  - Default timeout is set to 0 (= no timeout)

- Call [`method: Page.pause`] method from your script when running in headed browser.

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


- Use `open` or `codegen` commands in the Playwright [CLI](./cli.md):
  ```bash js
  npx playwright codegen wikipedia.org
  ```

  ```bash java
  mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen wikipedia.org"
  ```

  ```bash python
  playwright codegen wikipedia.org
  ```

## Stepping through the Playwright script

When `PWDEBUG=1` is set, Playwright Inspector window will be opened and the script will be
paused on the first Playwright statement:

<img width="557" alt="Paused on line" src="https://user-images.githubusercontent.com/883973/108614337-71761580-73ae-11eb-9f61-3d29c52c9520.png"></img>

Now we know what action is about to be performed and we can look into the details on that
action. For example, when stopped on an input action such as `click`, the exact point Playwright is about to click is highlighted with the large red dot on the inspected page:

<img width="344" alt="Red dot on inspected page" src="https://user-images.githubusercontent.com/883973/108614363-b69a4780-73ae-11eb-8f5e-51f9c91ec9b4.png"></img>

By the time Playwright has paused on that click action, it has already performed actionability checks that can be found in the log:

<img width="712" alt="Action log" src="https://user-images.githubusercontent.com/883973/108614564-72a84200-73b0-11eb-9de2-828b28d78b36.png"></img>

If actionability can't be reached, it'll show action as pending:

<img width="712" alt="Pending action" src="https://user-images.githubusercontent.com/883973/108614840-e6e3e500-73b2-11eb-998f-0cf31b2aa9a2.png"></img>

You can step over each action using the "Step over" action or resume script without further pauses:

<center><img width="98" alt="Stepping toolbar" src="https://user-images.githubusercontent.com/883973/108614389-f9f4b600-73ae-11eb-8df2-8d9ce9da5d5c.png"></img></center>

## Using Browser Developer Tools

You can use browser developer tools in Chromium, Firefox and WebKit while running
a Playwright script, with or without Playwright inspector. Developer tools help to:

* Inspect the DOM tree
* **See console logs** during execution (or learn how to [read logs via API](./verification.md#console-logs))
* Check **network activity** and other developer tools features

:::note
**For WebKit**: launching WebKit Inspector during the execution will
  prevent the Playwright script from executing any further.
:::

## Debugging Selectors

- Click the Explore button to hover over elements in the screen and click them to
automatically generate selectors for those elements.
- To verify where selector points, paste it into the inspector input field:

<img width="602" alt="Selectors toolbar" src="https://user-images.githubusercontent.com/883973/108614696-ad5eaa00-73b1-11eb-81f5-9eebe62543a2.png"></img>

## Recording scripts

At any moment, clicking Record action enables recorder (codegen) mode.
Every action on the target page is turned into the generated script:

<img width="712" alt="Recorded script" src="https://user-images.githubusercontent.com/883973/108614897-85704600-73b3-11eb-8bcd-f2e129786c49.png"></img>

You can copy entire generated script or clear it using toolbar actions.
