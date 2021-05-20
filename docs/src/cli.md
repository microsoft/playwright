---
id: cli
title: "Command Line Interface"
---

Playwright comes with the command line tools that run via `npx` or as a part of the `npm` scripts.

<!-- TOC -->

## Usage

```sh js
npx playwright --help
```

```sh java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI
```

```sh python
playwright
```

```json js
# Running from `package.json` script
{
  "scripts": {
    "help": "playwright --help"
  }
}
```

## Generate code

```sh js
npx playwright codegen wikipedia.org
```

```sh java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen wikipedia.org"
```

```sh python
playwright codegen wikipedia.org
```

Run `codegen` and perform actions in the browser. Playwright CLI will generate JavaScript code for the user interactions. `codegen` will attempt to generate resilient text-based selectors.

<img src="https://user-images.githubusercontent.com/284612/92536033-7e7ebe00-f1ed-11ea-9e1a-7cbd912e3391.gif"></img>

### Preserve authenticated state

Run `codegen` with `--save-storage` to save [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) at the end. This is useful to separately record authentication step and reuse it later.

```sh js
npx playwright codegen --save-storage=auth.json
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```sh java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen  --save-storage=auth.json"
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```sh python
playwright codegen --save-storage=auth.json
# Perform authentication and exit.
# auth.json will contain the storage state.
```

Run with `--load-storage` to consume previously loaded storage. This way, all [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) will be restored, bringing most web apps to the authenticated state.

```sh js
npx playwright open --load-storage=auth.json my.web.app
npx playwright codegen --load-storage=auth.json my.web.app
# Perform actions in authenticated state.
```

```sh java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="open --load-storage=auth.json my.web.app"
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="codegen --load-storage=auth.json my.web.app"
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```sh python
playwright open --load-storage=auth.json my.web.app
playwright codegen --load-storage=auth.json my.web.app
# Perform actions in authenticated state.
```

### Codegen with custom setup

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

class Example
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

## Open pages

With `open`, you can use Playwright bundled browsers to browse web pages. Playwright provides cross-platform WebKit builds that can be used to reproduce Safari rendering across Windows, Linux and macOS.

```sh js
# Open page in Chromium
npx playwright open example.com
```

```sh java
# Open page in Chromium
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="open example.com"
```

```sh python
# Open page in Chromium
playwright open example.com
```

```sh js
# Open page in WebKit
npx playwright wk example.com
```

```sh java
# Open page in WebKit
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="wk example.com"
```

```sh python
# Open page in WebKit
playwright wk example.com
```

### Emulate devices
`open` can emulate mobile and tablet devices from the [`playwright.devices`](https://playwright.dev/docs/api/class-playwright#playwrightdevices) list.

```sh js
# Emulate iPhone 11.
npx playwright open --device="iPhone 11" wikipedia.org
```

```sh java
# Emulate iPhone 11.
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args='open --device="iPhone 11" wikipedia.org'
```

```sh python
# Emulate iPhone 11.
playwright open --device="iPhone 11" wikipedia.org
```

### Emulate color scheme and viewport size
```sh js
# Emulate screen size and color scheme.
npx playwright open --viewport-size=800,600 --color-scheme=dark twitter.com
```
```sh java
# Emulate screen size and color scheme.
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="open --viewport-size=800,600 --color-scheme=dark twitter.com"
```
```sh python
# Emulate screen size and color scheme.
playwright open --viewport-size=800,600 --color-scheme=dark twitter.com
```

### Emulate geolocation, language and timezone
```sh js
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
npx playwright open --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```
```sh java
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args='open --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com'
```
```sh python
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
playwright open --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```

## Inspect selectors
During `open` or `codegen`, you can use following API inside the developer tools console of any browser.

<img src="https://user-images.githubusercontent.com/284612/92536317-37dd9380-f1ee-11ea-875d-daf1b206dd56.png"></img>

#### playwright.$(selector)

Query Playwright selector, using the actual Playwright query engine, for example:

```js
> playwright.$('.auth-form >> text=Log in');

<button>Log in</button>
```

#### playwright.$$(selector)

Same as `playwright.$`, but returns all matching elements.

```js
> playwright.$$('li >> text=John')

> [<li>, <li>, <li>, <li>]
```

#### playwright.inspect(selector)

Reveal element in the Elements panel (if DevTools of the respective browser supports it).

```js
> playwright.inspect('text=Log in')
```

#### playwright.selector(element)

Generates selector for the given element.

```js
> playwright.selector($0)

"div[id="glow-ingress-block"] >> text=/.*Hello.*/"
```

## Take screenshot

```sh js
# See command help
npx playwright screenshot --help
```

```sh java
# See command help
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="screenshot --help"
```

```sh python
# See command help
playwright screenshot --help
```

```sh js
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
npx playwright screenshot \
    --device="iPhone 11" \
    --color-scheme=dark \
    --wait-for-timeout=3000 \
    twitter.com twitter-iphone.png
```

```sh java
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args='screenshot --device="iPhone 11" --color-scheme=dark --wait-for-timeout=3000 twitter.com twitter-iphone.png'
```

```sh python
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
playwright screenshot \
    --device="iPhone 11" \
    --color-scheme=dark \
    --wait-for-timeout=3000 \
    twitter.com twitter-iphone.png
```

```sh js
# Capture a full page screenshot
npx playwright screenshot --full-page en.wikipedia.org wiki-full.png
```

```sh java
# Capture a full page screenshot
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args='screenshot --full-page en.wikipedia.org wiki-full.png'
```

```sh python
# Capture a full page screenshot
playwright screenshot --full-page en.wikipedia.org wiki-full.png
```

## Generate PDF

PDF generation only works in Headless Chromium.

```sh js
# See command help
npx playwright pdf https://en.wikipedia.org/wiki/PDF wiki.pdf
```

```sh java
# See command help
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="pdf https://en.wikipedia.org/wiki/PDF wiki.pdf"
```

```sh python
# See command help
playwright pdf https://en.wikipedia.org/wiki/PDF wiki.pdf
```

## Install system dependencies

Ubuntu 18.04 and Ubuntu 20.04 system dependencies can get installed automatically. This is useful for CI environments.

```sh js
# See command help
npx playwright install-deps
```

```sh java
# See command help
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install-deps"
```

```sh python
# See command help
playwright install-deps
```

You can also install the dependencies for a single browser only by passing it as an argument:

```sh js
npx playwright install-deps chromium
```

```sh java
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install-deps chromium"
```

```sh python
playwright install-deps chromium
```

## Known limitations
Opening WebKit Web Inspector will disconnect Playwright from the browser. In such cases, code generation will stop.
