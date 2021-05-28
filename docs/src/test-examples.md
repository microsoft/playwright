---
id: test-examples
title: "Examples"
---

<!-- TOC -->

<br/>

## Multiple pages

The default `context` argument is a [BrowserContext][browser-context]. Browser contexts are isolated execution environments that can host multiple pages. See [multi-page scenarios](./multi-pages.md) for more examples.

```js
import { test } from "playwright/test";

test("tests on multiple web pages", async ({ context }) => {
  const pageFoo = await context.newPage();
  const pageBar = await context.newPage();
  // Test function
});
```

## Mobile emulation

`use` section in the configuration file can be used to configure mobile emulation in the default `context`.

```js
// config.ts
import { PlaywrightTestConfig } from "playwright/test";
import { devices } from "playwright";

const config: PlaywrightTestConfig = {
  timeout: 30000,
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        headless: true,
        ...devices["Pixel 2"],
      },
    },
  ],
};
export default config;
```

## Network mocking

Define a custom route that mocks network calls for a browser context.

```js
// In foo.spec.ts
import { test, expect } from "playwright/test";

test.beforeEach(async ({ context }) => {
  // Block any css requests for each test in this file.
  await context.route(/.css/, route => route.abort());
});

test("loads page without css", async ({ page }) => {
  // Alternatively, block any png requests just for this test.
  await page.route(/.png/, route => route.abort());

  // Test function code.
  await page.goto("https://stackoverflow.com");
});
```

## Visual comparisons

The `expect` API supports visual comparisons with `toMatchSnapshot`. This uses the [pixelmatch](https://github.com/mapbox/pixelmatch) library, and you can pass `threshold` as an option.

```js
import { test, expect } from "playwright/test";

test("compares page screenshot", async ({ page }) => {
  await page.goto("https://stackoverflow.com");
  const screenshot = await page.screenshot();
  expect(screenshot).toMatchSnapshot(`test.png`, { threshold: 0.2 });
});
```

On first execution, this will generate golden snapshots. Subsequent runs will compare against the golden snapshots. To update golden snapshots with new actual values, run with the `--update-snapshots` flag.

```sh
# Update golden snapshots when they differ from actual
npx playwright test --update-snapshots
```

### Page object model

To introduce a Page Object for a particular page, create a class that will use the `page` object.

Create a `LoginPage` helper class to encapsulate common operations on the login page.
```js
// login-page.ts
import type { Page } from "playwright";

export class LoginPage {
  page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto("https://example.com/login");
  }

  async login() {
    await this.page.fill("#username", TEST_USERNAME);
    await this.page.fill("#password", TEST_PASSWORD);
    await this.page.click("text=Login");
  }
}
```

Use the `LoginPage` class in the tests.
```js
// my.spec.ts
import { test, expect } from "playwright/test";
import { LoginPage } from "./login-page";

test('login works', async ({ page }) => {
  // Create the login page and perform operations.
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login();

  // Verify it worked.
  expect(await page.textContent("#user-info")).toBe("Welcome, Test User!");
});
```
