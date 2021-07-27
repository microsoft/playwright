---
id: test-annotations
title: "Annotations"
---

<!-- TOC -->

## Annotations

Playwright Test supports test annotations to deal with failures, flakiness, skip, focus and tag tests:
- `skip` marks the test as irrelevant. Playwright Test does not run such a test. Use this annotation when the test is not applicable in some configuration.
- `fail` marks the test as failing. Playwright Test will run this test and ensure it does indeed fail. If the test does not fail, Playwright Test will complain.
- `fixme` marks the test as failing. Playwright Test will not run this test, as opposite to the `fail` annotation. Use `fixme` when running the test is slow or crashy.
- `slow` marks the test as slow and triples the test timeout.

Annotations can be used on a single test or a group of tests. Annotations can be conditional, in which case they apply when the condition is truthy. Annotations may depend on test fixtures. There could be multiple annotations on the same test, possibly in different configurations.

## Focus a test

You can focus some tests. When there are focused tests, only these tests run.

```js js-flavor=js
test.only('focus this test', async ({ page }) => {
  // Run only focused tests in the entire project.
});
```

```js js-flavor=ts
test.only('focus this test', async ({ page }) => {
  // Run only focused tests in the entire project.
});
```

## Skip a test

You can skip certain tests based on the condition.

```js js-flavor=js
test('skip this test', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Still working on it');
});
```

```js js-flavor=ts
test('skip this test', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Still working on it');
});
```

## Group tests

You can group tests to give them a logical name or to scope before/after hooks to the group.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.describe('two tests', () => {
  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.describe('two tests', () => {
  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

## Tag tests

Sometimes you want to tag your tests as `@fast` or `@slow` and only run the tests that have the certain tag. We recommend that you use the `--grep` and `--grep-invert` command line flags for that:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('Test login page @fast', async ({ page }) => {
  // ...
});

test('Test full report @slow', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('Test login page @fast', async ({ page }) => {
  // ...
});

test('Test full report @slow', async ({ page }) => {
  // ...
});
```

You will then be able to run only that test:

```bash
npx playwright test --grep @fast
```

Or if you want the opposite, you can skip the tests with a certain tag:

```bash
npx playwright test --grep-invert @slow
```

## Conditionally skip a group of tests

For example, you can run a group of tests just in Chromium by passing a callback.

```js js-flavor=js
// example.spec.js

test.describe('chromium only', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only!');

  test.beforeAll(async () => {
    // This hook is only run in Chromium.
  });

  test('test 1', async ({ page }) => {
    // This test is only run in Chromium.
  });

  test('test 2', async ({ page }) => {
    // This test is only run in Chromium.
  });
});
```

```js js-flavor=ts
// example.spec.ts

test.describe('chromium only', () => {
  test.skip(({ browserName }) => browserName !== 'chromium', 'Chromium only!');

  test.beforeAll(async () => {
    // This hook is only run in Chromium.
  });

  test('test 1', async ({ page }) => {
    // This test is only run in Chromium.
  });

  test('test 2', async ({ page }) => {
    // This test is only run in Chromium.
  });
});
```

## Use fixme in `beforeEach` hook

To avoid running `beforeEach` hooks, you can put annotations in the hook itself.

```js js-flavor=js
// example.spec.js

test.beforeEach(async ({ page, isMobile }) => {
  test.fixme(isMobile, 'Settings page does not work in mobile yet');

  await page.goto('http://localhost:3000/settings');
});

test('user profile', async ({ page }) => {
  await page.click('text=My Profile');
  // ...
});
```

```js js-flavor=ts
// example.spec.ts

test.beforeEach(async ({ page }) => {
  test.fixme(isMobile, 'Settings page does not work in mobile yet');

  await page.goto('http://localhost:3000/settings');
});

test('user profile', async ({ page }) => {
  await page.click('text=My Profile');
  // ...
});
```
