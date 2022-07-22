---
id: playwright-test-vs-library
title: "Playwright Test vs. Library"
---

Playwright Library provides unified APIs for launching and interacting with browsers, while Playwright Test provides all this plus a fully managed end-to-end Test Runner and experience.

Under most circumstances, for end-to-end testing, you'll want to use `@playwright/test` (Playwright Test), and not `playwright` (Playwright Library) directly. See the [Getting Started](./intro.md) for the features provided by the Test Runner.

## When Should Playwright Library Be Used Directly?

- creating an integration for a third party test runner (e.g. the third-party runner plugins listed [here](./test-runners.md) are built on top of Playwright Library)
- automation and scraping

## Example

The following is an example of using the Playwright Library directly to launch a few different emulated devices, go to a page, get its title, and generate screenshots:

```js tab=js-ts
import playwright from "playwright";

(async () => {
  const TARGET_DEVICES = [
    "Desktop Safari",
    "Desktop Firefox",
    "Desktop Chrome",
    "iPhone 11",
  ];

  for (const deviceName of TARGET_DEVICES) {
    // Set up
    console.log("Running for…", deviceName);
    const device = playwright.devices[deviceName];
    console.log("Starting browser…", device.defaultBrowserType);
    console.log("User-Agent", device.userAgent);
    console.log("Viewport Dimensions:", device.viewport);
    const browser = await playwright[device.defaultBrowserType].launch();
    const context = await browser.newContext({
      ...device,
      // specify any other context options
      colorScheme: "dark",
    });
    const page = await context.newPage();

    // Interact with the page
    console.log("Navigating…");
    await page.goto("https://playwright.dev");
    console.log("Title:", await page.title());
    console.log("Taking screenshot…");
    await page.screenshot({ path: `${deviceName}.png` });

    // Graceful cleanup
    console.log("Cleaning up…");
    await context.close();
    await browser.close();
  }
})();
```

```js tab=js-js
const playwright = require("playwright");

(async () => {
  const TARGET_DEVICES = [
    "Desktop Safari",
    "Desktop Firefox",
    "Desktop Chrome",
    "iPhone 11",
  ];

  for (const deviceName of TARGET_DEVICES) {
    // Set up
    console.log("Running for…", deviceName);
    const device = playwright.devices[deviceName];
    console.log("Starting browser…", device.defaultBrowserType);
    console.log("User-Agent", device.userAgent);
    console.log("Viewport Dimensions:", device.viewport);
    const browser = await playwright[device.defaultBrowserType].launch();
    const context = await browser.newContext({
      ...device,
      // specify any other context options
      colorScheme: "dark",
    });
    const page = await context.newPage();

    // Interact with the page
    console.log("Navigating…");
    await page.goto("https://playwright.dev");
    console.log("Title:", await page.title());
    console.log("Taking screenshot…");
    await page.screenshot({ path: `${deviceName}.png` });

    // Graceful cleanup
    console.log("Cleaning up…");
    await context.close();
    await browser.close();
  }
})();
```

Run via:

```bash tab=js-ts
node ./my-script.ts
```

```bash tab=js-js
node ./my-script.js
```

### Required Steps

|                | Library                                                                                                                                                                                                                                                                                                                                                 |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Installation   | `npm install playwright`                                                                                                                                                                                                                                                                                                                                |
| Initialization | <ol><li>Pick a browser to use (e.g. `chromium` or select it based on device)</li><li>Create `browser` ([`method: BrowserType.launch`])</li><li>Create a `context` ([`method: Browser.newContext`]), <em>and</em> pass any context options explcitly (e.g. `devices["iPhone 11"]`</li><li>Create a `page` ([`method: BrowserContext.newPage`])</li></ol> |
| Interacting    | Use any of the Playwright APIs.                                                                                                                                                                                                                                                                                                                         |
| Cleanup        | <ol><li>Close `context` ([`method: BrowserContext.close`])</li><li>Close `browser` ([`method: Browser.close`])</li></ol>                                                                                                                                                                                                                                |
| Running        | When using the Library, you run the code as a node script (possibly with some compilation first).                                                                                                                                                                                                                                                       |
