---
id: test-parameterize
title: "Parametrize tests"
---

You can either parametrize tests on a test level or on a project level.

<!-- TOC -->

## Parametrized Tests

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

## Parametrized Projects

Playwright Test supports running multiple test projects at the same time. In the following example, we'll run two projects with different parameters.

We declare the parameter and set the value in the config. The first project runs with the value `Alice` and the second with the value `Bob`.

```js js-flavor=js
// my-test.js
const base = require('@playwright/test');

exports.test = base.test.declare({
  // Default value - you can override it in the config.
  person: 'John',
});
```

```js js-flavor=ts
// my-test.ts
import { test as base } from '@playwright/test';

export type TestOptions = {
  person: string;
};

export const test = base.declare<TestOptions>({
  // Default value - you can override it in the config.
  person: 'John',
});
```

We can use the parameter in the test.

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

Now, we can run tests in multiple configurations by using projects.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig<{ person: string }>} */
const config = {
  projects: [
    {
      name: 'alice',
      use: { person: 'Alice' },
    },
    {
      name: 'bob',
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
  projects: [
    {
      name: 'alice',
      use: { person: 'Alice' },
    },
    {
      name: 'bob',
      use: { person: 'Bob' },
    },
  ]
};
export default config;
```

We can also use the parameter in a fixture. Learn more about [fixtures](./test-fixtures.md).

```js js-flavor=js
// my-test.js
const base = require('@playwright/test');

exports.test = base.test.declare({
  // Default value - you can override it in the config.
  person: 'John',
}).extend({
  // Override default "page" fixture.
  page: async ({ page, person }, use) => {
    await page.goto('/chat');
    // We use "person" parameter as a "name" for the chat room.
    await page.locator('#name').fill(person);
    await page.click('text=Enter chat room');
    // Each test will get a "page" that already has the person name.
    await use(page);
  },
});
```

```js js-flavor=ts
// my-test.ts
import { test as base } from '@playwright/test';

export type TestOptions = {
  person: string;
};

export const test = base.test.declare<TestOptions>({
  // Default value - you can override it in the config.
  person: 'John',
}).extend({
  // Override default "page" fixture.
  page: async ({ page, person }, use) => {
    await page.goto('/chat');
    // We use "person" parameter as a "name" for the chat room.
    await page.locator('#name').fill(person);
    await page.click('text=Enter chat room');
    // Each test will get a "page" that already has the person name.
    await use(page);
  },
});
```
