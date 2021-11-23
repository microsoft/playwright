---
id: test-timeouts
title: "Timeouts"
---

<!-- TOC -->

## Overview

Playwright Test has multiple configurable timeouts for various tasks.

|Timeout    |Default             |Description                      |
|:----------|:----------------|:--------------------------------|
|Test timeout|30000 ms|Timeout for each test, includes test, hooks and fixtures:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set default</span><br/><code>{`config = { timeout: 60000 }`}</code><br/><span style={{textTransform: 'uppercase',fontSize: 'smaller', fontWeight: 'bold', opacity: '0.6'}}>Override</span><br/>```test.setTimeout(120000)``` |
|Expect timeout|5000 ms|Timeout for each assertion:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set default</span><br/>```config = { expect: { timeout: 10000 } }```<br/><span >Override</span><br/>```expect(locator).toBeVisible({ timeout: 10000 })```|
|Action timeout| no timeout |Timeout for each action:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set default</span><br/>```config = { use: { actionTimeout: 10000 } }```<br/><span >Override</span><br/>```locator.click({ timeout: 10000 })```|
|Navigation timeout| no timeout |Timeout for each navigation action:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set default</span><br/>```config = { use: { navigationTimeout: 30000 } }```<br/><span >Override</span><br/>```page.goto('/', { timeout: 30000 })```|
|Global timeout|no timeout |Global timeout for the whole test run:<br/><span style={{textTransform:'uppercase',fontSize:'smaller',fontWeight:'bold',opacity:'0.6'}}>Set in config</span><br/>```config = { globalTimeout: 60*60*1000 }```<br/>|

## Test timeout

Playwright Test enforces a timeout for each test, 30 seconds by default. Time spent by the test function, fixtures, `beforeEach` and `afterEach` hooks is included in the test timeout.

Timed out test produces the following error:

```
example.spec.ts:3:1 › basic test ===========================

Timeout of 30000ms exceeded.
```

The same test timeout also applies to `beforeAll` and `afterAll` hooks.

### Set test timeout in the config

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  timeout: 5 * 60 * 1000,
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 5 * 60 * 1000,
};
export default config;
```

API reference: [`property: TestConfig.timeout`].

### Set timeout for a single test

```js js-flavor=js
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

```js js-flavor=ts
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

API reference: [`method: Test.setTimeout`] and [`method: Test.slow`].

### Change timeout from a hook or fixture

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
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
  - waiting for selector "button"
```

### Set expect timeout in the config

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  expect: {
    timeout: 10 * 1000,
  },
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  expect: {
    timeout: 10 * 1000,
  },
};
export default config;
```

API reference: [`property: TestConfig.expect`].

### Set timeout for a single assertion

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }) => {
  await expect(page.locator('button')).toHaveText('Sign in', { timeout: 10000 });
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await expect(page.locator('button')).toHaveText('Sign in', { timeout: 10000 });
});
```

## Action and navigation timeouts

Test usually performs some actions by calling Playwright APIs, for example `locator.click()`. These actions do not have a timeout by default, but you can set one. Action that timed out produces the following error:

```
example.spec.ts:3:1 › basic test ===========================

locator.click: Timeout 1000ms exceeded.
=========================== logs ===========================
waiting for selector "button"
============================================================
```

Playwright also allows to set a separate timeout for navigation actions like `page.goto()` because loading a page is usually slower.

### Set action and navigation timeouts in the config

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  use: {
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  use: {
    actionTimeout: 10 * 1000,
    navigationTimeout: 30 * 1000,
  },
};
export default config;
```

API reference: [`property: TestOptions.actionTimeout`] and [`property: TestOptions.navigationTimeout`].

### Set timeout for a single action

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev', { timeout: 30000 });
  await page.locator('text=Get Started').click({ timeout: 10000 });
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev', { timeout: 30000 });
  await page.locator('text=Get Started').click({ timeout: 10000 });
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

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  globalTimeout: 60 * 60 * 1000,
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  globalTimeout: 60 * 60 * 1000,
};
export default config;
```

API reference: [`property: TestConfig.globalTimeout`].
