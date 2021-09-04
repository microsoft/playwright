---
id: test-failures
title: "Test failures"
---

Playwright Test runs tests in worker processes. These processes are OS processes, running independently, orchestrated by the test runner. All workers have identical environments and each starts its own browser.

Consider the following snippet:

```js js-flavor=js
const { test } = require('@playwright/test');

test.describe('suite', () => {
  test('first good', async ({ page }) => { /* ... */ });
  test('second flaky', async ({ page }) => { /* ... */ });
  test('third good', async ({ page }) => { /* ... */ });
});
```

```js js-flavor=ts
import { test } from '@playwright/test';

test.describe('suite', () => {
  test('first good', async ({ page }) => { /* ... */ });
  test('second flaky', async ({ page }) => { /* ... */ });
  test('third good', async ({ page }) => { /* ... */ });
});
```

When **all tests pass**, they will be run in order in the same worker process.
* Worker process starts
  * `first good` passes
  * `second flaky` passes
  * `third good` passes

Should **any test fail**, Playwright Test will discard the entire worker process along with the browser and will start a new one. Testing will continue in the new worker process starting with the next test.
* Worker process #1 starts
  * `first good` passes
  * `second flaky` fails
* Worker process #2 starts
  * `third good` passes

If you **enable [retries](./test-retries.md)**, second worker process will start by retrying the failed test and continue from there.
* Worker process #1 starts
  * `first good` passes
  * `second flaky` fails
* Worker process #2 starts
  * `second flaky` is retried and passes
  * `third good` passes

This scheme works perfectly for independent tests and guarantees that failing tests can't affect healthy ones.

## Serial mode

Use [`method: Test.describe.serial`] to group dependent tests to ensure they will always run together and in order. If one of the tests fails, all subsequent tests are skipped. All tests in the group are retried together.

This is useful for dependent tests that cannot be run in isolation. For example, restarting after the failure from the second test might not work.

Consider the following snippet that uses `test.describe.serial`:

```js js-flavor=js
const { test } = require('@playwright/test');

test.describe.serial('suite', () => {
  test('first good', async ({ page }) => { /* ... */ });
  test('second flaky', async ({ page }) => { /* ... */ });
  test('third good', async ({ page }) => { /* ... */ });
});
```

```js js-flavor=ts
import { test } from '@playwright/test';

test.describe.serial('suite', () => {
  test('first good', async ({ page }) => { /* ... */ });
  test('second flaky', async ({ page }) => { /* ... */ });
  test('third good', async ({ page }) => { /* ... */ });
});
```

When running without [retries](./test-retries.md), all tests after the failure are skipped:
* Worker process #1:
  * `first good` passes
  * `second flaky` fails
  * `third good` is skipped entirely

When running with [retries](./test-retries.md), all tests are retried together:
* Worker process #1:
  * `first good` passes
  * `second flaky` fails
  * `third good` is skipped
* Worker process #2:
  * `first good` passes again
  * `second flaky` passes
  * `third good` passes

:::note
It is usually better to make your tests isolated, so they can be efficiently run and retried independently.
:::

## Reuse single page between tests

Playwright Test creates an isolated [Page] object for each test. However, if you'd like to reuse a single [Page] object between multiple tests, you can create your own in the [`method: Test.beforeAll`] and close it in [`method: Test.afterAll`].

```js js-flavor=js
// example.spec.js
// @ts-check

const { test } = require('@playwright/test');

test.describe.serial('use the same page', () => {
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('runs first', async () => {
    await page.goto('https://playwright.dev/');
  });

  test('runs second', async () => {
    await page.click('text=Get Started');
  });
});
```

```js js-flavor=ts
// example.spec.ts

import { test, Page } from '@playwright/test';

test.describe.serial('use the same page', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('runs first', async () => {
    await page.goto('https://playwright.dev/');
  });

  test('runs second', async () => {
    await page.click('text=Get Started');
  });
});
```
