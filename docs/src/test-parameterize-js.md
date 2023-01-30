---
id: test-parameterize
title: "Parameterize tests"
---

You can either parameterize tests on a test level or on a project level.

## Parameterized Tests

```js tab=js-js
// example.spec.js
const people = ['Alice', 'Bob'];
for (const name of people) {
  test(`testing with ${name}`, async () => {
    // ...
  });
  // You can also do it with test.describe() or with multiple tests as long the test name is unique.
}
```

```js tab=js-ts
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

Playwright Test supports running multiple test projects at the same time. In the following example, we'll run two projects with different options.

We declare the option `person` and set the value in the config. The first project runs with the value `Alice` and the second with the value `Bob`.

```js tab=js-js
// my-test.js
const base = require('@playwright/test');

exports.test = base.test.extend({
  // Define an option and provide a default value.
  // We can later override it in the config.
  person: ['John', { option: true }],
});
```

```js tab=js-ts
// my-test.ts
import { test as base } from '@playwright/test';

export type TestOptions = {
  person: string;
};

export const test = base.extend<TestOptions>({
  // Define an option and provide a default value.
  // We can later override it in the config.
  person: ['John', { option: true }],
});
```

We can use this option in the test, similarly to [fixtures](./test-fixtures.md).

```js tab=js-js
// example.spec.js
const { test } = require('./my-test');

test('test 1', async ({ page, person }) => {
  await page.goto(`/index.html`);
  await expect(page.locator('#node')).toContainText(person);
  // ...
});
```

```js tab=js-ts
// example.spec.ts
import { test } from './my-test';

test('test 1', async ({ page, person }) => {
  await page.goto(`/index.html`);
  await expect(page.locator('#node')).toContainText(person);
  // ...
});
```

Now, we can run tests in multiple configurations by using projects.

```js tab=js-js
// playwright.config.js
// @ts-check

module.exports = defineConfig({
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
});
```

```js tab=js-ts
// playwright.config.ts
import type { defineConfig } from '@playwright/test';
import { TestOptions } from './my-test';

export default defineConfig({
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
});
```

We can also use the option in a fixture. Learn more about [fixtures](./test-fixtures.md).

```js tab=js-js
// my-test.js
const base = require('@playwright/test');

exports.test = base.test.extend({
  // Define an option and provide a default value.
  // We can later override it in the config.
  person: ['John', { option: true }],

  // Override default "page" fixture.
  page: async ({ page, person }, use) => {
    await page.goto('/chat');
    // We use "person" parameter as a "name" for the chat room.
    await page.getByLabel('User Name').fill(person);
    await page.getByText('Enter chat room').click();
    // Each test will get a "page" that already has the person name.
    await use(page);
  },
});
```

```js tab=js-ts
// my-test.ts
import { test as base } from '@playwright/test';

export type TestOptions = {
  person: string;
};

export const test = base.extend<TestOptions>({
  // Define an option and provide a default value.
  // We can later override it in the config.
  person: ['John', { option: true }],

  // Override default "page" fixture.
  page: async ({ page, person }, use) => {
    await page.goto('/chat');
    // We use "person" parameter as a "name" for the chat room.
    await page.getByLabel('User Name').fill(person);
    await page.getByText('Enter chat room').click();
    // Each test will get a "page" that already has the person name.
    await use(page);
  },
});
```

:::note
Parameterized projects behavior has changed in version 1.18. [Learn more](./release-notes#breaking-change-custom-config-options).
:::

## Passing Environment Variables

You can use environment variables to configure tests from the command line.

For example, consider the following test file that needs a username and a password. It is usually a good idea not to store your secrets in the source code, so we'll need a way to pass secrets from outside.

```js tab=js-js
// example.spec.js
test(`example test`, async ({ page }) => {
  // ...
  await page.getByLabel('User Name').fill(process.env.USERNAME);
  await page.getByLabel('Password').fill(process.env.PASSWORD);
});
```

```js tab=js-ts
// example.spec.ts
test(`example test`, async ({ page }) => {
  // ...
  await page.getByLabel('User Name').fill(process.env.USERNAME);
  await page.getByLabel('Password').fill(process.env.PASSWORD);
});
```

You can run this test with your secret username and password set in the command line.

```bash tab=bash-bash
USERNAME=me PASSWORD=secret npx playwright test
```

```batch tab=bash-batch
set USERNAME=me
set PASSWORD=secret
npx playwright test
```

```powershell tab=bash-powershell
$env:USERNAME=me
$env:PASSWORD=secret
npx playwright test
```

Similarly, configuration file can also read environment variables passed through the command line.


```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    baseURL: process.env.STAGING === '1' ? 'http://staging.example.test/' : 'http://example.test/',
  }
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    baseURL: process.env.STAGING === '1' ? 'http://staging.example.test/' : 'http://example.test/',
  }
});
```

Now, you can run tests against a staging or a production environment:

```bash tab=bash-bash
STAGING=1 npx playwright test
```

```batch tab=bash-batch
set STAGING=1
npx playwright test
```

```powershell tab=bash-powershell
$env:STAGING=1
npx playwright test
```

### .env files

To make environment variables easier to manage, consider something like `.env` files. Here is an example that uses [`dotenv`](https://www.npmjs.com/package/dotenv) package to read environment variables directly in the configuration file.

```js tab=js-js
// playwright.config.js
// @ts-check

// Read from default ".env" file.
require('dotenv').config();

// Alternatively, read from "../my.env" file.
require('dotenv').config({ path: path.resolve(__dirname, '..', 'my.env') });

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  use: {
    baseURL: process.env.STAGING === '1' ? 'http://staging.example.test/' : 'http://example.test/',
  }
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Read from default ".env" file.
dotenv.config();

// Alternatively, read from "../my.env" file.
dotenv.config({ path: path.resolve(__dirname, '..', 'my.env') });

export default defineConfig({
  use: {
    baseURL: process.env.STAGING === '1' ? 'http://staging.example.test/' : 'http://example.test/',
  }
});
```

Now, you can just edit `.env` file to set any variables you'd like.

```bash
# .env file
STAGING=0
USERNAME=me
PASSWORD=secret
```

Run tests as usual, your environment variables should be picked up.

```bash
npx playwright test
```

## Create tests via a CSV file

The Playwright test-runner runs in Node.js, this means you can directly read files from the file system and parse them with your preferred CSV library.

See for example this CSV file, in our example `input.csv`:

```txt
"test_case","some_value","some_other_value"
"value 1","value 11","foobar1"
"value 2","value 22","foobar21"
"value 3","value 33","foobar321"
"value 4","value 44","foobar4321"
```

Based on this we'll generate some tests by using the [csv-parse](https://www.npmjs.com/package/csv-parse) library from NPM:

```js tab=js-ts
// foo.spec.ts
import fs from 'fs';
import path from 'path';
import { test } from '@playwright/test';
import { parse } from 'csv-parse/sync';

const records = parse(fs.readFileSync(path.join(__dirname, 'input.csv')), {
  columns: true,
  skip_empty_lines: true
});

for (const record of records) {
  test(`fooo: ${record.test_case}`, async ({ page }) => {
    console.log(record.test_case, record.some_value, record.some_other_value);
  });
}
```

```js tab=js-js
// foo.spec.js
const fs = require('fs');
const path = require('path');
const { test } = require('@playwright/test');
const { parse } = require('csv-parse/sync');

const records = parse(fs.readFileSync(path.join(__dirname, 'input.csv')), {
  columns: true,
  skip_empty_lines: true
});

for (const record of records) {
  test(`fooo: ${record.test_case}`, async ({ page }) => {
    console.log(record.test_case, record.some_value, record.some_other_value);
  });
}
```
