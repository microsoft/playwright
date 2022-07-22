---
id: playwright-test-vs-library
title: "Playwright Test vs. Library"
---


Playwright Library provides unified APIs for launching and interacting with browsers, while Playwright Test provides all this plus a fully managed end-to-end Test Runner and experience.

Under most circumstances, for end-to-end testing, you'll want to use `@playwright/test` (Playwright Test), and not `playwright` (Playwright Library) directly.

## When Should Playwright Library Be Used Directly?

- creating an integration for a third party test runner (e.g. the third-party runner plugins listed [here](./test-runners.md) are built on top of Playwright Library)
- automation and scraping

## Differences

### Library Example

The following is an example of using the Playwright Library directly to launch Chromium, go to a page, and check its title:


```js tab=js-ts
import playwright, { devices } from "playwright";

(async () => {
  // Setup
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext(devices["iPhone 11"]);
  const page = await context.newPage();

  // The actual interesting bit
  await context.route("**.jpg", route => route.abort());
  await page.goto("https://example.com/");

  assert(await page.title() === "Example"); // 👎 not a Web First assertion

  // Teardown
  await context.close();
  await browser.close();
})()
```

```js tab=js-js
const playwright = require("playwright");

(async () => {
  // Setup
  const browser = await playwright.chromium.launch();
  const context = await browser.newContext(devices["iPhone 11"]);
  const page = await context.newPage();

  // The actual interesting bit
  await context.route("**.jpg", route => route.abort());
  await page.goto("https://example.com/");

  assert(await page.title() === "Example"); // 👎 not a Web First assertion

  // Teardown
  await context.close();
  await browser.close();
})()
```

Run via:

```bash tab=js-ts
node ./my-script.ts
```

```bash tab=js-js
node ./my-script.js
```

### Test Example

A test to achieve similar behavior, would look like:

```js tab=js-ts
import { expect, test, devices } from "@playwright/test";

test.use(devices["iPhone 11"]);

test("should be titled", async ({ page, context }) => {
  await context.route("**.jpg", route => route.abort());
  await page.goto("https://example.com/");

  await expect(page).toHaveTitle("Example");
});
```

```js tab=js-js
const { expect, test, devices } = require("@playwright/test");

test.use(devices["iPhone 11"]);

test("should be titled", async ({ page, context }) => {
  await context.route("**.jpg", route => route.abort());
  await page.goto("https://example.com/");

  await expect(page).toHaveTitle("Example");
});
```

Run via:

```
npx playwright test
```

### Key Differences

The key differences to note are as follows:

| | Library | Test |
| - | - | - |
| Installation | `npm install playwright` | `npm init playwright@latest` (note `install` vs. `init`) |
| `import`/`require` name | `playwright` | `@playwright/test` |
| Initialization | Explicitly need to: <ol><li>Pick a browser to use (e.g. `chromium`)</li><li>Create `browser` ([`method: BrowserType.launch`])</li><li>Create a `context` ([`method: Browser.newContext`]), <em>and</em> pass any context options explcitly (e.g. `devices["iPhone 11"]`</li><li>Create a `page` ([`method: BrowserContext.newPage`])</li></ol> | An isolated `page` and `context` are provided to each test out-of the box (along with any other [built-in fixtures](./test-fixtures.md#built-in-fixtures)). No explicit creation. If referenced by the test in it's arguments, the Test Runner will create them for the test. (i.e. lazy-initialization) |
| Assertions | No built-in Web-First Assertions | [Web-First assertions](./test-assertions.md) like: <ul><li>[`method: PageAssertions.toHaveTitle`]</li><li>[`method: PageAssertions.toHaveScreenshot#1`]</li></ul> |
| Cleanup | Explicitly need to: <ol><li>Close `context`  ([`method: BrowserContext.close`])</li><li>Close `browser`  ([`method: Browser.close`])</li></ol> | No explicit close of [built-in fixtures](./test-fixtures.md#built-in-fixtures); the Test Runner will take care of it.
| Running | When using the Library, you run the code as a node script (possibly with some compilation first). | When using the Test Runner, you use the `npx playwright test` command. Along with your [config](./test-configuration.md)), the Test Runner handles any compilation and choosing what to run and how to run it. |

In addition to the above, Playwright Test—as a full-featured Test Runner—includes:

- [Configuration Matrix and Projects](./test-configuration.md): In the above example, in the Playwright Library version, if we wanted to run with a different device or browser, we'd have to modify the script and plumb the information through. With Playwright Test, we can just specify the [matrix of configurations](./test-configuration.md) in one place, and it will create run the one test under each of these configurations. 
- [Parallelization](./test-parallel.md)
- [Web-First Assertions](./test-assertions.md)
- [Reporting](./test-reporters.md)
- [Retries](./test-retries.md)
- [Easily Enabled Tracing](./test-configuration.md#record-test-trace)
- and more…