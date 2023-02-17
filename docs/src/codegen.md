---
id: codegen
title: "Test Generator"
---

Playwright comes with the ability to generate tests out of the box and is a great way to quickly get started with testing. It will open two windows, a browser window where you interact with the website you wish to test and the Playwright Inspector window where you can record your tests, copy the tests, clear your tests as well as change the language of your tests.

<video width="100%" height="100%" controls muted>
  <source src="https://user-images.githubusercontent.com/13063165/197979804-c4fa3347-8fab-4526-a728-c1b2fbd079b4.mp4" type="video/mp4" />
  Your browser does not support the video tag.
</video>

## Running Codegen

Use the `codegen` command to run the test generator followed by the URL of the website you want to generate tests for. The URL is optional and you can always run the command without it and then add the URL directly into the browser window instead.

```bash js
npx playwright codegen demo.playwright.dev/todomvc
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen demo.playwright.dev/todomvc"
```

```bash python
playwright codegen demo.playwright.dev/todomvc
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen demo.playwright.dev/todomvc
```

### Recording a test

Run `codegen` and perform actions in the browser. Playwright will generate the code for the user interactions. `Codegen` will look at the rendered page and figure out the recommended locator, prioritizing role, text and test id locators. If the generator identifies multiple elements matching the locator, it will improve the locator to make it resilient and uniquely identify the target element, therefore eliminating and reducing test(s) failing and flaking due to locators.

######
* langs: js

<img width="1365" alt="Recording a test" src="https://user-images.githubusercontent.com/13063165/212754505-b98e80fd-6dda-48f7-860b-b32b4fabee33.png" />

######
* langs: java

<img width="1365" alt="Recording a test" src="https://user-images.githubusercontent.com/13063165/212754804-0d9f9d52-0a48-45c8-970d-e672d4a91221.png" />

######
* langs: python

<img width="1365" alt="Recording a test" src="https://user-images.githubusercontent.com/13063165/212751993-b7da2c40-a7cc-4b13-9a91-40ee837042a1.png" />

######
* langs: csharp

<img width="1365" alt="Screenshot 2023-01-16 at 20 42 26" src="https://user-images.githubusercontent.com/13063165/212754994-fa637d81-b81d-44b8-bcd7-5dc218034f0a.png" />

When you have finished interacting with the page, press the **record** button to stop the recording and use the **copy** button to copy the generated code to your editor.

Use the **clear** button to clear the code to start recording again. Once finished close the Playwright inspector window or stop the terminal command.

To learn more about generating tests check out or detailed guide on [Codegen](./codegen.md).

### Generating locators
You can generate [locators](/locators.md) with the test generator. 

* Press the `'Record'` button to stop the recording and the `'Pick Locator'` button will appear.
* Click on the `'Pick Locator'` button and then hover over elements in the browser window to see the locator highlighted underneath each element. 
* To choose a locator click on the element you would like to locate and the code for that locator will appear in the field next to the Pick Locator button.
* You can then edit the locator in this field to fine tune it or use the copy button to copy it and paste it into your code.

######
* langs: js

<img width="1321" alt="Picking a locator" src="https://user-images.githubusercontent.com/13063165/212753129-55fbcf69-0be3-422e-888a-f52060c7aa6b.png" />

######
* langs: java

<img width="1321" alt="Picking a locator" src="https://user-images.githubusercontent.com/13063165/212753446-456484a8-8c37-4104-8db5-4525b74c8cf1.png" />

######
* langs: python

<img width="1321" alt="Picking a locator" src="https://user-images.githubusercontent.com/13063165/212753605-861d66a4-fc1c-4559-b821-cb1f39059337.png" />

######
* langs: csharp

<img width="1321" alt="Picking a locator" src="https://user-images.githubusercontent.com/13063165/212753728-49d35a7c-c05a-4298-bf66-89930d2cb578.png" />

## Emulation

You can use the test generator to generate tests using emulation so as to generate a test for a specific viewport, device, color scheme, as well as emulate the geolocation, language or timezone. The test generator can also generate a test while preserving authenticated state.

### Emulate viewport size

Playwright opens a browser window with it's viewport set to a specific width and height and is not responsive as tests need to be run under the same conditions. Use the `--viewport` option to generate tests with a different viewport size.

```bash js
npx playwright codegen --viewport-size=800,600 playwright.dev
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen --viewport-size=800,600 playwright.dev"
```

```bash python
playwright codegen --viewport-size=800,600 playwright.dev
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --viewport-size=800,600 playwright.dev
```

<img width="1409" alt="Codegen generating code for tests for playwright.dev website with a specific viewport" src="https://user-images.githubusercontent.com/13063165/182360039-6db79ad6-fe82-4fd6-900a-b5e25f7f720f.png" />

### Emulate devices

Record scripts and tests while emulating a mobile device using the `--device` option which sets the viewport size and user agent among others.

```bash js
npx playwright codegen --device="iPhone 11" playwright.dev
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args='codegen --device="iPhone 11" playwright.dev'
```

```bash python
playwright codegen --device="iPhone 11" playwright.dev
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --device="iPhone 11" playwright.dev
```

<img width="1254" alt="Codegen generating code for tests for playwright.dev website emulated for iPhone 11" src="https://user-images.githubusercontent.com/13063165/197976789-ee25ed24-69af-4684-b6a4-098673cfb035.png" />

### Emulate color scheme

Record scripts and tests while emulating the color scheme with the `--color-scheme` option.

```bash js
npx playwright codegen --color-scheme=dark playwright.dev
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen --color-scheme=dark playwright.dev"
```

```bash python
playwright codegen --color-scheme=dark playwright.dev
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --color-scheme=dark playwright.dev
```

<img width="1258" alt="Codegen generating code for tests for playwright.dev website in dark mode" src="https://user-images.githubusercontent.com/13063165/182359371-0bb4a7a2-abbb-4f73-8550-d67e0101f0ad.png" />

### Emulate geolocation, language and timezone

Record scripts and tests while emulating timezone, language & location using the `--timezone`, `--geolocation` and `--lang` options. Once page opens, click the "show your location" icon at them bottom right corner of the map to see geolocation in action.

```bash js
npx playwright codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args='codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com'
```

```bash python
playwright codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" maps.google.com
```

<img width="1276" alt="Codegen generating code for tests for google maps showing timezone, geolocation as Rome, Italy and in Italian language" src="https://user-images.githubusercontent.com/13063165/182394434-73e1c2a8-767e-411a-94e4-0912c1c50ecc.png" />

### Preserve authenticated state

Run `codegen` with `--save-storage` to save [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) at the end of the session. This is useful to separately record an authentication step and reuse it later in the tests.

After performing authentication and closing the browser, `auth.json` will contain the storage state.

```bash js
npx playwright codegen --save-storage=auth.json
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen  --save-storage=auth.json"
```

```bash python
playwright codegen --save-storage=auth.json
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --save-storage=auth.json
```

<img width="1264" alt="Screenshot 2022-08-03 at 13 28 02" src="https://user-images.githubusercontent.com/13063165/182599605-df2fbd05-622b-4cd7-8a32-0abdfea7d38d.png" />

Run with `--load-storage` to consume previously loaded storage. This way, all [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) will be restored, bringing most web apps to the authenticated state without the need to login again.

```bash js
npx playwright codegen --load-storage=auth.json github.com/microsoft/playwright
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen --load-storage=auth.json github.com/microsoft/playwright"
```

```bash python
playwright codegen --load-storage=auth.json github.com/microsoft/playwright
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --load-storage=auth.json github.com/microsoft/playwright
```

<img width="1261" alt="Screenshot 2022-08-03 at 13 33 40" src="https://user-images.githubusercontent.com/13063165/182599680-05297b4e-c258-4416-8daa-b8637c1db120.png" />

Use the `open` command with `--load-storage` to open the saved `auth.json`.

```bash js
npx playwright open --load-storage=auth.json github.com/microsoft/playwright
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="open --load-storage=auth.json github.com/microsoft/playwright"
```

```bash python
playwright open --load-storage=auth.json github.com/microsoft/playwright
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 open --load-storage=auth.json github.com/microsoft/playwright
```


## Record using custom setup

If you would like to use codegen in some non-standard setup (for example, use [`method: BrowserContext.route`]), it is possible to call [`method: Page.pause`] that will open a separate window with codegen controls.

```js
const { chromium } = require('@playwright/test');

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
