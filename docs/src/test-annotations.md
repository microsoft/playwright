---
id: test-annotations
title: "Annotations"
---

Sadly, tests do not always pass. Playwright Test supports test annotations to deal with failures, flakiness and tests that are not yet ready.

```ts
// example.spec.ts
import { test } from 'playwright/test';

test('basic', async ({ table }) => {
  test.skip(version == 'v2', 'This test crashes the database in v2, better not run it.');
  // Test goes here.
});

test('can insert multiple rows', async ({ table }) => {
  test.fail('Broken test, but we should fix it!');
  // Test goes here.
});
```

Annotations may be conditional, in which case they only apply when the condition is truthy. Annotations may depend on test arguments. There could be multiple annotations on the same test, possibly in different configurations.

Possible annotations include:
- `skip` marks the test as irrelevant. Playwright Test does not run such a test. Use this annotation when the test is not applicable in some configuration.
- `fail` marks the test as failing. Playwright Test will run this test and ensure it does indeed fail. If the test does not fail, Playwright Test will complain.
- `fixme` marks the test as failing. Playwright Test will not run this test, as opposite to the `fail` annotation. Use `fixme` when running the test is slow or crashy.
- `slow` marks the test as slow and triples the test timeout.
