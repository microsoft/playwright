# class: Test
* langs: js

Playwright Test provides a `test` function to declare tests and [`expect` function](https://jestjs.io/docs/expect) to write assertions.

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

## method: Test.(call)

Declares a test.

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

### param: Test.(call).title
- `title` <[string]>

Test title.

### param: Test.(call).testFunction
- `testFunction` <[function]\([Fixtures], [TestInfo]\)>

Test function that takes one or two arguments: an object with fixtures and optional [TestInfo].



## method: Test.afterAll

Declares an `afterAll` hook that is executed once per worker after all tests. When called in the scope of a test file, runs after all tests in the file. When called inside a [`method: Test.describe`] group, runs after all tests in the group.

Note that worker process is restarted on test failures, and `afterAll` hook runs again in the new worker. Learn more about [workers and failures](./test-retries.md).

### param: Test.afterAll.hookFunction
- `hookFunction` <[function]\([Fixtures], [TestInfo]\)>

Hook function that takes one or two arguments: an object with worker fixtures and optional [TestInfo].



## method: Test.afterEach

Declares an `afterEach` hook that is executed after each test. When called in the scope of a test file, runs after each test in the file. When called inside a [`method: Test.describe`] group, runs after each test in the group.

You can access all the same [Fixtures] as the test function itself, and also the [TestInfo] object that gives a lot of useful information. For example, you can check whether the test succeeded or failed.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test.afterEach(async ({ page }, testInfo) => {
  console.log(`Finished ${testInfo.title} with status ${testInfo.status}`);

  if (testInfo.status !== testInfo.expectedStatus)
    console.log(`Did not run as expected, ended up at ${page.url()}`);
});

test('my test', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test.afterEach(async ({ page }, testInfo) => {
  console.log(`Finished ${testInfo.title} with status ${testInfo.status}`);

  if (testInfo.status !== testInfo.expectedStatus)
    console.log(`Did not run as expected, ended up at ${page.url()}`);
});

test('my test', async ({ page }) => {
  // ...
});
```

### param: Test.afterEach.hookFunction
- `hookFunction` <[function]\([Fixtures], [TestInfo]\)>

Hook function that takes one or two arguments: an object with fixtures and optional [TestInfo].


## method: Test.beforeAll

Declares a `beforeAll` hook that is executed once per worker process before all tests. When called in the scope of a test file, runs before all tests in the file. When called inside a [`method: Test.describe`] group, runs before all tests in the group.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test.beforeAll(async () => {
  console.log('Before tests');
});

test.afterAll(async () => {
  console.log('After tests');
});

test('my test', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test.beforeAll(async () => {
  console.log('Before tests');
});

test.afterAll(async () => {
  console.log('After tests');
});

test('my test', async ({ page }) => {
  // ...
});
```

Note that worker process is restarted on test failures, and `beforeAll` hook runs again in the new worker. Learn more about [workers and failures](./test-retries.md).

You can use [`method: Test.afterAll`] to teardown any resources set up in `beforeAll`.

### param: Test.beforeAll.hookFunction
- `hookFunction` <[function]\([Fixtures], [TestInfo]\)>

Hook function that takes one or two arguments: an object with worker fixtures and optional [TestInfo].



## method: Test.beforeEach

Declares a `beforeEach` hook that is executed before each test. When called in the scope of a test file, runs before each test in the file. When called inside a [`method: Test.describe`] group, runs before each test in the group.

You can access all the same [Fixtures] as the test function itself, and also the [TestInfo] object that gives a lot of useful information. For example, you can navigate the page before starting the test.

```js js-flavor=js
// example.spec.js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }, testInfo) => {
  console.log(`Running ${testInfo.title}`);
  await page.goto('https://my.start.url/');
});

test('my test', async ({ page }) => {
  expect(page.url()).toBe('https://my.start.url/');
});
```

```js js-flavor=ts
// example.spec.ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  console.log(`Running ${testInfo.title}`);
  await page.goto('https://my.start.url/');
});

test('my test', async ({ page }) => {
  expect(page.url()).toBe('https://my.start.url/');
});
```

You can use [`method: Test.afterEach`] to teardown any resources set up in `beforeEach`.

### param: Test.beforeEach.hookFunction
- `hookFunction` <[function]\([Fixtures], [TestInfo]\)>

Hook function that takes one or two arguments: an object with fixtures and optional [TestInfo].




## method: Test.describe

Declares a group of tests.

```js js-flavor=js
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
test.describe('two tests', () => {
  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

### param: Test.describe.title
- `title` <[string]>

Group title.

### param: Test.describe.callback
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe`]. Any tests added in this callback will belong to the group.


## method: Test.describe.configure

Set execution mode of execution for the enclosing scope. Can be executed either on the top level or inside a describe. Configuration applies to the entire scope, regardless of whether it run before or after the test
declaration.

Learn more about the execution modes [here](./test-parallel.md).

Running tests in parallel:

```js js-flavor=js
// Run all the tests in the file concurrently using parallel workers.
test.describe.configure({ mode: 'parallel' });
test('runs in parallel 1', async ({ page }) => {});
test('runs in parallel 2', async ({ page }) => {});
```

```js js-flavor=ts
// Run all the tests in the file concurrently using parallel workers.
test.describe.configure({ mode: 'parallel' });
test('runs in parallel 1', async ({ page }) => {});
test('runs in parallel 2', async ({ page }) => {});
```

Running tests sequentially:

```js js-flavor=js
// Annotate tests as inter-dependent.
test.describe.configure({ mode: 'serial' });
test('runs first', async ({ page }) => {});
test('runs second', async ({ page }) => {});
```

```js js-flavor=ts
// Annotate tests as inter-dependent.
test.describe.configure({ mode: 'serial' });
test('runs first', async ({ page }) => {});
test('runs second', async ({ page }) => {});
```

### option: Test.describe.configure.mode
- `mode` <"parallel"|"serial">



## method: Test.describe.only

Declares a focused group of tests. If there are some focused tests or suites, all of them will be run but nothing else.

```js js-flavor=js
test.describe.only('focused group', () => {
  test('in the focused group', async ({ page }) => {
    // This test will run
  });
});
test('not in the focused group', async ({ page }) => {
  // This test will not run
});
```

```js js-flavor=ts
test.describe.only('focused group', () => {
  test('in the focused group', async ({ page }) => {
    // This test will run
  });
});
test('not in the focused group', async ({ page }) => {
  // This test will not run
});
```

### param: Test.describe.only.title
- `title` <[string]>

Group title.

### param: Test.describe.only.callback
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.only`]. Any tests added in this callback will belong to the group.



## method: Test.describe.parallel

Declares a group of tests that could be run in parallel. By default, tests in a single test file run one after another, but using [`method: Test.describe.parallel`] allows them to run in parallel.

See [`method: Test.describe.configure`] for the preferred way of configuring the execution mode.

```js js-flavor=js
test.describe.parallel('group', () => {
  test('runs in parallel 1', async ({ page }) => {});
  test('runs in parallel 2', async ({ page }) => {});
});
```

```js js-flavor=ts
test.describe.parallel('group', () => {
  test('runs in parallel 1', async ({ page }) => {});
  test('runs in parallel 2', async ({ page }) => {});
});
```

Note that parallel tests are executed in separate processes and cannot share any state or global variables. Each of the parallel tests executes all relevant hooks.

### param: Test.describe.parallel.title
- `title` <[string]>

Group title.

### param: Test.describe.parallel.callback
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.parallel`]. Any tests added in this callback will belong to the group.



## method: Test.describe.parallel.only

Declares a focused group of tests that could be run in parallel. This is similar to [`method: Test.describe.parallel`], but focuses the group. If there are some focused tests or suites, all of them will be run but nothing else.

### param: Test.describe.parallel.only.title
- `title` <[string]>

Group title.

### param: Test.describe.parallel.only.callback
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.parallel.only`]. Any tests added in this callback will belong to the group.



## method: Test.describe.serial

Declares a group of tests that should always be run serially. If one of the tests fails, all subsequent tests are skipped. All tests in a group are retried together.

See [`method: Test.describe.configure`] for the preferred way of configuring the execution mode.

:::note
Using serial is not recommended. It is usually better to make your tests isolated, so they can be run independently.
:::

```js js-flavor=js
test.describe.serial('group', () => {
  test('runs first', async ({ page }) => {});
  test('runs second', async ({ page }) => {});
});
```

```js js-flavor=ts
test.describe.serial('group', () => {
  test('runs first', async ({ page }) => {});
  test('runs second', async ({ page }) => {});
});
```

### param: Test.describe.serial.title
- `title` <[string]>

Group title.

### param: Test.describe.serial.callback
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.serial`]. Any tests added in this callback will belong to the group.



## method: Test.describe.serial.only

Declares a focused group of tests that should always be run serially. If one of the tests fails, all subsequent tests are skipped. All tests in a group are retried together. If there are some focused tests or suites, all of them will be run but nothing else.

:::note
Using serial is not recommended. It is usually better to make your tests isolated, so they can be run independently.
:::

```js js-flavor=js
test.describe.serial.only('group', () => {
  test('runs first', async ({ page }) => {
  });
  test('runs second', async ({ page }) => {
  });
});
```

```js js-flavor=ts
test.describe.serial.only('group', () => {
  test('runs first', async ({ page }) => {
  });
  test('runs second', async ({ page }) => {
  });
});
```

### param: Test.describe.serial.only.title
- `title` <[string]>

Group title.

### param: Test.describe.serial.only.callback
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.serial.only`]. Any tests added in this callback will belong to the group.




## property: Test.expect
- type: <[Object]>

`expect` function can be used to create test assertions. Read [expect library documentation](https://jestjs.io/docs/expect) for more details.





## method: Test.extend
- returns: <[Test]>

Extends the `test` object by defining fixtures and/or options that can be used in the tests.

First define a fixture and/or an option.

```js js-flavor=js
// my-test.js
const base = require('@playwright/test');
const { TodoPage } = require('./todo-page');

// Extend basic test by providing a "defaultItem" option and a "todoPage" fixture.
exports.test = base.test.extend({
  // Define an option and provide a default value.
  // We can later override it in the config.
  defaultItem: ['Do stuff', { option: true }],

  // Define a fixture. Note that it can use built-in fixture "page"
  // and a new option "defaultItem".
  todoPage: async ({ page, defaultItem }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo(defaultItem);
    await use(todoPage);
    await todoPage.removeAll();
  },
});
```

```js js-flavor=ts
import { test as base } from '@playwright/test';
import { TodoPage } from './todo-page';

export type Options = { defaultItem: string };

// Extend basic test by providing a "defaultItem" option and a "todoPage" fixture.
export const test = base.extend<Options & { todoPage: TodoPage }>({
  // Define an option and provide a default value.
  // We can later override it in the config.
  defaultItem: ['Do stuff', { option: true }],

  // Define a fixture. Note that it can use built-in fixture "page"
  // and a new option "defaultItem".
  todoPage: async ({ page, defaultItem }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo(defaultItem);
    await use(todoPage);
    await todoPage.removeAll();
  },
});
```

Then use the fixture in the test.

```js js-flavor=js
// example.spec.js
const { test } = require('./my-test');

test('test 1', async ({ todoPage }) => {
  await todoPage.addToDo('my todo');
  // ...
});
```

```js js-flavor=ts
// example.spec.ts
import { test } from './my-test';

test('test 1', async ({ todoPage }) => {
  await todoPage.addToDo('my todo');
  // ...
});
```

Configure the option in config file.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig<{ defaultItem: string }>} */
const config = {
  projects: [
    {
      name: 'shopping',
      use: { defaultItem: 'Buy milk' },
    },
    {
      name: 'wellbeing',
      use: { defaultItem: 'Exercise!' },
    },
  ]
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';
import { Options } from './my-test';

const config: PlaywrightTestConfig<Options> = {
  projects: [
    {
      name: 'shopping',
      use: { defaultItem: 'Buy milk' },
    },
    {
      name: 'wellbeing',
      use: { defaultItem: 'Exercise!' },
    },
  ]
};
export default config;
```

Learn more about [fixtures](./test-fixtures.md) and [parametrizing tests](./test-parameterize.md).

### param: Test.extend.fixtures
- `fixtures` <[Object]>

An object containing fixtures and/or options. Learn more about [fixtures format](./test-fixtures.md).





## method: Test.fail

Marks a test or a group of tests as "should fail". Playwright Test runs these tests and ensures that they are actually failing. This is useful for documentation purposes to acknowledge that some functionality is broken until it is fixed.

Unconditional fail:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('not yet ready', async ({ page }) => {
  test.fail();
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('not yet ready', async ({ page }) => {
  test.fail();
  // ...
});
```

Conditional fail a test with an optional description:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('fail in WebKit', async ({ page, browserName }) => {
  test.fail(browserName === 'webkit', 'This feature is not implemented for Mac yet');
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('fail in WebKit', async ({ page, browserName }) => {
  test.fail(browserName === 'webkit', 'This feature is not implemented for Mac yet');
  // ...
});
```

Conditional fail for all tests in a file or [`method: Test.describe`] group:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.fail(({ browserName }) => browserName === 'webkit');

test('fail in WebKit 1', async ({ page }) => {
  // ...
});
test('fail in WebKit 2', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.fail(({ browserName }) => browserName === 'webkit');

test('fail in WebKit 1', async ({ page }) => {
  // ...
});
test('fail in WebKit 2', async ({ page }) => {
  // ...
});
```

### param: Test.fail.condition
- `condition` <[void]|[boolean]|[function]\([Fixtures]\):[boolean]>

Optional condition - either a boolean value, or a function that takes a fixtures object and returns a boolean. Test or tests are marked as "should fail" when the condition is `true`.

### param: Test.fail.description
- `description` <[void]|[string]>

Optional description that will be reflected in a test report.




## method: Test.fixme#1

Declares a test to be fixed, similarly to [`method: Test.(call)`]. This test will not be run.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.fixme('test to be fixed', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.fixme('test to be fixed', async ({ page }) => {
  // ...
});
```

### param: Test.fixme#1.title
- `title` <[string]>

Test title.

### param: Test.fixme#1.testFunction
- `testFunction` <[function]\([Fixtures], [TestInfo]\)>

Test function that takes one or two arguments: an object with fixtures and optional [TestInfo].



## method: Test.fixme#2

Mark a test as "fixme", with the intention to fix it. Test is immediately aborted when you call [`method: Test.fixme#2`].

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('test to be fixed', async ({ page }) => {
  test.fixme();
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('test to be fixed', async ({ page }) => {
  test.fixme();
  // ...
});
```

Mark all tests in a file or [`method: Test.describe`] group as "fixme".

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.fixme();

test('test to be fixed 1', async ({ page }) => {
  // ...
});
test('test to be fixed 2', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.fixme();

test('test to be fixed 1', async ({ page }) => {
  // ...
});
test('test to be fixed 2', async ({ page }) => {
  // ...
});
```


## method: Test.fixme#3

Conditionally mark a test as "fixme" with an optional description.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('broken in WebKit', async ({ page, browserName }) => {
  test.fixme(browserName === 'webkit', 'This feature is not implemented on Mac yet');
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('broken in WebKit', async ({ page, browserName }) => {
  test.fixme(browserName === 'webkit', 'This feature is not implemented on Mac yet');
  // ...
});
```


### param: Test.fixme#3.condition
- `condition` <[boolean]>

Test or tests are marked as "fixme" when the condition is `true`.

### param: Test.fixme#3.description
- `description` <[void]|[string]>

An optional description that will be reflected in a test report.




## method: Test.fixme#4

Conditionally mark all tests in a file or [`method: Test.describe`] group as "fixme".

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.fixme(({ browserName }) => browserName === 'webkit');

test('broken in WebKit 1', async ({ page }) => {
  // ...
});
test('broken in WebKit 2', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.fixme(({ browserName }) => browserName === 'webkit');

test('broken in WebKit 1', async ({ page }) => {
  // ...
});
test('broken in WebKit 2', async ({ page }) => {
  // ...
});
```


### param: Test.fixme#4.condition
- `callback` <[function]\([Fixtures]\):[boolean]>

A function that returns whether to mark as "fixme", based on test fixtures. Test or tests are marked as "fixme" when the return value is `true`.

### param: Test.fixme#4.description
- `description` <[void]|[string]>

An optional description that will be reflected in a test report.


## method: Test.info
- returns: <[TestInfo]>

Returns information about the currently running test. This method can only be called during the test execution, otherwise it throws.

## method: Test.only

Declares a focused test. If there are some focused tests or suites, all of them will be run but nothing else.

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

### param: Test.only.title
- `title` <[string]>

Test title.

### param: Test.only.testFunction
- `testFunction` <[function]\([Fixtures], [TestInfo]\)>

Test function that takes one or two arguments: an object with fixtures and optional [TestInfo].




## method: Test.setTimeout

Changes the timeout for the test. Learn more about [various timeouts](./test-timeouts.md).

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('very slow test', async ({ page }) => {
  test.setTimeout(120000);
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('very slow test', async ({ page }) => {
  test.setTimeout(120000);
  // ...
});
```

Changing timeout from a slow hook:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  test.setTimeout(testInfo.timeout + 30000);
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  test.setTimeout(testInfo.timeout + 30000);
});
```

Timeout for the currently running test is available through [`property: TestInfo.timeout`].

### param: Test.setTimeout.timeout
- `timeout` <[int]>

Timeout in milliseconds.



## method: Test.skip#1

Declares a skipped test, similarly to [`method: Test.(call)`]. Skipped test is never run.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.skip('broken test', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.skip('broken test', async ({ page }) => {
  // ...
});
```

### param: Test.skip#1.title
- `title` <[string]>

Test title.

### param: Test.skip#1.testFunction
- `testFunction` <[function]\([Fixtures], [TestInfo]\)>

Test function that takes one or two arguments: an object with fixtures and optional [TestInfo].



## method: Test.skip#2

Unconditionally skip a test. Test is immediately aborted when you call [`method: Test.skip#2`].

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('skipped test', async ({ page }) => {
  test.skip();
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('skipped test', async ({ page }) => {
  test.skip();
  // ...
});
```

Unconditionally skip all tests in a file or [`method: Test.describe`] group:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.skip();

test('skipped test 1', async ({ page }) => {
  // ...
});
test('skipped test 2', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.skip();

test('skipped test 1', async ({ page }) => {
  // ...
});
test('skipped test 2', async ({ page }) => {
  // ...
});
```


## method: Test.skip#3

Conditionally skip a test with an optional description.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('skip in WebKit', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'This feature is not implemented for Mac');
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('skip in WebKit', async ({ page, browserName }) => {
  test.skip(browserName === 'webkit', 'This feature is not implemented for Mac');
  // ...
});
```

Skip from [`method: Test.beforeEach`] hook:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }) => {
  test.skip(process.env.APP_VERSION === 'v1', 'There are no settings in v1');
  await page.goto('/settings');
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  test.skip(process.env.APP_VERSION === 'v1', 'There are no settings in v1');
  await page.goto('/settings');
});
```

### param: Test.skip#3.condition
- `condition` <[boolean]>

A skip condition. Test or tests are skipped when the condition is `true`.

### param: Test.skip#3.description
- `description` <[void]|[string]>

An optional description that will be reflected in a test report.




## method: Test.skip#4

Conditionally skips all tests in a file or [`method: Test.describe`] group.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.skip(({ browserName }) => browserName === 'webkit');

test('skip in WebKit 1', async ({ page }) => {
  // ...
});
test('skip in WebKit 2', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.skip(({ browserName }) => browserName === 'webkit');

test('skip in WebKit 1', async ({ page }) => {
  // ...
});
test('skip in WebKit 2', async ({ page }) => {
  // ...
});
```


### param: Test.skip#4.condition
- `callback` <[function]\([Fixtures]\):[boolean]>

A function that returns whether to skip, based on test fixtures. Test or tests are skipped when the return value is `true`.

### param: Test.skip#4.description
- `description` <[void]|[string]>

An optional description that will be reflected in a test report.



## method: Test.slow

Marks a test or a group of tests as "slow". Slow tests will be given triple the default timeout.

Unconditional slow:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('slow test', async ({ page }) => {
  test.slow();
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('slow test', async ({ page }) => {
  test.slow();
  // ...
});
```

Conditional slow a test with an optional description:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('slow in WebKit', async ({ page, browserName }) => {
  test.slow(browserName === 'webkit', 'This feature is slow on Mac');
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('slow in WebKit', async ({ page, browserName }) => {
  test.slow(browserName === 'webkit', 'This feature is slow on Mac');
  // ...
});
```

Conditional slow for all tests in a file or [`method: Test.describe`] group:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.slow(({ browserName }) => browserName === 'webkit');

test('slow in WebKit 1', async ({ page }) => {
  // ...
});
test('slow in WebKit 2', async ({ page }) => {
  // ...
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.slow(({ browserName }) => browserName === 'webkit');

test('slow in WebKit 1', async ({ page }) => {
  // ...
});
test('fail in WebKit 2', async ({ page }) => {
  // ...
});
```

### param: Test.slow.condition
- `condition` <[void]|[boolean]|[function]\([Fixtures]\):[boolean]>

Optional condition - either a boolean value, or a function that takes a fixtures object and returns a boolean. Test or tests are marked as "slow" when the condition is `true`.

### param: Test.slow.description
- `description` <[void]|[string]>

Optional description that will be reflected in a test report.


## method: Test.step

Declares a test step.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('test', async ({ page }) => {
  await test.step('Log in', async () => {
    // ...
  });
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await test.step('Log in', async () => {
    // ...
  });
});
```

### param: Test.step.title
- `title` <[string]>

Step name.


### param: Test.step.body
- `body` <[function]\(\):[Promise]<[any]>>

Step body.



## method: Test.use

Specifies options or fixtures to use in a single test file or a [`method: Test.describe`] group. Most useful to set an option, for example set `locale` to configure `context` fixture. `test.use` can be called either in the global scope or inside `test.describe`, it's is an error to call it within `beforeEach` or `beforeAll`.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.use({ locale: 'en-US' });

test('test with locale', async ({ page }) => {
  // Default context and page have locale as specified
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US' });

test('test with locale', async ({ page }) => {
  // Default context and page have locale as specified
});
```

It is also possible to override a fixture by providing a function.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.use({
  locale: async ({}, use) => {
    // Read locale from some configuration file.
    const locale = await fs.promises.readFile('test-locale', 'utf-8');
    await use(locale);
  },
});

test('test with locale', async ({ page }) => {
  // Default context and page have locale as specified
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.use({
  locale: async ({}, use) => {
    // Read locale from some configuration file.
    const locale = await fs.promises.readFile('test-locale', 'utf-8');
    await use(locale);
  },
});

test('test with locale', async ({ page }) => {
  // Default context and page have locale as specified
});
```

### param: Test.use.fixtures
- `options` <[TestOptions]>

An object with local options.


