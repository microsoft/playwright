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

Playwright has its own test runner for end-to-end tests, we call it Playwright Test.

```bash
npm i -D @playwright/test
```

:::note
Playwright Test is self-contained, it does not need Playwright to be installed.
If you are an existing Playwright user, make sure that you either uninstall
Playwright or update Playwright before installing Playwright Test:

```
npm i -D playwright @playwright/test
```
:::


Unlike Playwright, Playwright Test does not bundle browsers by default, so you need to install them explicitly:

```bash
npx playwright install
```

You can optionally install only selected browsers, see [Playwright CLI](./cli.md) for more details. Or you can install no browsers at all and use existing [browser channels](./browsers.md).

## First test

Create `tests/foo.spec.js` (or `tests/foo.spec.ts` for TypeScript) to define your test.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const name = await page.innerText('.navbar__title');
  expect(name).toBe('Playwright');
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const name = await page.innerText('.navbar__title');
  expect(name).toBe('Playwright');
});
```

Now run your tests, assuming that test files are in the `tests` directory.

```bash
npx playwright test
```

Playwright Test just ran a test using Chromium browser, in a headless manner. Let's tell it to use headed browser:

```bash
npx playwright test --headed
```

What about other browsers? Let's run the same test using Firefox:

```bash
npx playwright test --browser=firefox
```

And finally, on all three browsers:

```bash
npx playwright test --browser=all
```

Refer to [configuration](./test-configuration.md) section for configuring test runs in different modes with different browsers.

## Test fixtures

You noticed an argument `{ page }` that the test above has access to:

```js js-flavor=js
test('basic test', async ({ page }) => {
  ...
```

```js js-flavor=ts
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

### Skip a test

You can skip certain test based on the condition.

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

### Group tests

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

### Use test hooks

You can use `test.beforeAll` and `test.afterAll` hooks to set up and tear down resources shared between tests.
And you can use `test.beforeEach` and `test.afterEach` hooks to set up and tear down resources for each test individually.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

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

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

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

### Write assertions

Playwright Test uses [expect](https://jestjs.io/docs/expect) library for test assertions. It provides a lot of matchers like `toEqual`, `toContain`, `toMatch`, `toMatchSnapshot` and many more.

Combine `expect` with various Playwright methods to create expectations for your test:
- [`method: Page.isVisible`]
- [`method: Page.waitForSelector`]
- [`method: Page.textContent`]
- [`method: Page.getAttribute`]
- [`method: Page.screenshot`]
- Find out more in the [assertions](./assertions.md) guide

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test('my test', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  expect(await page.title()).toContain('Playwright');

  // Expect an attribute "to be strictly equal" to the value.
  expect(await page.getAttribute('text=Get Started', 'href')).toBe('/docs/intro');

  // Expect an element "to be visible".
  expect(await page.isVisible('text=Learn more')).toBeTruthy();

  await page.click('text=Get Started');
  // Expect some text to be visible on the page.
  expect(await page.waitForSelector('text=System requirements')).toBeTruthy();

  // Compare screenshot with a stored reference.
  expect(await page.screenshot()).toMatchSnapshot('get-started.png');
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test('my test', async ({ page }) => {
  await page.goto('https://playwright.dev/');

  // Expect a title "to contain" a substring.
  expect(await page.title()).toContain('Playwright');

  // Expect an attribute "to be strictly equal" to the value.
  expect(await page.getAttribute('text=Get Started', 'href')).toBe('/docs/intro');

  await page.click('text=Get Started');
  // Expect some text to be visible on the page.
  expect(await page.waitForSelector('text=System requirements')).toBeTruthy();

  // Compare screenshot with a stored reference.
  expect(await page.screenshot()).toMatchSnapshot('get-started.png');
});
```

Notice how running this test is saying:

```
Error: example.spec.ts-snapshots/get-started-chromium-darwin.png is missing in snapshots, writing actual.
```

That's because there was no golden file for your `get-started.png` snapshot. It is now created and is ready to be added to the repository. The name of the folder with the golden expectations starts with the name of your test file:

```bash
drwxr-xr-x  5 user  group  160 Jun  4 11:46 .
drwxr-xr-x  6 user  group  192 Jun  4 11:45 ..
-rw-r--r--  1 user  group  231 Jun  4 11:16 example.spec.ts
drwxr-xr-x  3 user  group   96 Jun  4 11:46 example.spec.ts-snapshots
```

To update your golden files, you can use the `--update-snapshots` parameter.

```bash
npx playwright test --update-snapshots
```


## Learn the command line

Here are the most common options available in the [command line](./test-cli.md).

- Run tests in headed browsers
  ```bash
  npx playwright test --headed
  ```

- Run tests in a particular browser
  ```bash
  npx playwright test --browser=webkit
  ```

- Run tests in all browsers
  ```bash
  npx playwright test --browser=all
  ```

- Run a single test file
  ```bash
  npx playwright test tests/todo-page.spec.ts
  ```

- Run a set of test files
  ```bash
  npx playwright test tests/todo-page/ tests/landing-page/
  ```

- Run a test with specific title
  ```bash
  npx playwright test -g "add a todo item"
  ```

- Run tests [in parallel](./test-parallel.md) - that's the default
  ```bash
  npx playwright test
  ```

- Disable [parallelization](./test-parallel.md)
  ```bash
  npx playwright test --workers=1
  ```

- Choose a [reporter](./test-reporters.md)
  ```bash
  npx playwright test --reporter=dot
  ```

- Run in debug mode with [Playwright Inspector](./inspector.md)
  ```bash
  # Linux/macOS
  PWDEBUG=1 npx playwright test

  # Windows with cmd.exe
  set PWDEBUG=1
  npx playwright test

  # Windows with PowerShell
  $env:PWDEBUG=1
  npx playwright test
  ```

## Create a configuration file

So far, we've looked at the zero-config operation of Playwright Test. For a real world application, it is likely that you would want to use a config.

Create `playwright.config.ts` (or `playwright.config.js`) to configure your tests. You can specify browser launch options, run tests in multiple browsers and much more with the config. Here is an example configuration that runs every test in Chromium, Firefox and WebKit, both Desktop and Mobile versions. Look for more options in the [configuration section](./test-configuration.md).

```js js-flavor=js
// playwright.config.js
const { devices } = require('@playwright/test');

module.exports = {
  projects: [
    {
      name: 'Desktop Chromium',
      use: {
        browserName: 'chromium',
        // Test against Chrome Beta channel.
        channel: 'chrome-beta',
      },
    },
    {
      name: 'Desktop Safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 1200, height: 750 },
      }
    },
    // Test against mobile viewports.
    {
      name: 'Mobile Chrome',
      use: devices['Pixel 5'],
    },
    {
      name: 'Mobile Safari',
      use: devices['iPhone 12'],
    },
    {
      name: 'Desktop Firefox',
      use: {
        browserName: 'firefox',
        viewport: { width: 800, height: 600 },
      }
    },
  ],
};
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  projects: [
    {
      name: 'Chrome Stable',
      use: {
        browserName: 'chromium',
        // Test against Chrome Stable channel.
        channel: 'chrome',
      },
    },
    {
      name: 'Desktop Safari',
      use: {
        browserName: 'webkit',
        viewport: { width: 1200, height: 750 },
      }
    },
    // Test against mobile viewports.
    {
      name: 'Mobile Chrome',
      use: devices['Pixel 5'],
    },
    {
      name: 'Mobile Safari',
      use: devices['iPhone 12'],
    },
    {
      name: 'Desktop Firefox',
      use: {
        browserName: 'firefox',
        viewport: { width: 800, height: 600 },
      }
    },
  ],
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
