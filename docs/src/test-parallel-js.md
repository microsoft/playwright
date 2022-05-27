---
id: test-parallel
title: "Parallelism and sharding"
---

Playwright Test runs tests in parallel. In order to achieve that, it runs several worker processes that run at the same time.

- By default, **test files** are run in parallel. Tests in a single file are run in order, in the same worker process.
- Configure tests using [`test.describe.configure`](#parallelize-tests-in-a-single-file) to run **tests in a single file** in parallel.
- You can configure **entire project** to have all tests in all files to run in parallel using [`property: TestProject.fullyParallel`] or [`property: TestConfig.fullyParallel`].
- To **disable** parallelism limit the number of [workers to one](#disable-parallelism).

You can control the number of [parallel worker processes](#limit-workers) and [limit the number of failures](#limit-failures-and-fail-fast) in the whole test suite for efficiency.

<!-- TOC -->

## Worker processes

All tests run in worker processes. These processes are OS processes, running independently, orchestrated by the test runner. All workers have identical environments and each starts its own browser.

You can't communicate between the workers. Playwright Test reuses a single worker as much as it can to make testing faster, so multiple test files are usually run in a single worker one after another.

Workers are always shutdown after a [test failure](./test-retries.md#failures) to guarantee pristine environment for following tests.

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
import type { PlaywrightTestConfig } from '@playwright/test';

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

## Parallelize tests in a single file

By default, tests in a single file are run in order. If you have many independent tests in a single file, you might want to run them in parallel with [`method: Test.describe.configure`].

Note that parallel tests are executed in separate worker processes and cannot share any state or global variables. Each test executes all relevant hooks just for itself, including `beforeAll` and `afterAll`.

```js js-flavor=js
const { test } = require('@playwright/test');

test.describe.configure({ mode: 'parallel' });

test('runs in parallel 1', async ({ page }) => { /* ... */ });
test('runs in parallel 2', async ({ page }) => { /* ... */ });
```

```js js-flavor=ts
import { test } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

test('runs in parallel 1', async ({ page }) => { /* ... */ });
test('runs in parallel 2', async ({ page }) => { /* ... */ });
```

Alternatively, you can opt-in all tests (or just a few projects) into this fully-parallel mode in the configuration file:

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  fullyParallel: true,
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  fullyParallel: true,
};
export default config;
```

## Serial mode

You can annotate inter-dependent tests as serial. If one of the serial tests
fails, all subsequent tests are skipped. All tests in a group are retried together.

:::note
Using serial is not recommended. It is usually better to make your tests isolated, so they can be run independently.
:::

```js js-flavor=js
// @ts-check

const { test } = require('@playwright/test');

test.describe.configure({ mode: 'serial' });

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
```

```js js-flavor=ts
// example.spec.ts

import { test, Page } from '@playwright/test';

// Annotate entire file as serial.
test.describe.configure({ mode: 'serial' });

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
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // Limit the number of failures on CI to save resources
  maxFailures: process.env.CI ? 10 : undefined,
};
export default config;
```

## Worker index and parallel index

Each worker process is assigned two ids: a unique worker index that starts with 1, and a parallel index that is between `0` and `workers - 1`. When a worker is restarted, for example after a failure, the new worker process has the same `parallelIndex` and a new `workerIndex`.

You can read an index from environment variables `process.env.TEST_WORKER_INDEX` and `process.env.TEST_PARALLEL_INDEX`, or access them through [`property: TestInfo.workerIndex`] and [`property: TestInfo.parallelIndex`].

## Control test order

Playwright Test runs tests from a single file in the order of declaration, unless you [parallelize tests in a single file](#parallelize-tests-in-a-single-file).

There is no guarantee about the order of test execution across the files, because Playwright Test runs test files in parallel by default. However, if you [disable parallelism](#disable-parallelism), you can control test order by either naming your files in alphabetical order or using a "test list" file.

### Sort test files alphabetically

When you **disable parallel test execution**, Playwright Test runs test files in alphabetical order. You can use some naming convention to control the test order, for example `test001.spec.ts`, `test002.spec.ts` and so on.

### Use a "test list" file

Suppose we have two test files.

```js js-flavor=js
// feature-a.spec.js
const { test, expect } = require('@playwright/test');

test.describe('feature-a', () => {
  test('example test', async ({ page }) => {
    // ... test goes here
  });
});


// feature-b.spec.js
const { test, expect } = require('@playwright/test');

test.describe('feature-b', () => {
  test.use({ viewport: { width: 500, height: 500 } });
  test('example test', async ({ page }) => {
    // ... test goes here
  });
});
```

```js js-flavor=ts
// feature-a.spec.ts
import { test, expect } from '@playwright/test';

test.describe('feature-a', () => {
  test('example test', async ({ page }) => {
    // ... test goes here
  });
});


// feature-b.spec.ts
import { test, expect } from '@playwright/test';

test.describe('feature-b', () => {
  test.use({ viewport: { width: 500, height: 500 } });
  test('example test', async ({ page }) => {
    // ... test goes here
  });
});
```

We can create a test list file that will control the order of tests - first run `feature-b` tests, then `feature-a` tests.

```js js-flavor=js
// test.list.js
require('./feature-b.spec.js');
require('./feature-a.spec.js');
```

```js js-flavor=ts
// test.list.ts
import './feature-b.spec.ts';
import './feature-a.spec.ts';
```

Now **disable parallel execution** by setting workers to one, and specify your test list file.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  workers: 1,
  testMatch: 'test.list.js',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  workers: 1,
  testMatch: 'test.list.ts',
};
export default config;
```

:::note
Make sure to wrap tests with `test.describe()` blocks so that any `test.use()` calls only affect tests from a single file.
:::
