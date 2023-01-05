---
id: cli
title: "Command line tools"
---

Playwright comes with the command line tools.

## Usage

```bash js
npx playwright --help
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI
```

```bash python
playwright
```

```bash csharp
# Use the tools.
pwsh bin/Debug/netX/playwright.ps1 --help
```

```json js
# Running from `package.json` script
{
  "scripts": {
    "help": "playwright --help"
  }
}
```

## Install browsers

Playwright can install supported browsers.

```bash js
# Running without arguments will install default browsers
npx playwright install
```

```bash java
# Running without arguments will install default browsers
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install"
```

```bash python
# Running without arguments will install default browsers
playwright install
```

```bash csharp
# Running without arguments will install default browsers
pwsh bin/Debug/netX/playwright.ps1 install
```

You can also install specific browsers by providing an argument:

```bash js
# Install WebKit
npx playwright install webkit
```

```bash java
# Install WebKit
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install webkit"
```

```bash python
# Install WebKit
playwright install webkit
```

```bash csharp
# Install WebKit
pwsh bin/Debug/netX/playwright.ps1 install webkit
```

See all supported browsers:

```bash js
npx playwright install --help
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --help"
```

```bash python
playwright install --help
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 install --help
```

## Install system dependencies

System dependencies can get installed automatically. This is useful for CI environments.

```bash js
# See command help
npx playwright install-deps
```

```bash java
# See command help
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install-deps"
```

```bash python
# See command help
playwright install-deps
```

```bash csharp
# See command help
pwsh bin/Debug/netX/playwright.ps1 install-deps
```

You can also install the dependencies for a single browser only by passing it as an argument:

```bash js
npx playwright install-deps chromium
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install-deps chromium"
```

```bash python
playwright install-deps chromium
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 install-deps chromium
```

It's also possible to combine `install-deps` with `install` and install by that the browsers and OS dependencies with a single command. This would do both for Chromium, but you can also leave it out.

```bash js
npx playwright install --with-deps chromium
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="install --with-deps chromium"
```

```bash python
playwright install --with-deps chromium
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 install --with-deps chromium
```

## Generate code

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

Run `codegen` and perform actions in the browser. Playwright CLI will generate JavaScript code for the user interactions. `codegen` will attempt to generate resilient text-based selectors.

<img src="https://user-images.githubusercontent.com/284612/92536033-7e7ebe00-f1ed-11ea-9e1a-7cbd912e3391.gif"></img>

### Preserve authenticated state

Run `codegen` with `--save-storage` to save [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) at the end. This is useful to separately record authentication step and reuse it later.

```bash js
npx playwright codegen --save-storage=auth.json
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen  --save-storage=auth.json"
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```bash python
playwright codegen --save-storage=auth.json
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --save-storage=auth.json
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
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="open --load-storage=auth.json my.web.app"
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen --load-storage=auth.json my.web.app"
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```bash python
playwright open --load-storage=auth.json my.web.app
playwright codegen --load-storage=auth.json my.web.app
# Perform actions in authenticated state.
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 open --load-storage=auth.json my.web.app
pwsh bin/Debug/netX/playwright.ps1 codegen --load-storage=auth.json my.web.app
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

using var playwright = await Playwright.CreateAsync();
var chromium = playwright.Chromium;
// Make sure to run headed.
var browser = await chromium.LaunchAsync(new BrowserTypeLaunchOptions { Headless = false });

// Setup context however you like.
var context = await browser.NewContextAsync(); // Pass any options
await context.RouteAsync("**/*", route => route.ContinueAsync());

// Pause the page, and start recording manually.
var page = await context.NewPageAsync();
await page.PauseAsync();
```

## Open pages

With `open`, you can use Playwright bundled browsers to browse web pages. Playwright provides cross-platform WebKit builds that can be used to reproduce Safari rendering across Windows, Linux and macOS.

```bash js
# Open page in Chromium
npx playwright open example.com
```

```bash java
# Open page in Chromium
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="open example.com"
```

```bash python
# Open page in Chromium
playwright open example.com
```

```bash csharp
# Open page in Chromium
pwsh bin/Debug/netX/playwright.ps1 open example.com
```

```bash js
# Open page in WebKit
npx playwright wk example.com
```

```bash java
# Open page in WebKit
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="wk example.com"
```

```bash python
# Open page in WebKit
playwright wk example.com
```

```bash csharp
# Open page in WebKit
pwsh bin/Debug/netX/playwright.ps1 wk example.com
```

### Emulate devices
`open` can emulate mobile and tablet devices from the [`playwright.devices`](https://playwright.dev/docs/api/class-playwright#playwrightdevices) list.

```bash js
# Emulate iPhone 11.
npx playwright open --device="iPhone 11" wikipedia.org
```

```bash java
# Emulate iPhone 11.
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args='open --device="iPhone 11" wikipedia.org'
```

```bash python
# Emulate iPhone 11.
playwright open --device="iPhone 11" wikipedia.org
```

```bash csharp
# Emulate iPhone 11.
pwsh bin/Debug/netX/playwright.ps1 open --device="iPhone 11" wikipedia.org
```

### Emulate color scheme and viewport size

```bash js
# Emulate screen size and color scheme.
npx playwright open --viewport-size=800,600 --color-scheme=dark twitter.com
```

```bash java
# Emulate screen size and color scheme.
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="open --viewport-size=800,600 --color-scheme=dark twitter.com"
```

```bash python
# Emulate screen size and color scheme.
playwright open --viewport-size=800,600 --color-scheme=dark twitter.com
```

```bash csharp
# Emulate screen size and color scheme.
pwsh bin/Debug/netX/playwright.ps1 open --viewport-size=800,600 --color-scheme=dark twitter.com
```

### Emulate geolocation, language and timezone

```bash js
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
npx playwright open --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```

```bash java
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args='open --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com'
```

```bash python
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
playwright open --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```

```bash csharp
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
pwsh bin/Debug/netX/playwright.ps1 open --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
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

#### playwright.locator(selector)

Query Playwright element using the actual Playwright query engine, for example:

```js
> playwright.locator('.auth-form', { hasText: 'Log in' });

> Locator ()
>   - element: button
>   - elements: [button]
```

#### playwright.selector(element)

Generates selector for the given element.

```js
> playwright.selector($0)

"div[id="glow-ingress-block"] >> text=/.*Hello.*/"
```

## Take screenshot

```bash js
# See command help
npx playwright screenshot --help
```

```bash java
# See command help
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="screenshot --help"
```

```bash python
# See command help
playwright screenshot --help
```

```bash js
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
npx playwright screenshot \
    --device="iPhone 11" \
    --color-scheme=dark \
    --wait-for-timeout=3000 \
    twitter.com twitter-iphone.png
```

```bash java
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args='screenshot --device="iPhone 11" --color-scheme=dark --wait-for-timeout=3000 twitter.com twitter-iphone.png'
```

```bash python
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
playwright screenshot \
    --device="iPhone 11" \
    --color-scheme=dark \
    --wait-for-timeout=3000 \
    twitter.com twitter-iphone.png
```

```bash csharp
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
pwsh bin/Debug/netX/playwright.ps1 screenshot \
    --device="iPhone 11" \
    --color-scheme=dark \
    --wait-for-timeout=3000 \
    twitter.com twitter-iphone.png
```

```bash js
# Capture a full page screenshot
npx playwright screenshot --full-page en.wikipedia.org wiki-full.png
```

```bash java
# Capture a full page screenshot
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args='screenshot --full-page en.wikipedia.org wiki-full.png'
```

```bash python
# Capture a full page screenshot
playwright screenshot --full-page en.wikipedia.org wiki-full.png
```

```bash csharp
# Capture a full page screenshot
pwsh bin/Debug/netX/playwright.ps1 screenshot --full-page en.wikipedia.org wiki-full.png
```

## Generate PDF

PDF generation only works in Headless Chromium.

```bash js
# See command help
npx playwright pdf https://en.wikipedia.org/wiki/PDF wiki.pdf
```

```bash java
# See command help
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="pdf https://en.wikipedia.org/wiki/PDF wiki.pdf"
```

```bash python
# See command help
playwright pdf https://en.wikipedia.org/wiki/PDF wiki.pdf
```

```bash csharp
# See command help
pwsh bin/Debug/netX/playwright.ps1 pdf https://en.wikipedia.org/wiki/PDF wiki.pdf
```
