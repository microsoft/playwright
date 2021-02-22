---
id: cli
title: "Command Line Interface"
---

Playwright comes with the command line tools that run via `npx` or as a part of the `npm` scripts.

<!-- TOC -->

## Usage

```sh js
$ npx playwright --help
```

```sh python
$ playwright
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
$ npx playwright codegen wikipedia.org
```

```sh python
$ playwright codegen wikipedia.org
```

Run `codegen` and perform actions in the browser. Playwright CLI will generate JavaScript code for the user interactions. `codegen` will attempt to generate resilient text-based selectors.

<img src="https://user-images.githubusercontent.com/284612/92536033-7e7ebe00-f1ed-11ea-9e1a-7cbd912e3391.gif"></img>

### Preserve authenticated state

Run `codegen` with `--save-storage` to save [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) at the end. This is useful to separately record authentication step and reuse it later.

```sh js
$ npx playwright --save-storage=auth.json codegen
# Perform authentication and exit.
# auth.json will contain the storage state.
```

```sh python
$ playwright --save-storage=auth.json codegen
# Perform authentication and exit.
# auth.json will contain the storage state.
```

Run with `--load-storage` to consume previously loaded storage. This way, all [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) will be restored, bringing most web apps to the authenticated state.

```sh js
$ npx playwright --load-storage=auth.json open my.web.app
$ npx playwright --load-storage=auth.json codegen my.web.app
# Perform actions in authenticated state.
```

```sh python
$ playwright --load-storage=auth.json open my.web.app
$ playwright --load-storage=auth.json codegen my.web.app
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

## Open pages

With `open`, you can use Playwright bundled browsers to browse web pages. Playwright provides cross-platform WebKit builds that can be used to reproduce Safari rendering across Windows, Linux and macOS.

```sh js
# Open page in Chromium
$ npx playwright open example.com
```

```sh python
# Open page in Chromium
$ playwright open example.com
```

```sh js
# Open page in WebKit
$ npx playwright wk example.com
```

```sh python
# Open page in WebKit
$ playwright wk example.com
```

### Emulate devices
`open` can emulate mobile and tablet devices from the [`playwright.devices`](https://playwright.dev/docs/api/class-playwright#playwrightdevices) list.

```sh js
# Emulate iPhone 11.
$ npx playwright --device="iPhone 11" open wikipedia.org
```

```sh python
# Emulate iPhone 11.
$ playwright --device="iPhone 11" open wikipedia.org
```

### Emulate color scheme and viewport size
```sh js
# Emulate screen size and color scheme.
$ npx playwright --viewport-size=800,600 --color-scheme=dark open twitter.com
```
```sh python
# Emulate screen size and color scheme.
$ playwright --viewport-size=800,600 --color-scheme=dark open twitter.com
```

### Emulate geolocation, language and timezone
```sh js
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
$ npx playwright --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" open maps.google.com
```
```sh python
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
$ playwright --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" open maps.google.com
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
$ npx playwright screenshot --help
```

```sh python
# See command help
$ playwright screenshot --help
```

```sh js
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
$ npx playwright \
  --device="iPhone 11" \
  --color-scheme=dark \
  screenshot \
    --wait-for-timeout=3000 \
    twitter.com twitter-iphone.png
```

```sh python
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
$ playwright \
  --device="iPhone 11" \
  --color-scheme=dark \
  screenshot \
    --wait-for-timeout=3000 \
    twitter.com twitter-iphone.png
```

```sh js
# Capture a full page screenshot
$ npx playwright screenshot --full-page en.wikipedia.org wiki-full.png
```

```sh python
# Capture a full page screenshot
$ playwright screenshot --full-page en.wikipedia.org wiki-full.png
```

## Generate PDF

PDF generation only works in Headless Chromium.

```sh js
# See command help
$ npx playwright pdf https://en.wikipedia.org/wiki/PDF wiki.pdf
```

```sh python
# See command help
$ playwright pdf https://en.wikipedia.org/wiki/PDF wiki.pdf
```

## Known limitations
Opening WebKit Web Inspector will disconnect Playwright from the browser. In such cases, code generation will stop.
