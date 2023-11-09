---
id: test-unit-testing
title: "Unit Testing"
---

## Example

You can perform unit testing in Playwright as shown below:

```js title="unit-testing-example.spec.ts"
import { expect, test } from "@playwright/test";

test("function should return answer", async () => {
  const add = (a, b) => a + b;
  expect(add(1, 2)).toBe(3);
});
```

For unit testing, you can also use [parameterized tests](./test-parameterize-js.md) and [built-in](./test-fixtures-js.md#built-in-fixtures) or [custom](./test-fixtures-js.md#creating-a-fixture) fixtures, alongside your [E2E](./writing-tests-js.md) and [component tests](./test-components-js.md).

You can use any [assertations](./test-assertions-js.md), except for [locator assertations](./test-assertions-js.md#auto-retrying-assertions) when you do unit-testing _without_ using any browser APIs (see below).

## Difference from E2E and component testing

When you **_only_** need to run unit tests with Playwright, you should understand their differences from E2E and Component tests:

### Unit tests that need browsers

If your unit test uses any browser-related API like E2E and Component tests do, you need to [install the browsers](./browsers.md#install-browsers) for Playwright to run your test.

This test will **_not_** run without browsers installed:

```js title="unit-testing-with-browser.spec.ts"
import { test, expect } from "@playwright/test";

// This test introduces a `page` instance provided by the built-in fixture in `test`.
test("function should return answer", async ({ page }) => {
  // Our sample test does not actually use the `page` API by calling, for instance:
  //
  // await page.goto('https://playwright.dev/')
  //
  // Instead, we are only testing pure business logic below.
  // This test, however, still requires browsers.
  const add = (a, b) => a + b;
  expect(add(1, 2)).toBe(3);
});
```

This is because you have introduced a browser [`page`](./api/class-page.md) instance in the test, even though, in this example, you might not be using it. When you run this, Playwright test runner will throw error and prompt you to install the browsers if you have not done so.

### Unit tests that do not need browsers

If you want to run a unit test without browsers, simply **_avoid the [browser-related fixtures](./test-fixtures-js.md)_** like in our [first example](#example).

This test will still run even if you do not have browsers installed:

```js title="unit-testing-without-browser.spec.ts"
import { expect, test } from "@playwright/test";

// This test will still run even if you have not installed any browsers, because it's not invoking any browser-related APIs.
test("function should return answer", async () => {
  const add = (a, b) => a + b;
  expect(add(1, 2)).toBe(3);
});
```

You can still use [custom fixtures](./test-fixtures-js.md) so long as they do not need any browser APIs.

This unit test still runs without browsers:

```js title="unit-testing-custom-fixture-without-browsers.spec.ts"
import { expect, test as base } from "@playwright/test";

export type MyFixtureOptions = {
  defaultItem: string,
};

export const test = base.extend<MyFixtureOptions>({
    defaultItem: "defaultItemName",
});

test(`testing with custom fixture`, async ({ defaultItem }) => {
  expect(defaultItem).toBe("defaultItemName");
});
```

## Required browser configuration

Note that even for unit tests without browsers, Playwright requires at least one browser configuration in your [`config`](./browsers#configure-browsers) to run any tests at all. Without it, no tests will be picked up for execution, regardless of whether they use browser-related APIs or not.

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

// This config will not run any tests.
export default defineConfig({
  projects: []
});

// This config will run tests.
//
// Whether you tests will be ran with browsers instances is, again, decided by the fixtures you're actually using in your tests.
export default defineConfig({
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    }
  ]
});
```

## Unit tests should avoid unnecessary browser-related fixtures

In unit tests, avoid introducing browser-related fixtures such as [`page`](./test-api/class-fixtures.md#property-fixturespage) or [`browser`](./test-api/class-fixtures.md#property-fixturesbrowser) unless necessary. These fixtures increase test run time due to additional setup and teardown.
