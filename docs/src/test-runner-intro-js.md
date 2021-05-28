---
id: test-runner-intro
title: "Playwright Tests"
---

Playwright Test Runner was created specifically to accommodate the needs of the end-to-end testing. It does everything you would expect from the regular test runner, and more. Playwright test allows to:

- Run tests across all browsers.
- Execute tests in parallel.
- Enjoy context isolation out of the box.
- Capture videos, screenshots and other artifacts on failure.
- Integrate your POMs as extensible fixtures.

There are many more exciting features, so read on!

<!-- TOC -->

## Installation

```sh
npm i -D @playwright/test@1.0.0-alpha
```

## First test

Create `tests/foo.spec.ts` to define your test.

```js
import { test, expect } from '@playwright/test';

test('is a basic test with the page', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const name = await page.innerText('.navbar__title');
  expect(name).toBe('Playwright');
});
```

Now run your tests:

```sh
# Assuming that test files are in the tests directory.
npx folio -c tests
```

## Test fixtures

You noticed an argument `{ page }` that the test above has access to:

```js
test('basic test', async ({ page }) => {
  ...
```

We call these arguments `fixtures`. Playwright Test comes loaded with those fixtures, and you can add your own fixtures as well. Here is a list of the pre-defined fixtures that you are likely to use most of the time:

- `page`: [Page] - Isolated page for this test run.
- `context`: [BrowserContext] - Isolated context for this test run. The `page` fixture belongs to this context as well. Learn how to [configure context](#modify-options) below.
- `browser`: [Browser] - Browsers are shared across tests to optimize resources. Learn how to [configure browser](#modify-options) below.
- `browserName` - The name of the browser currently running the test. Either `chromium`, `firefox` or `webkit`.

## Test and assertion features

### Focus or skip tests

```js
import { test, expect } from '@playwright/test';

// You can focus single test.
test.only('focus this test', async ({ page }) => {
  // Only this test in the entire project runs.
});

// You can skip tests.
test.skip('skip this test', async ({ page }) => {
});
```

### Group tests together

```js
import { test, expect } from '@playwright/test';

test.describe('two tests', () => {
  test.only('one', async ({ page }) => {
    // ...
  });

  test.skip('two', async ({ page }) => {
    // ...
  });
});
```

### Use test hooks

You can use `test.beforeAll` and `test.afterAll` hooks to set up and tear down resources shared between tests.
And you can use `test.beforeEach` and `test.afterEach` hooks to set up and tear down resources for each test individually.

```js
import { test, expect } from '@playwright/test';

test.describe('feature foo', () => {
  test.beforeEach(async ({ page }) => {
    // Go to the starting url before each test.
    await page.goto('https://my.start.url');
  });

  test('my test', async ({ page }) => {
    // Assertions use the expect API.
    expect(page.url()).toBe('https://my.start.url');
  });
});
```

## Write a configuration file

Create `config.ts` to configure your tests: specify browser launch options, run tests in multiple browsers and much more. Here is an example configuration that runs every test in Chromium, Firefox and WebKit.

```js
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  timeout: 30000,  // Each test is given 30 seconds.

  // A project per browser, each running all the tests.
  projects: [
    {
      name: 'chromium',
      use: {
        browserName: 'chromium',
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    },

    {
      name: 'webkit',
      use: {
        browserName: 'webkit',
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    },

    {
      name: 'firefox',
      use: {
        browserName: 'firefox',
        headless: true,
        viewport: { width: 1280, height: 720 },
      },
    }
  ],
};
export default config;
```

## Run the test suite

Tests can be run in single or multiple browsers, in parallel or sequentially.

```sh
# Run all tests across Chromium, Firefox and WebKit
npx folio --config=config.ts

# Run tests on a single browser
npx folio --config=config.ts --project=chromium

# Run tests sequentially
npx folio --config=config.ts --workers=1

# Retry failing tests
npx folio --config=config.ts --retries=2

# See all options
npx folio --help
```

Refer to the [command line documentation][folio-cli] for all options.

### Configure NPM scripts

Save the run command as an NPM script.

```json
{
  "scripts": {
    "test": "npx folio --config=config.ts"
  }
}
```

[folio]: https://github.com/microsoft/folio
[folio-annotations]: https://github.com/microsoft/folio#annotations
[folio-cli]: https://github.com/microsoft/folio#command-line
[folio-reporters]: https://github.com/microsoft/folio#reporters
