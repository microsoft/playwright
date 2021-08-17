---
id: test-parallel
title: "Parallelism and sharding"
---

Playwright Test runs tests in parallel. In order to achieve that, it runs several worker processes that run at the same time.

By default, test files are run in parallel. Tests in a single file are run in order, in the same worker process. You can control the number of [parallel worker processes](#limit-workers) or [disable parallelism](#disable-parallelism) altogether.

You can [limit the number of failures](#limit-failures-and-fail-fast) in the whole test suite to avoid wasting resources and "fail fast".

## Worker processes

All tests run in worker processes. These processes are OS processes, running independently, orchestrated by the test runner. All workers have identical environments and each starts its own browser.

You can't communicate between the workers. Playwright Test reuses a single worker as much as it can to make testing faster, so multiple test files are usually run in a single worker one after another.

## Limit workers

You can control the maximum number of parallel worker processes via [command line](./test-cli.md) or in the [configuration file](./test-configuration.md).

From the command line:
```bash
npx playwright test --workers 4
```

In the configuration file:
```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  // Limit the number of workers on CI, use default locally
  workers: process.env.CI ? 2 : undefined,
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // Limit the number of workers on CI, use default locally
  workers: process.env.CI ? 2 : undefined,
};
export default config;
```

## Disable parallelism

You can disable any parallelism by allowing just a single worker at any time. Either set `workers: 1` option in the configuration file or pass `--workers=1` to the command line.

```bash
npx playwright test --workers=1
```

## Failed tests, retires and serial mode

Should any test fail, Playwright Test will discard entire worker process along with the browsers used and will start a new one. Testing will continue in the new worker process, starting with retrying the failed test, or from the next test if retires are disabled.

This scheme works perfectly for independent tests and guarantees that failing tests can't affect healthy ones. Consider the following snippet:

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

Tests will run in the following way:
* Worker process #1:
  * `first good` passes
  * `second flaky` fails
* Worker process #2:
  * If [retries](./test-retries.md) are enabled, `second flaky` is retried and passes
  * `third good` passes

### Serial mode

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

### Reusing single page between tests

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

## Shard tests between multiple machines

Playwright Test can shard a test suite, so that it can be executed on multiple machines. For that,  pass `--shard=x/y` to the command line. For example, to split the suite into three shards, each running one third of the tests:

```bash
npx playwright test --shard=1/3
npx playwright test --shard=2/3
npx playwright test --shard=3/3
```

That way your test suite completes 3 times faster.

## Limit failures and fail fast

You can limit the number of failed tests in the whole test suite by setting `maxFailures` config option or passing `--max-failures` command line flag.

When running with "max failures" set, Playwright Test will stop after reaching this number of failed tests and skip any tests that were not executed yet. This is useful to avoid wasting resources on broken test suites.

Passing command line option:
```bash
npx playwright test --max-failures=10
```

Setting in the configuration file:
```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  // Limit the number of failures on CI to save resources
  maxFailures: process.env.CI ? 10 : undefined,
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // Limit the number of failures on CI to save resources
  maxFailures: process.env.CI ? 10 : undefined,
};
export default config;
```

## Worker index

Each worker process is assigned a unique id (an index that starts with 1). You can read it from environment variable `process.env.TEST_WORKER_INDEX`, or access through [`property: TestInfo.workerIndex`].
