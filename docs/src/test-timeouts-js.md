---
id: test-timeouts
title: "Timeouts"
---

Playwright Test has multiple configurable timeouts for various tasks.

|Timeout    |Default             |Description                      |
|:----------|:----------------|:--------------------------------|
|Test timeout|30_000 ms|Timeout for each test<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.7'}}>Set in config</span><br/><code>{`{ timeout: 60_000 }`}</code><br/><span style={{textTransform: 'uppercase',fontSize: 'smaller', fontWeight: 'bold', opacity: '0.7'}}>Override in test</span><br/>`test.setTimeout(120_000)` |
|Expect timeout|5_000 ms|Timeout for each assertion<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.7'}}>Set in config</span><br/><code>{`{ expect: { timeout: 10_000 } }`}</code><br/><span style={{textTransform: 'uppercase',fontSize: 'smaller', fontWeight: 'bold', opacity: '0.7'}}>Override in test</span><br/>`expect(locator).toBeVisible({ timeout: 10_000 })` |

## Test timeout

Playwright Test enforces a timeout for each test, 30 seconds by default. Time spent by the test function, fixture setups, and `beforeEach` hooks is included in the test timeout.

Timed out test produces the following error:

```txt
example.spec.ts:3:1 › basic test ===========================

Timeout of 30000ms exceeded.
```

Additional separate timeout, of the same value, is shared between fixture teardowns and `afterEach` hooks, after the test function has finished.

The same timeout value also applies to `beforeAll` and `afterAll` hooks, but they do not share time with any test.

### Set test timeout in the config

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 120_000,
});
```

API reference: [`property: TestConfig.timeout`].

### Set timeout for a single test

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test('slow test', async ({ page }) => {
  test.slow(); // Easy way to triple the default timeout
  // ...
});

test('very slow test', async ({ page }) => {
  test.setTimeout(120_000);
  // ...
});
```

API reference: [`method: Test.setTimeout`] and [`method: Test.slow`].

### Change timeout from a `beforeEach` hook

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30_000);
});
```

API reference: [`method: TestInfo.setTimeout`].

### Change timeout for `beforeAll`/`afterAll` hook

`beforeAll` and `afterAll` hooks have a separate timeout, by default equal to test timeout. You can change it separately for each hook by calling [`method: TestInfo.setTimeout`] inside the hook.

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test.beforeAll(async () => {
  // Set timeout for this hook.
  test.setTimeout(60000);
});
```

API reference: [`method: TestInfo.setTimeout`].

## Expect timeout

Auto-retrying assertions like [`method: LocatorAssertions.toHaveText`] have a separate timeout, 5 seconds by default. Assertion timeout is unrelated to the test timeout. It produces the following error:

```txt
example.spec.ts:3:1 › basic test ===========================

Error: expect(received).toHaveText(expected)

Expected string: "my text"
Received string: ""
Call log:
  - expect.toHaveText with timeout 5000ms
  - waiting for "locator('button')"
```

### Set expect timeout in the config

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: {
    timeout: 10_000,
  },
});
```

API reference: [`property: TestConfig.expect`].

### Specify expect timeout for a single assertion

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test('example', async ({ page }) => {
  await expect(locator).toHaveText('hello', { timeout: 10_000 });
});
```

## Global timeout

Playwright Test supports a timeout for the whole test run. This prevents excess resource usage when everything went wrong. There is no default global timeout, but you can set a reasonable one in the config, for example one hour. Global timeout produces the following error:

```txt
Running 1000 tests using 10 workers

  514 skipped
  486 passed
  Timed out waiting 3600s for the entire test run
```

You can set global timeout in the config.

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalTimeout: 3_600_000,
});
```

API reference: [`property: TestConfig.globalTimeout`].

## Advanced: low level timeouts

These are the low-level timeouts that are pre-configured by the test runner, you should not need to change these.
If you happen to be in this section because your test are flaky, it is very likely that you should be looking for the solution elsewhere.

|Timeout    |Default             |Description                      |
|:----------|:----------------|:--------------------------------|
|Action timeout| no timeout |Timeout for each action<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.7'}}>Set in config</span><br/><code>{`{ use: { actionTimeout: 10_000 } }`}</code><br/><span style={{textTransform: 'uppercase',fontSize: 'smaller', fontWeight: 'bold', opacity: '0.7'}}>Override in test</span><br/>`locator.click({ timeout: 10_000 })` |
|Navigation timeout| no timeout |Timeout for each navigation action<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.7'}}>Set in config</span><br/><code>{`{ use: { navigationTimeout: 30_000 } }`}</code><br/><span style={{textTransform: 'uppercase',fontSize: 'smaller', fontWeight: 'bold', opacity: '0.7'}}>Override in test</span><br/>`page.goto('/', { timeout: 30_000 })` |
|Global timeout|no timeout |Global timeout for the whole test run<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.7'}}>Set in config</span><br/>`{ globalTimeout: 3_600_000 }`<br/> |
|`beforeAll`/`afterAll` timeout|30_000 ms|Timeout for the hook<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.7'}}>Set in hook</span><br/>`test.setTimeout(60_000)`<br/> |
|Fixture timeout|no timeout |Timeout for an individual fixture<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.7'}}>Set in fixture</span><br/>`{ scope: 'test', timeout: 30_000 }`<br/> |


### Set action and navigation timeouts in the config

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },
});
```

API reference: [`property: TestOptions.actionTimeout`] and [`property: TestOptions.navigationTimeout`].

### Set timeout for a single action

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev', { timeout: 30000 });
  await page.getByText('Get Started').click({ timeout: 10000 });
});
```

## Fixture timeout

By default, [fixture](./test-fixtures) shares timeout with the test. However, for slow fixtures, especially [worker-scoped](./test-fixtures#worker-scoped-fixtures) ones, it is convenient to have a separate timeout. This way you can keep the overall test timeout small, and give the slow fixture more time.

```js title="example.spec.ts"
import { test as base, expect } from '@playwright/test';

const test = base.extend<{ slowFixture: string }>({
  slowFixture: [async ({}, use) => {
    // ... perform a slow operation ...
    await use('hello');
  }, { timeout: 60_000 }]
});

test('example test', async ({ slowFixture }) => {
  // ...
});
```

API reference: [`method: Test.extend`].
