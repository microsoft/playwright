---
id: writing-tests
title: "Writing Tests"
---

Playwright assertions are created specifically for the dynamic web. Checks are automatically retried until the necessary conditions are met. Playwright comes with [auto-wait](./actionability.md) built in meaning it waits for elements to be actionable prior to performing actions. Playwright provides a [test](./api/class-test.md) function to declare tests and the [expect](https://jestjs.io/docs/expect) function to write assertions.

**You will learn**

- [How the example test works](/writing-tests.md#the-example-test)
- [How to use assertions](/writing-tests.md#assertions)
- [How to use locators](/writing-tests.md#locators)
- [How tests run in isolation](/writing-tests.md#test-isolation)
- [How to use test hooks](/writing-tests.md#using-test-hooks)

## The Example Test

Take a look at the example test included when installing Playwright to see how to write a test using [web first assertions](/test-assertions.md), [locators](/locators.md) and [selectors](/selectors.md).

```js tab=js-js
// @ts-check
const { test, expect } = require('@playwright/test');

test('homepage has Playwright in title and get started link linking to the intro page', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);

  // create a locator
  const getStarted = page.locator('text=Get Started');

  // Expect an attribute "to be strictly equal" to the value.
  await expect(getStarted).toHaveAttribute('href', '/docs/intro');

  // Click the get started link.
  await getStarted.click();
 
  // Expects the URL to contain intro.
  await expect(page).toHaveURL(/.*intro/);
});
```

```js tab=js-ts
import { test, expect } from '@playwright/test';

test('homepage has Playwright in title and get started link linking to the intro page', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/Playwright/);

  // create a locator
  const getStarted = page.locator('text=Get Started');

  // Expect an attribute "to be strictly equal" to the value.
  await expect(getStarted).toHaveAttribute('href', '/docs/intro');

  // Click the get started link.
  await getStarted.click();

  // Expects the URL to contain intro.
  await expect(page).toHaveURL(/.*intro/);
});
```

:::note
Add `// @ts-check` at the start of each test file when using JavaScript in VS Code to get automatic type checking.
:::

### Assertions

Playwright Test uses the [expect](https://jestjs.io/docs/expect) library for [test assertions](./test-assertions.md) which provides matchers like `toEqual`, `toContain`, `toMatch`, `toBe` and many more. Playwright also extends this library with convenience async matchers that will wait until the expected condition is met.

```js
await expect(page).toHaveTitle(/Playwright/);
```


### Locators

[Locators](./locators.md) are the central piece of Playwright's auto-waiting and retry-ability. Locators represent a way to find element(s) on the page at any moment and are used to perform actions on elements such as `.click` `.fill` etc. Custom locators can be created with the [`method: Page.locator`] method.

```js
const getStarted = page.locator('text=Get Started');

await expect(getStarted).toHaveAttribute('href', '/docs/installation');
await getStarted.click();
```

[Selectors](./selectors.md) are strings that are used to create Locators. Playwright supports many different selectors like [Text](./selectors.md#text-selector), [CSS](./selectors.md#css-selector), [XPath](./selectors.md#xpath-selectors) and many more. Learn more about available selectors and how to pick one in this [in-depth guide](./selectors.md).


```js
await expect(page.locator('text=Installation')).toBeVisible();
```


### Test Isolation

Playwright Test is based on the concept of [test fixtures](./test-fixtures.md) such as the [built in page fixture](./test-fixtures#built-in-fixtures), which is passed into your test. Pages are isolated between tests due to the Browser Context, which is equivalent to a brand new browser profile, where every test gets a fresh environment, even when multiple tests run in a single Browser.

```js
test('basic test', async ({ page }) => {
  ...
```

### Using Test Hooks

You can use various [test hooks](./api/class-test.md) such as `test.describe` to declare a group of tests and `test.beforeEach` and `test.afterEach` which are executed before/after each test. Other hooks include the `test.beforeAll` and `test.afterAll` which are executed once per worker before/after all tests.

```js tab=js-js
// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto("https://playwright.dev/");
  });

  test("main navigation", async ({ page }) => {
    // Assertions use the expect API.
    await expect(page).toHaveURL("https://playwright.dev/");
  });
});
```

```js tab=js-ts
import { test, expect } from "@playwright/test";

test.describe("navigation", () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto("https://playwright.dev/");
  });

  test("main navigation", async ({ page }) => {
    // Assertions use the expect API.
    await expect(page).toHaveURL("https://playwright.dev/");
  });
});
```

## What's Next

- [Run single tests, multiple tests, headed mode](./running-tests.md)
- [Generate tests with Codegen](./codegen.md)
- [See a trace of your tests](./trace-viewer-intro.md)