---
id: test-intro
title: "Introduction"
---

Playwright Test Runner was created specifically to accommodate the needs of the end-to-end testing. It does everything you would expect from the regular test runner, and more. Playwright test allows to:

- Run tests across all browsers.
- Execute tests in parallel.
- Enjoy context isolation out of the box.
- Capture videos, screenshots and other artifacts on failure.
- Integrate your POMs as extensible fixtures.

<br/>

<!-- TOC -->

<br/>

## Installation

Playwright already includes a test runner for end-to-end tests.

```sh
npm i -D playwright
```

## First test

Create `tests/foo.spec.js` (or `tests/foo.spec.ts` for TypeScript) to define your test.

```js
const { test, expect } = require('playwright/test');

test('is a basic test with the page', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const name = await page.innerText('.navbar__title');
  expect(name).toBe('Playwright');
});
```

```ts
import { test, expect } from 'playwright/test';

test('is a basic test with the page', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const name = await page.innerText('.navbar__title');
  expect(name).toBe('Playwright');
});
```

Now run your tests:

```sh
# Assuming that test files are in the tests directory.
npx playwright test -c tests
```

Playwright Test just ran a test using Chromium browser, in a headless manner. Let's tell it to use headed browser:

```sh
# Assuming that test files are in the tests directory.
npx playwright test -c tests --headed
```

What about other browsers? Let's run the same test using Firefox:

```sh
# Assuming that test files are in the tests directory.
npx playwright test -c tests --browser=firefox
```

And finally, on all three browsers:

```sh
# Assuming that test files are in the tests directory.
npx playwright test -c tests --browser=all
```

Refer to [configuration](./test-configuration.md) section for configuring test runs in different modes with different browsers.

## Test fixtures

You noticed an argument `{ page }` that the test above has access to:

```js
test('basic test', async ({ page }) => {
  ...
```

```ts
test('basic test', async ({ page }) => {
  ...
```

We call these arguments `fixtures`. Fixtures are objects that are created for each test run. Playwright Test comes loaded with those fixtures, and you can add your own fixtures as well. When running tests, Playwright Test looks at each test declaration, analyses the set of fixtures the test needs and prepares those fixtures specifically for the test.

Here is a list of the pre-defined fixtures that you are likely to use most of the time:

|Fixture    |Type             |Description                      |
|:----------|:----------------|:--------------------------------|
|page       |[Page]           |Isolated page for this test run. |
|context    |[BrowserContext] |Isolated context for this test run. The `page` fixture belongs to this context as well. Learn how to [configure context](./test-configuration.md). |
|browser    |[Browser]        |Browsers are shared across tests to optimize resources. Learn how to [configure browser](./test-configuration.md). |
|browserName|[string]         |The name of the browser currently running the test. Either `chromium`, `firefox` or `webkit`.|

## Test and assertion features

If you are familiar with test runners like Jest, Mocha and Ava, you will find the Playwright Test syntax familiar. These are the basic things you can do with the test:

### Focus a test

You can focus some tests. When there are focused tests, only they run.

```js
test.only('focus this test', async ({ page }) => {
  // Run only focused tests in the entire project.
});
```

```ts
test.only('focus this test', async ({ page }) => {
  // Run only focused tests in the entire project.
});
```

### Skip a test

You can skip certain test based on the condition.

```js
test('skip this test', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Still working on it');
});
```

```ts
test('skip this test', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Still working on it');
});
```

### Group tests

You can group tests to give them a logical name or to scope before/after hooks to the group.
```js
const { test, expect } = require('playwright/test');

test.describe('two tests', () => {
  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

```ts
import { test, expect } from 'playwright/test';

test.describe('two tests', () => {
  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

### Use test hooks

You can use `test.beforeAll` and `test.afterAll` hooks to set up and tear down resources shared between tests.
And you can use `test.beforeEach` and `test.afterEach` hooks to set up and tear down resources for each test individually.

```js
const { test, expect } = require('playwright/test');

test.describe('feature foo', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto('https://my.start.url/');
  });

  test('my test', async ({ page }) => {
    // Assertions use the expect API.
    expect(page.url()).toBe('https://my.start.url/');
  });
});
```

```ts
import { test, expect } from 'playwright/test';

test.describe('feature foo', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto('https://my.start.url/');
  });

  test('my test', async ({ page }) => {
    // Assertions use the expect API.
    expect(page.url()).toBe('https://my.start.url/');
  });
});
```

## Write a configuration file

So far, we've looked at the zero-config operation of Playwright Test. For a real world application, it is likely that you would want to use a config.

Create `playwright.config.js` (or `playwright.config.ts`) to configure your tests. You can specify browser launch options, run tests in multiple browsers and much more with the config. Here is an example configuration that runs every test in Chromium, Firefox and WebKit. Look for more options in the [configuration section](./test-configuration.md).

```js
module.exports = {
  // Each test is given 30 seconds.
  timeout: 30000,

  use: {
    // Run browsers in the headless mode.
    headless: true,

    // Specify the viewport size.
    viewport: { width: 1280, height: 720 },
  },
};
```

```ts
import { PlaywrightTestConfig } from 'playwright/test';

const config: PlaywrightTestConfig = {
  // Each test is given 30 seconds.
  timeout: 30000,

  use: {
    // Run browsers in the headless mode.
    headless: true,

    // Specify the viewport size.
    viewport: { width: 1280, height: 720 },
  },
};
export default config;
```

Configure NPM script to run tests. Test runner will automatically pick up `playwright.config.js` or `playwright.config.ts`.

```json
{
  "scripts": {
    "test": "npx playwright test"
  }
}
```

If you put your configuration file in a different place, pass it with `--config` option.

```json
{
  "scripts": {
    "test": "npx playwright test --config=tests/example.config.js"
  }
}
```
