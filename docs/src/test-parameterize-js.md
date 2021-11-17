---
id: test-parameterize
title: "Parameterize tests"
---

You can either parameterize tests on a test level or on a project level.

<!-- TOC -->

## Parameterized Tests

```js js-flavor=js
// example.spec.js
const people = ['Alice', 'Bob'];
for (const name of people) {
  test(`testing with ${name}`, async () => {
    // ...
  });
  // You can also do it with test.describe() or with multiple tests as long the test name is unique.
}
```

```js js-flavor=ts
// example.spec.ts
const people = ['Alice', 'Bob'];
for (const name of people) {
  test(`testing with ${name}`, async () => {
    // ...
  });
  // You can also do it with test.describe() or with multiple tests as long the test name is unique.
}
```

## Parameterized Projects

Playwright Test supports running multiple test projects at the same time. In the following example, we'll run two projects with different parameters.
A parameter itself is represented as a [`fixture`](./api/class-fixtures), where the value gets set from the config. The first project runs with the value `Alice` and the second with the value `Bob`.

```js js-flavor=js
// my-test.js
const base = require('@playwright/test');

exports.test = base.test.extend({
  // Default value for person.
  person: 'not-set',
});
```

```js js-flavor=ts
// my-test.ts
import { test as base } from '@playwright/test';

export type TestOptions = {
  person: string;
};

export const test = base.extend<TestOptions>({
  // Default value for the person.
  person: 'not-set',
});
```

We can use our fixtures in the test.
```js js-flavor=js
// example.spec.js
const { test } = require('./my-test');

test('test 1', async ({ page, person }) => {
  await page.goto(`/index.html`);
  await expect(page.locator('#node')).toContainText(person);
  // ...
});
```

```js js-flavor=ts
// example.spec.ts
import { test } from './my-test';

test('test 1', async ({ page, person }) => {
  await page.goto(`/index.html`);
  await expect(page.locator('#node')).toContainText(person);
  // ...
});
```

Now, we can run test in multiple configurations by using projects.
```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig<{ person: string }>} */
const config = {
  projects: [
    {
      name: 'Alice',
      use: { person: 'Alice' },
    },
    {
      name: 'Bob',
      use: { person: 'Bob' },
    },
  ]
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
import { TestOptions } from './my-test';

const config: PlaywrightTestConfig<TestOptions> = {
  timeout: 20000,
  projects: [
    {
      name: 'alice',
      use: { person: 'Alice' },
    },
    {
      name: 'Bob',
      use: { person: 'Bob' },
    },
  ]
};
export default config;
```
