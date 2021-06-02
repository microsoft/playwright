---
id: test-annotations
title: "Annotations"
---

Sadly, tests do not always pass. Playwright Test supports test annotations to deal with failures, flakiness and tests that are not yet ready.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('playwright/test');

test('some feature', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'This feature is iOS-only');
  // Test goes here.
});

test('another feature', async ({ page }) => {
  test.fail(true, 'Broken, need to fix!');
  // Test goes here.
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from 'playwright/test';

test('some feature', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'This feature is iOS-only');
  // Test goes here.
});

test('broken feature', async ({ page }) => {
  test.fail();
  // Test goes here.
});
```

Annotations apply when the condition is truthy, or always when no condition is passed, and may include a description. Annotations may depend on test fixtures. There could be multiple annotations on the same test, possibly in different configurations.

Available annotations:
- `skip` marks the test as irrelevant. Playwright Test does not run such a test. Use this annotation when the test is not applicable in some configuration.
- `fail` marks the test as failing. Playwright Test will run this test and ensure it does indeed fail. If the test does not fail, Playwright Test will complain.
- `fixme` marks the test as failing. Playwright Test will not run this test, as opposite to the `fail` annotation. Use `fixme` when running the test is slow or crashy.
- `slow` marks the test as slow and triples the test timeout.
