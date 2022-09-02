---
id: overview-test-runner
title: "Test Runner Overview"
---

## Annotations

Playwright supports test annotations to deal with failures, flakiness, skip, focus and tag tests. Annotations can be used on a single test or a group of tests. Annotations can be conditional, in which case they apply when the condition is truthy. Annotations may depend on test fixtures. There could be multiple annotations on the same test, possibly in different configurations.

```js tab=js-js
test.skip('skip this test', async ({ page }) => {
  // This test is not run
});
```

```js tab=js-ts
test.skip('skip this test', async ({ page }) => {
  // This test is not run
});
```

:::info Learn More
See our full guide on [annotations](./test-annotations.md) to learn more.
:::

## Command Line

Use the command line to run all tests, a single test, a set of tests etc. Run tests in headed browsers, against a specific project, choose a reporter, turn traces on and run in debug mode with the Playwright Inspector all from the command line.

- Run all the tests
  ```bash
  npx playwright test
  ```

:::info Learn More
See our full guide on [command line](./test-cli.md) to learn more.
:::

## Configuration

Playwright provides options to configure the default `browser`, `context` and `page` fixtures. For example there are options for `headless`, `viewport` and `ignoreHTTPSErrors`. You can also record a video or a trace for the test or capture a screenshot at the end. You can specify any options globally in the configuration file, and most of them locally in a test file.

```js tab=js-js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
  },
};

module.exports = config;
```

```js tab=js-ts
import type { PlaywrightTestConfig } from '@playwright/test';
const config: PlaywrightTestConfig = {
  use: {
    headless: false,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    video: 'on-first-retry',
  },
};
export default config;
```

:::info Learn More
See our full guide on [configuration](./test-configuration.md) to learn more.
:::

## Parallelism and Sharding

Playwright runs tests in parallel by running several worker processes that run at the same time. By default, **test files** are run in parallel. Tests in a single file are run in order, in the same worker process. You can configure tests to run **tests in a single file** in parallel or your **entire project** to have all tests in all files to run in parallel. You can also control the number of [parallel worker processes](#limit-workers) and [limit the number of failures](#limit-failures-and-fail-fast) in the whole test suite for efficiency.

```js
npx playwright test --workers 4
```

:::info Learn More
See our full guide on [parallelism and sharding](./test-parallel.md) to learn more.
:::

## Reporters

Playwright comes with a few built-in reporters such as [List](./test-reporters.md#list-reporter), [Line](./test-reporters.md#line-reporter), [Dot](./test-reporters.md#dot-reporter), [HTML](./test-reporters.md#html-reporter), [JSON](./test-reporters.md#json-reporter), [JUnit](./test-reporters.md#junit-reporter), and [GitHub](./test-reporters.md#github-actions-annotations) as well as the ability to create custom reporters. The easiest way to try out built-in reporters is to pass the `--reporter` [command line option](./test-cli.md).


```bash
npx playwright test --reporter=line
```

:::info Learn More
See our full guide on [reporters](./test-reporters.md) to learn more.
:::

## Retries

Playwright runs tests in worker processes. These processes are OS processes, running independently, orchestrated by the test runner. All workers have identical environments and each starts its own browser. Playwright supports **test retries**. When enabled, failing tests will be retried multiple times until they pass, or until the maximum number of retries is reached. By default failing tests are not retried.


```bash
# Give failing tests 3 retry attempts
npx playwright test --retries=3
```

:::info Learn More
See our full guide on [reporters](./test-retries.md) to learn more.
:::

## Timeouts

Playwright enforces a timeout for each test, 30 seconds by default. Time spent by the test function, fixtures, `beforeEach` and `afterEach` hooks is included in the test timeout. You can set the timeout in the config or for a single test or single assertion.

```js tab=js-js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  timeout: 5 * 60 * 1000,
};

module.exports = config;
```

```js tab=js-ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 5 * 60 * 1000,
};
export default config;
```

:::info Learn More
See our full guide on [timeouts](./test-timeouts.md) to learn more.
:::

## Videos

Playwright can record videos for all pages in a [browser context](./browser-contexts.md). Videos are saved upon context closure, so make sure to await [`method: BrowserContext.close`].

```js
const context = await browser.newContext({ recordVideo: { dir: 'videos/' } });
// Make sure to await close, so that videos are saved.
await context.close();
```

```java
context = browser.newContext(new Browser.NewContextOptions().setRecordVideoDir(Paths.get("videos/")));
// Make sure to close, so that videos are saved.
context.close();
```

```python async
context = await browser.new_context(record_video_dir="videos/")
# Make sure to await close, so that videos are saved.
await context.close()
```

```python sync
context = browser.new_context(record_video_dir="videos/")
# Make sure to close, so that videos are saved.
context.close()
```

```csharp
var context = await browser.NewContextAsync(new()
{
    RecordVideoDir = "videos/"
});
// Make sure to close, so that videos are saved.
await context.CloseAsync();
```

:::info Learn More
See our full guide on [videos](./videos.md) to learn more.
:::