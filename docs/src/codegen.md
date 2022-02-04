---
id: codegen
title: "Test Generator"
---

Playwright comes with the ability to generate tests out of the box.

<!-- TOC -->

## Generate tests

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
playwright codegen wikipedia.org
```

Run `codegen` and perform actions in the browser. Playwright will generate the code for the user interactions. `codegen` will attempt to generate resilient text-based selectors.

<img src="https://user-images.githubusercontent.com/284612/92536033-7e7ebe00-f1ed-11ea-9e1a-7cbd912e3391.gif"></img>

## Preserve authenticated state

Run `codegen` with `--save-storage` to save [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) at the end of the session. This is useful to separately record authentication step and reuse it later in the tests.

```bash js
npx playwright codegen --save-storage=auth.json
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```bash java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen  --save-storage=auth.json"
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```bash python
playwright codegen --save-storage=auth.json
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```bash csharp
playwright codegen --save-storage=auth.json
# Perform authentication and exit.
# auth.json will contain the storage state.
```

Run with `--load-storage` to consume previously loaded storage. This way, all [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) will be restored, bringing most web apps to the authenticated state.

```bash js
npx playwright open --load-storage=auth.json my.web.app
npx playwright codegen --load-storage=auth.json my.web.app
# Perform actions in authenticated state.
```

```bash java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="open --load-storage=auth.json my.web.app"
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen --load-storage=auth.json my.web.app"
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```bash python
playwright open --load-storage=auth.json my.web.app
playwright codegen --load-storage=auth.json my.web.app
# Perform actions in authenticated state.
```

```bash csharp
playwright open --load-storage=auth.json my.web.app
playwright codegen --load-storage=auth.json my.web.app
# Perform actions in authenticated state.
```

## Record using custom setup

If you would like to use codegen in some non-standard setup (for example, use [`method: BrowserContext.route`]), it is possible to call [`method: Page.pause`] that will open a separate window with codegen controls.

```js
const { chromium } = require('playwright');

(async () => {
  // Make sure to run headed.
  const browser = await chromium.launch({ headless: false });

  // Setup context however you like.
  const context = await browser.newContext({ /* pass any options */ });
  await context.route('**/*', route => route.continue());

  // Pause the page, and start recording manually.
  const page = await context.newPage();
  await page.pause();
})();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      // Make sure to run headed.
      Browser browser = chromium.launch(new BrowserType.LaunchOptions().setHeadless(false));
      // Setup context however you like.
      BrowserContext context = browser.newContext(/* pass any options */);
      context.route("**/*", route -> route.resume());
      // Pause the page, and start recording manually.
      Page page = context.newPage();
      page.pause();
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        # Make sure to run headed.
        browser = await p.chromium.launch(headless=False)

        # Setup context however you like.
        context = await browser.new_context() # Pass any options
        await context.route('**/*', lambda route: route.continue_())

        # Pause the page, and start recording manually.
        page = await context.new_page()
        await page.pause()

asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    # Make sure to run headed.
    browser = p.chromium.launch(headless=False)

    # Setup context however you like.
    context = browser.new_context() # Pass any options
    context.route('**/*', lambda route: route.continue_())

    # Pause the page, and start recording manually.
    page = context.new_page()
    page.pause()
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        var chromium = playwright.Chromium;
        // Make sure to run headed.
        var browser = await chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = false });

        // Setup context however you like.
        var context = await browser.NewContextAsync(); // Pass any options
        await context.RouteAsync('**/*', route => route.ContinueAsync());

        // Pause the page, and start recording manually.
        var page = await context.NewPageAsync();
        await page.PauseAsync();
    }
}
```

## Emulate devices

You can record scripts and tests while emulating a device.

```bash js
# Emulate iPhone 11.
npx playwright codegen --device="iPhone 11" wikipedia.org
```

```bash java
# Emulate iPhone 11.
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args='codegen --device="iPhone 11" wikipedia.org'
```

```bash python
# Emulate iPhone 11.
playwright codegen --device="iPhone 11" wikipedia.org
```

```bash csharp
# Emulate iPhone 11.
playwright codegen --device="iPhone 11" wikipedia.org
```

## Emulate color scheme and viewport size

You can also record scripts and tests while emulating various browser properties.

```bash js
# Emulate screen size and color scheme.
npx playwright codegen --viewport-size=800,600 --color-scheme=dark twitter.com
```

```bash java
# Emulate screen size and color scheme.
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen --viewport-size=800,600 --color-scheme=dark twitter.com"
```

```bash python
# Emulate screen size and color scheme.
playwright codegen --viewport-size=800,600 --color-scheme=dark twitter.com
```

```bash csharp
# Emulate screen size and color scheme.
playwright codegen --viewport-size=800,600 --color-scheme=dark twitter.com
```

## Emulate geolocation, language and timezone

```bash js
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
npx playwright codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```

```bash java
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args='codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com'
```

```bash python
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
playwright codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```

```bash csharp
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
playwright codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```

## Test Generator window screen position

By default, Test Generator opens at position `1280,10`. This position can be overridden with `PLAYWRIGHT_TOOLS_POSITION` environment variable.

For example, to make Test Generator appear at the top-left corner:

```bash js
export PLAYWRIGHT_TOOLS_POSITION=0,0
npx playwright codegen wikipedia.org
```

```bash java
export PLAYWRIGHT_TOOLS_POSITION=0,0
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen wikipedia.org"
```

```bash python
export PLAYWRIGHT_TOOLS_POSITION=0,0
playwright codegen wikipedia.org
```

```bash csharp
export PLAYWRIGHT_TOOLS_POSITION=0,0
playwright codegen wikipedia.org
```
