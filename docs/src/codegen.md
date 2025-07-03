---
id: codegen
title: "Test generator"
---

import LiteYouTube from '@site/src/components/LiteYouTube';

## Introduction

Playwright comes with the ability to generate tests for you as you perform actions in the browser and is a great way to quickly get started with testing. Playwright will look at your page and figure out the best locator, prioritizing [role, text and test id locators](./locators.md). If the generator finds multiple elements matching the locator, it will improve the locator to make it resilient that uniquely identify the target element.

## Generate tests in VS Code
* langs: js

Install the VS Code extension and generate tests directly from VS Code. The extension is available on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=ms-playwright.playwright). Check out our guide on [getting started with VS Code](./getting-started-vscode.md).

<LiteYouTube
    id="LM4yqrOzmFE"
    title="Generating Playwright tests in VS Code"
/>

### Record a New Test

To record a test click on the **Record new** button from the Testing sidebar. This will create a `test-1.spec.ts` file as well as open up a browser window.

<img width="1385" alt="record new in vs code" src="https://user-images.githubusercontent.com/13063165/220961665-615d0ab8-3f0b-439c-ad0b-0424d9aa154b.png" />

In the browser go to the URL you wish to test and start clicking around to record your user actions.

![generating user actions](https://github.com/microsoft/playwright/assets/13063165/1d4c8f37-8325-4816-a665-d0e95e63f509)

Playwright will record your actions and generate the test code directly in VS Code. You can also generate assertions by choosing one of the icons in the toolbar and then clicking on an element on the page to assert against. The following assertions can be generated:
  * `'assert visibility'` to assert that an element is visible
  * `'assert text'` to assert that an element contains specific text
  * `'assert value'` to assert that an element has a specific value

![generating assertions](https://github.com/microsoft/playwright/assets/13063165/d131eb35-b2ca-4bf4-a8ac-88b6e40dcf07)

Once you are done recording click the **cancel** button or close the browser window. You can then inspect your `test-1.spec.ts` file and manually improve it if needed.

![code from a generated test](https://github.com/microsoft/playwright/assets/13063165/2ba4c212-4713-460a-b054-6dc6b67a9a7c)

### Record at Cursor

To record from a specific point in your test move your cursor to where you want to record more actions and then click the **Record at cursor** button from the Testing sidebar. If your browser window is not already open then first run the test with 'Show browser' checked and then click the **Record at cursor** button.


![record at cursor in vs code](https://github.com/microsoft/playwright/assets/13063165/77948ab8-92a2-435f-9833-0944da5ae664)

In the browser window start performing the actions you want to record.

<img width="1394" alt="add feed the dog to todo app" src="https://user-images.githubusercontent.com/13063165/220960770-6435cec7-1723-42a8-8c1f-8244e2d800c7.png" />


In the test file in VS Code you will see your new generated actions added to your test at the cursor position.

![code from a generated test](https://github.com/microsoft/playwright/assets/13063165/4f4bb34e-9cda-41fe-bf65-8d8016d84c7f)

### Generating locators

You can generate locators with the test generator.
- Click on the **Pick locator** button form the testing sidebar and then hover over elements in the browser window to see the [locator](./locators.md) highlighted underneath each element.
- Click the element you require and it will now show up in the **Pick locator** box in VS Code.
- Press <kbd>Enter</kbd> on your keyboard to copy the locator into the clipboard and then paste anywhere in your code. Or press 'escape' if you want to cancel.

<img width="1641" alt="Pick locators in VS code" src="https://user-images.githubusercontent.com/13063165/220958368-95b03620-3c9b-40a8-be74-01c96ba03cad.png" />

## Generate tests with the Playwright Inspector

When running the `codegen` command two windows will be opened, a browser window where you interact with the website you wish to test and the Playwright Inspector window where you can record your tests and then copy them into your editor.

### Running Codegen

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

Run the `codegen` command and perform actions in the browser window. Playwright will generate the code for the user interactions which you can see in the Playwright Inspector window. Once you have finished recording your test stop the recording and press the **copy** button to copy your generated test into your editor.

With the test generator you can record:
* Actions like click or fill by simply interacting with the page
* Assertions by clicking on one of the icons in the toolbar and then clicking on an element on the page to assert against. You can choose:
  * `'assert visibility'` to assert that an element is visible
  * `'assert text'` to assert that an element contains specific text
  * `'assert value'` to assert that an element has a specific value

######
* langs: js

![Recording a test](https://github.com/microsoft/playwright/assets/13063165/34a79ea1-639e-4cb3-8115-bfdc78e3d34d)

######
* langs: java

![recording a test](https://github.com/microsoft/playwright/assets/13063165/ec9c4071-4af8-4ae7-8b36-aebcc29bdbbb)

######
* langs: python

![recording a test](https://github.com/microsoft/playwright/assets/13063165/9751b609-6e4c-486b-a961-f86f177b1d58)

######
* langs: csharp

![recording a test](https://github.com/microsoft/playwright/assets/13063165/53bdfb6f-d462-4ce0-ab95-0619faaebf1e)

######
* langs: js, java, python, csharp

When you have finished interacting with the page, press the **record** button to stop the recording and use the **copy** button to copy the generated code to your editor.

Use the **clear** button to clear the code to start recording again. Once finished, close the Playwright inspector window or stop the terminal command.

### Generating locators
You can generate [locators](/locators.md) with the test generator.

* Press the `'Record'` button to stop the recording and the `'Pick Locator'` button will appear.
* Click on the `'Pick Locator'` button and then hover over elements in the browser window to see the locator highlighted underneath each element.
* To choose a locator, click on the element you would like to locate and the code for that locator will appear in the field next to the Pick Locator button.
* You can then edit the locator in this field to fine tune it or use the copy button to copy it and paste it into your code.

######
* langs: js

![picking a locator](https://github.com/microsoft/playwright/assets/13063165/2c8a12e2-4e98-4fdd-af92-1d73ae696d86)

######
* langs: java

![picking a locator](https://github.com/microsoft/playwright/assets/13063165/733b48fd-5edf-4150-93f0-018adc52b6ff)

######
* langs: python

![picking a locator](https://github.com/microsoft/playwright/assets/13063165/95d11f48-96a4-46b9-9c2a-63c3aa4fdce7)

######
* langs: csharp

![picking a locator](https://github.com/microsoft/playwright/assets/13063165/1478f56f-422f-4276-9696-0674041f11dc)

## Emulation

You can use the test generator to generate tests using emulation so as to generate a test for a specific viewport, device, color scheme, as well as emulate the geolocation, language or timezone. The test generator can also generate a test while preserving authenticated state.

### Emulate viewport size

Playwright opens a browser window with its viewport set to a specific width and height and is not responsive as tests need to be run under the same conditions. Use the `--viewport` option to generate tests with a different viewport size.

```bash js
npx playwright codegen --viewport-size="800,600" playwright.dev
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen --viewport-size='800,600' playwright.dev"
```

```bash python
playwright codegen --viewport-size="800,600" playwright.dev
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --viewport-size="800,600" playwright.dev
```
######
* langs: js

<img width="870" alt="Codegen generating code for tests for playwright.dev website with a specific viewport js" src="https://user-images.githubusercontent.com/13063165/220402029-f90d1c9f-d740-4c0f-acc8-95235ee83f85.png" />

######
* langs: java

<img width="870" alt="Codegen generating code for tests for playwright.dev website with a specific viewport java" src="https://user-images.githubusercontent.com/13063165/220402748-12a856c2-b3ff-4155-b82d-64dad9c46886.png" />

######
* langs: python

<img width="870" alt="Codegen generating code for tests for playwright.dev website with a specific viewport python" src="https://user-images.githubusercontent.com/13063165/220403118-7704b708-dea3-44b3-97a4-04c2b9d1d0fa.png" />

######
* langs: csharp

<img width="870" alt="Codegen generating code for tests for playwright.dev website with a specific viewport dotnet" src="https://user-images.githubusercontent.com/13063165/220403496-4a46a9a1-4bc4-43e7-8f22-9cc760ceadaf.png" />


### Emulate devices

Record scripts and tests while emulating a mobile device using the `--device` option which sets the viewport size and user agent among others.

```bash js
npx playwright codegen --device="iPhone 13" playwright.dev
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args='codegen --device="iPhone 13" playwright.dev'
```

```bash python
playwright codegen --device="iPhone 13" playwright.dev
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --device="iPhone 13" playwright.dev
```
######
* langs: js

<img width="1300" alt="Codegen generating code for tests for playwright.dev website emulated for iPhone 13 js" src="https://user-images.githubusercontent.com/13063165/220921482-dc4f5532-9dce-40bd-8a28-e0d87d26a601.png" />

######
* langs: java

<img width="1300" alt="Codegen generating code for tests for playwright.dev website emulated for iPhone 13 java" src="https://user-images.githubusercontent.com/13063165/220922591-241e6a59-a920-4cb1-97a2-d46c33ea17c5.png" />

######
* langs: python

<img width="1300" alt="Codegen generating code for tests for playwright.dev website emulated for iPhone 13 python" src="https://user-images.githubusercontent.com/13063165/220922790-5c5a4d1a-e27d-4c9b-90ac-13cf9c925706.png" />

######
* langs: csharp

<img width="1300" alt="Codegen generating code for tests for playwright.dev website emulated for iPhone 13 csharp" src="https://user-images.githubusercontent.com/13063165/220923048-f13583b1-ab08-4702-ab74-58691d50acfe.png" />


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

######
* langs: js

<img width="1394" alt="Codegen generating code for tests for playwright.dev website in dark mode js" src="https://user-images.githubusercontent.com/13063165/220930273-f3a25bae-64dd-4bbb-99ed-1e97c0cb1ebf.png" />

######
* langs: java

<img width="1394" alt="Codegen generating code for tests for playwright.dev website in dark mode java" src="https://user-images.githubusercontent.com/13063165/220930514-3b105fab-c87e-4f58-affa-d11d570122a8.png" />

######
* langs: python

<img width="1394" alt="Codegen generating code for tests for playwright.dev website in dark mode python" src="https://user-images.githubusercontent.com/13063165/220930714-737647fd-ae99-4dd3-b7a4-4f3eb4fe712d.png" />

######
* langs: csharp

<img width="1394" alt="Codegen generating code for tests for playwright.dev website in dark mode csharp" src="https://user-images.githubusercontent.com/13063165/220930893-c1d0df65-c662-4b33-91eb-ea10552d7cc5.png" />

### Emulate geolocation, language and timezone

Record scripts and tests while emulating timezone, language & location using the `--timezone`, `--geolocation` and `--lang` options. Once the page opens:

1. Accept the cookies
1. On the top right, click on the locate me button to see geolocation in action.

```bash js
npx playwright codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" bing.com/maps
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args='codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" bing.com/maps'
```

```bash python
playwright codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" bing.com/maps
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" bing.com/maps
```

######
* langs: js

<img width="1394" alt="Codegen generating code for tests for bing maps showing timezone, geolocation as Rome, Italy and in Italian language" src="https://user-images.githubusercontent.com/13063165/220931996-d3144421-8d3b-4f9f-896c-769c01566c01.png" />

######
* langs: java

<img width="1394" alt="Codegen generating code for tests for bing maps showing timezone, geolocation as Rome, Italy and in Italian language java" src="https://user-images.githubusercontent.com/13063165/220932268-9012163f-7673-4072-aa91-13b3c8f57799.png" />

######
* langs: python

<img width="1394" alt="Codegen generating code for tests for bing maps showing timezone, geolocation as Rome, Italy and in Italian language python" src="https://user-images.githubusercontent.com/13063165/220932413-f2943956-dd38-4560-94b9-51968076210d.png" />


######
* langs: csharp

<img width="1394" alt="Codegen generating code for tests for bing maps showing timezone, geolocation as Rome, Italy and in Italian language csharp" src="https://user-images.githubusercontent.com/13063165/220932688-a47df2a8-332b-47a4-9580-7d351def9f50.png" />

### Preserve authenticated state

Run `codegen` with `--save-storage` to save [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies), [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) data at the end of the session. This is useful to separately record an authentication step and reuse it later when recording more tests.

```bash js
npx playwright codegen github.com/microsoft/playwright --save-storage=auth.json
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen github.com/microsoft/playwright  --save-storage=auth.json"
```

```bash python
playwright codegen github.com/microsoft/playwright --save-storage=auth.json
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen github.com/microsoft/playwright --save-storage=auth.json
```

######
* langs: js

<img width="1394" alt="github page before logging in js" src="https://user-images.githubusercontent.com/13063165/220929062-88dfe567-0c6d-4e49-b9f9-74ae241fb8c7.png" />


######
* langs: java

<img width="1394" alt="github page before logging in java" src="https://user-images.githubusercontent.com/13063165/220929236-08129e16-82a9-46a3-9f1c-3e59619c6289.png" />


######
* langs: python

<img width="1394" alt="github page before logging in python" src="https://user-images.githubusercontent.com/13063165/220929429-8756ec49-fbf2-46e0-8f41-d25f5f5a6623.png" />

######
* langs: csharp

<img width="1394" alt="github page before logging in csharp" src="https://user-images.githubusercontent.com/13063165/220929619-28d4ed0c-d172-4cf1-b30b-bf5bed0e07bf.png" />

#### Login

After performing authentication and closing the browser, `auth.json` will contain the storage state which you can then reuse in your tests.

<img width="1394" alt="login to GitHub screen" src="https://user-images.githubusercontent.com/13063165/220561688-04b2b984-4ba6-4446-8b0a-8058876e2a02.png" />

Make sure you only use the `auth.json` locally as it contains sensitive information. Add it to your `.gitignore` or delete it once you have finished generating your tests.

#### Load authenticated state

Run with `--load-storage` to consume the previously loaded storage from the `auth.json`. This way, all [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies), [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) and [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) data will be restored, bringing most web apps to the authenticated state without the need to login again. This means you can continue generating tests from the logged in state.

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

######
* langs: js

<img width="1394" alt="github signed in showing use of load storage js" src="https://user-images.githubusercontent.com/13063165/220927873-9e55fdda-2def-45c1-9a1b-bcc851885f96.png" />


######
* langs: java

<img width="1394" alt="github signed in showing use of load storage java" src="https://user-images.githubusercontent.com/13063165/220928075-1e38347b-9d0d-4d9e-9a67-506c717893df.png" />

######
* langs: python

<img width="1394" alt="github signed in showing use of load storage python" src="https://user-images.githubusercontent.com/13063165/220928211-ca1d4dc9-9966-414e-ab23-a3ef1d2d5ed9.png" />

######
* langs: csharp

<img width="1394" alt="github signed in showing use of load storage scharp" src="https://user-images.githubusercontent.com/13063165/220928354-caa0e958-fe09-4125-9b54-67483064da51.png" />

#### Use existing userDataDir

Run `codegen` with `--user-data-dir` to set a fixed [user data directory](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context-option-user-data-dir) for the browser session. If you create a custom browser user data directory, codegen will use this existing browser profile and have access to any authentication state present in that profile.

:::warning
[As of Chrome 136, the default user data directory cannot be accessed via automated tooling](https://developer.chrome.com/blog/remote-debugging-port), such as Playwright. You must create a separate user data directory for use in testing.
:::

```bash js
npx playwright codegen --user-data-dir=/path/to/your/browser/data/ github.com/microsoft/playwright
```

```bash java
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="codegen --user-data-dir=/path/to/your/browser/data/ github.com/microsoft/playwright"
```

```bash python
playwright codegen --user-data-dir=/path/to/your/browser/data/ github.com/microsoft/playwright
```

```bash csharp
pwsh bin/Debug/netX/playwright.ps1 codegen --user-data-dir=/path/to/your/browser/data/ github.com/microsoft/playwright
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
var browser = await chromium.LaunchAsync(new() { Headless = false });

// Setup context however you like.
var context = await browser.NewContextAsync(); // Pass any options
await context.RouteAsync("**/*", route => route.ContinueAsync());

// Pause the page, and start recording manually.
var page = await context.NewPageAsync();
await page.PauseAsync();
```
