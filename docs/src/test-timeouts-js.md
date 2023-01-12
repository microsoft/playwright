---
id: test-timeouts
title: "Timeouts"
---

Playwright Test has multiple configurable timeouts for various tasks.

|Timeout    |Default             |Description                      |
|:----------|:----------------|:--------------------------------|
|Test timeout|30000 ms|Timeout for each test, includes test, hooks and fixtures:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set default</span><br/><code>{`config = { timeout: 60000 }`}</code><br/><span style={{textTransform: 'uppercase',fontSize: 'smaller', fontWeight: 'bold', opacity: '0.6'}}>Override</span><br/>`test.setTimeout(120000)` |
|Expect timeout|5000 ms|Timeout for each assertion:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set default</span><br/><code>{`config = { expect: { timeout: 10000 } }`}</code><br/><span style={{textTransform: 'uppercase',fontSize: 'smaller', fontWeight: 'bold', opacity: '0.6'}}>Override</span><br/>`expect(locator).toBeVisible({ timeout: 10000 })` |
|Action timeout| no timeout |Timeout for each action:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set default</span><br/><code>{`config = { use: { actionTimeout: 10000 } }`}</code><br/><span style={{textTransform: 'uppercase',fontSize: 'smaller', fontWeight: 'bold', opacity: '0.6'}}>Override</span><br/>`locator.click({ timeout: 10000 })` |
|Navigation timeout| no timeout |Timeout for each navigation action:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set default</span><br/><code>{`config = { use: { navigationTimeout: 30000 } }`}</code><br/><span style={{textTransform: 'uppercase',fontSize: 'smaller', fontWeight: 'bold', opacity: '0.6'}}>Override</span><br/>`page.goto('/', { timeout: 30000 })` |
|Global timeout|no timeout |Global timeout for the whole test run:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set in config</span><br/>`config = { globalTimeout: 60*60*1000 }`<br/> |
|`beforeAll`/`afterAll` timeout|30000 ms|Timeout for the hook:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set in hook</span><br/>`test.setTimeout(60000)`<br/> |
|Fixture timeout|no timeout |Timeout for an individual fixture:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set in fixture</span><br/>`{ scope: 'test', timeout: 30000 }`<br/> |

## Test timeout

Playwright Test enforces a timeout for each test, 30 seconds by default. Time spent by the test function, fixtures, `beforeEach` and `afterEach` hooks is included in the test timeout.

Timed out test produces the following error:

```
example.spec.ts:3:1 › basic test ===========================

Timeout of 30000ms exceeded.
```

The same timeout value also applies to `beforeAll` and `afterAll` hooks, but they do not share time with any test.

### Set test timeout in the config

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  timeout: 5 * 60 * 1000,
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 5 * 60 * 1000,
});
```

API reference: [`property: TestConfig.timeout`].

### Set timeout for a single test

```js tab=js-js
const { test, expect } = require('@playwright/test');

test('slow test', async ({ page }) => {
  test.slow(); // Easy way to triple the default timeout
  // ...
});

test('very slow test', async ({ page }) => {
  test.setTimeout(120000);
  // ...
});
```

```js tab=js-ts
import { test, expect } from '@playwright/test';

test('slow test', async ({ page }) => {
  test.slow(); // Easy way to triple the default timeout
  // ...
});

test('very slow test', async ({ page }) => {
  test.setTimeout(120000);
  // ...
});
```

API reference: [`method: Test.setTimeout`] and [`method: Test.slow#1`].

### Change timeout from a `beforeEach` hook

```js tab=js-js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
});
```

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
});
```

API reference: [`method: TestInfo.setTimeout`].

### Change timeout for `beforeAll`/`afterAll` hook

`beforeAll` and `afterAll` hooks have a separate timeout, by default equal to test timeout. You can change it separately for each hook by calling [`method: TestInfo.setTimeout`] inside the hook.

```js tab=js-js
const { test, expect } = require('@playwright/test');

test.beforeAll(async () => {
  // Set timeout for this hook.
  test.setTimeout(60000);
});
```

```js tab=js-ts
import { test, expect } from '@playwright/test';

test.beforeAll(async () => {
  // Set timeout for this hook.
  test.setTimeout(60000);
});
```

API reference: [`method: TestInfo.setTimeout`].

## Expect timeout

Web-first assertions like `expect(locator).toHaveText()` have a separate timeout, 5 seconds by default. Assertion timeout is unrelated to the test timeout. It produces the following error:

```
example.spec.ts:3:1 › basic test ===========================

Error: expect(received).toHaveText(expected)

Expected string: "my text"
Received string: ""
Call log:
  - expect.toHaveText with timeout 5000ms
  - waiting for "locator('button')"
```

### Set expect timeout in the config

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  expect: {
    timeout: 10 * 1000,
  },
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  expect: {
    timeout: 10 * 1000,
  },
});
```

API reference: [`property: TestConfig.expect`].

### Set timeout for a single assertion

```js tab=js-js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }) => {
  await expect(page.getByRole('button')).toHaveText('Sign in', { timeout: 10000 });
});
```

```js tab=js-ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await expect(page.getByRole('button')).toHaveText('Sign in', { timeout: 10000 });
});
```

## Action and navigation timeouts

Test usually performs some actions by calling Playwright APIs, for example `locator.click()`. These actions do not have a timeout by default, but you can set one. Action that timed out produces the following error:

```
example.spec.ts:3:1 › basic test ===========================

locator.click: Timeout 1000ms exceeded.
=========================== logs ===========================
waiting for "locator('button')"
============================================================
```

Playwright also allows to set a separate timeout for navigation actions like `page.goto()` because loading a page is usually slower.

### Set action and navigation timeouts in the config

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },
});
```

```js tab=js-ts
// playwright.config.ts
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

```js tab=js-js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev', { timeout: 30000 });
  await page.getByText('Get Started').click({ timeout: 10000 });
});
```

```js tab=js-ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev', { timeout: 30000 });
  await page.getByText('Get Started').click({ timeout: 10000 });
});
```

## Global timeout

Playwright Test supports a timeout for the whole test run. This prevents excess resource usage when everything went wrong. There is no default global timeout, but you can set a reasonable one in the config, for example one hour. Global timeout produces the following error:

```
Running 1000 tests using 10 workers

  514 skipped
  486 passed
  Timed out waiting 3600s for the entire test run
```

You can set global timeout in the config.

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  globalTimeout: 60 * 60 * 1000,
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  globalTimeout: 60 * 60 * 1000,
});
```

API reference: [`property: TestConfig.globalTimeout`].

## Fixture timeout

By default, [fixture](./test-fixtures) shares timeout with the test. However, for slow fixtures, especially [worker-scoped](./test-fixtures#worker-scoped-fixtures) ones, it is convenient to have a separate timeout. This way you can keep the overall test timeout small, and give the slow fixture more time.

```js tab=js-js
const { test: base, expect } = require('@playwright/test');

const test = base.extend({
  slowFixture: [async ({}, use) => {
    // ... perform a slow operation ...
    await use('hello');
  }, { timeout: 60000 }]
});

test('example test', async ({ slowFixture }) => {
  // ...
});
```

```js tab=js-ts
import { test as base, expect } from '@playwright/test';

const test = base.extend<{ slowFixture: string }>({
  slowFixture: [async ({}, use) => {
    // ... perform a slow operation ...
    await use('hello');
  }, { timeout: 60000 }]
});

test('example test', async ({ slowFixture }) => {
  // ...
});
```

API reference: [`method: Test.extend`].
