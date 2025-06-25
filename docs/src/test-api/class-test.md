# class: Test
* since: v1.10
* langs: js

Playwright Test provides a `test` function to declare tests and `expect` function to write assertions.

```js
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  const name = await page.innerText('.navbar__title');
  expect(name).toBe('Playwright');
});
```

## method: Test.(call)
* since: v1.10

Declares a test.

* `test(title, body)`
* `test(title, details, body)`

**Usage**

```js
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  // ...
});
```

**Tags**

You can tag tests by providing additional test details. Alternatively, you can include tags in the test title. Note that each tag must start with `@` symbol.

```js
import { test, expect } from '@playwright/test';

test('basic test', {
  tag: '@smoke',
}, async ({ page }) => {
  await page.goto('https://playwright.dev/');
  // ...
});

test('another test @smoke', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  // ...
});
```

Test tags are displayed in the test report, and are available to a custom reporter via `TestCase.tags` property.

You can also filter tests by their tags during test execution:
* in the [command line](../test-cli.md#all-options);
* in the config with [`property: TestConfig.grep`] and [`property: TestProject.grep`];

Learn more about [tagging](../test-annotations.md#tag-tests).

**Annotations**

You can annotate tests by providing additional test details.

```js
import { test, expect } from '@playwright/test';

test('basic test', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/23180',
  },
}, async ({ page }) => {
  await page.goto('https://playwright.dev/');
  // ...
});
```

Test annotations are displayed in the test report, and are available to a custom reporter via `TestCase.annotations` property.

You can also add annotations during runtime by manipulating [`property: TestInfo.annotations`].

Learn more about [test annotations](../test-annotations.md).

### param: Test.(call).title
* since: v1.10
- `title` <[string]>

Test title.

### param: Test.(call).details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]> Annotation type, for example `'issue'`.
    - `description` ?<[string]> Optional annotation description, for example an issue url.

Additional test details.

### param: Test.(call).body
* since: v1.10
- `body` <[function]\([Fixtures], [TestInfo]\)>

Test body that takes one or two arguments: an object with fixtures and optional [TestInfo].



## method: Test.afterAll
* since: v1.10

Declares an `afterAll` hook that is executed once per worker after all tests.

When called in the scope of a test file, runs after all tests in the file. When called inside a [`method: Test.describe`] group, runs after all tests in the group.

**Details**

When multiple `afterAll` hooks are added, they will run in the order of their registration.

Note that worker process is restarted on test failures, and `afterAll` hook runs again in the new worker. Learn more about [workers and failures](../test-retries.md).

Playwright will continue running all applicable hooks even if some of them have failed.

* `test.afterAll(hookFunction)`
* `test.afterAll(title, hookFunction)`

**Usage**

```js
test.afterAll(async () => {
  console.log('Done with tests');
  // ...
});
```

Alternatively, you can declare a hook **with a title**.

```js
test.afterAll('Teardown', async () => {
  console.log('Done with tests');
  // ...
});
```

### param: Test.afterAll.title
* since: v1.38
- `title` ?<[string]>

Hook title.

### param: Test.afterAll.hookFunction
* since: v1.10
- `hookFunction` <[function]\([Fixtures], [TestInfo]\)>

Hook function that takes one or two arguments: an object with worker fixtures and optional [TestInfo].



## method: Test.afterEach
* since: v1.10

Declares an `afterEach` hook that is executed after each test.

When called in the scope of a test file, runs after each test in the file. When called inside a [`method: Test.describe`] group, runs after each test in the group.

You can access all the same [Fixtures] as the test body itself, and also the [TestInfo] object that gives a lot of useful information. For example, you can check whether the test succeeded or failed.

* `test.afterEach(hookFunction)`
* `test.afterEach(title, hookFunction)`

**Details**

When multiple `afterEach` hooks are added, they will run in the order of their registration.

Playwright will continue running all applicable hooks even if some of them have failed.

**Usage**


```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test.afterEach(async ({ page }) => {
  console.log(`Finished ${test.info().title} with status ${test.info().status}`);

  if (test.info().status !== test.info().expectedStatus)
    console.log(`Did not run as expected, ended up at ${page.url()}`);
});

test('my test', async ({ page }) => {
  // ...
});
```

Alternatively, you can declare a hook **with a title**.

```js title="example.spec.ts"
test.afterEach('Status check', async ({ page }) => {
  if (test.info().status !== test.info().expectedStatus)
    console.log(`Did not run as expected, ended up at ${page.url()}`);
});
```

### param: Test.afterEach.title
* since: v1.38
- `title` ?<[string]>

Hook title.

### param: Test.afterEach.hookFunction
* since: v1.10
- `hookFunction` <[function]\([Fixtures], [TestInfo]\)>

Hook function that takes one or two arguments: an object with fixtures and optional [TestInfo].



## method: Test.beforeAll
* since: v1.10

Declares a `beforeAll` hook that is executed once per worker process before all tests.

When called in the scope of a test file, runs before all tests in the file. When called inside a [`method: Test.describe`] group, runs before all tests in the group.

You can use [`method: Test.afterAll`] to teardown any resources set up in `beforeAll`.

* `test.beforeAll(hookFunction)`
* `test.beforeAll(title, hookFunction)`

**Details**

When multiple `beforeAll` hooks are added, they will run in the order of their registration.

Note that worker process is restarted on test failures, and `beforeAll` hook runs again in the new worker. Learn more about [workers and failures](../test-retries.md).

Playwright will continue running all applicable hooks even if some of them have failed.

**Usage**


```js title="example.spec.ts"
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


Alternatively, you can declare a hook **with a title**.

```js title="example.spec.ts"
test.beforeAll('Setup', async () => {
  console.log('Before tests');
});
```

### param: Test.beforeAll.title
* since: v1.38
- `title` ?<[string]>

Hook title.

### param: Test.beforeAll.hookFunction
* since: v1.10
- `hookFunction` <[function]\([Fixtures], [TestInfo]\)>

Hook function that takes one or two arguments: an object with worker fixtures and optional [TestInfo].


## method: Test.beforeEach
* since: v1.10

Declares a `beforeEach` hook that is executed before each test.

When called in the scope of a test file, runs before each test in the file. When called inside a [`method: Test.describe`] group, runs before each test in the group.

You can access all the same [Fixtures] as the test body itself, and also the [TestInfo] object that gives a lot of useful information. For example, you can navigate the page before starting the test.

You can use [`method: Test.afterEach`] to teardown any resources set up in `beforeEach`.

* `test.beforeEach(hookFunction)`
* `test.beforeEach(title, hookFunction)`

**Details**

When multiple `beforeEach` hooks are added, they will run in the order of their registration.

Playwright will continue running all applicable hooks even if some of them have failed.

**Usage**

```js title="example.spec.ts"
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  console.log(`Running ${test.info().title}`);
  await page.goto('https://my.start.url/');
});

test('my test', async ({ page }) => {
  expect(page.url()).toBe('https://my.start.url/');
});
```

Alternatively, you can declare a hook **with a title**.

```js title="example.spec.ts"
test.beforeEach('Open start URL', async ({ page }) => {
  console.log(`Running ${test.info().title}`);
  await page.goto('https://my.start.url/');
});
```

### param: Test.beforeEach.title
* since: v1.38
- `title` ?<[string]>

Hook title.

### param: Test.beforeEach.hookFunction
* since: v1.10
- `hookFunction` <[function]\([Fixtures], [TestInfo]\)>

Hook function that takes one or two arguments: an object with fixtures and optional [TestInfo].



## method: Test.describe
* since: v1.10

Declares a group of tests.

* `test.describe(title, callback)`
* `test.describe(callback)`
* `test.describe(title, details, callback)`

**Usage**

You can declare a group of tests with a title. The title will be visible in the test report as a part of each test's title.

```js
test.describe('two tests', () => {
  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

**Anonymous group**

You can also declare a test group without a title. This is convenient to give a group of tests a common option with [`method: Test.use`].

```js
test.describe(() => {
  test.use({ colorScheme: 'dark' });

  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

**Tags**

You can tag all tests in a group by providing additional details. Note that each tag must start with `@` symbol.

```js
import { test, expect } from '@playwright/test';

test.describe('two tagged tests', {
  tag: '@smoke',
}, () => {
  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

Learn more about [tagging](../test-annotations.md#tag-tests).

**Annotations**

You can annotate all tests in a group by providing additional details.

```js
import { test, expect } from '@playwright/test';

test.describe('two annotated tests', {
  annotation: {
    type: 'issue',
    description: 'https://github.com/microsoft/playwright/issues/23180',
  },
}, () => {
  test('one', async ({ page }) => {
    // ...
  });

  test('two', async ({ page }) => {
    // ...
  });
});
```

Learn more about [test annotations](../test-annotations.md).

### param: Test.describe.title
* since: v1.10
- `title` ?<[string]>

Group title.

### param: Test.describe.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

Additional details for all tests in the group.

### param: Test.describe.callback
* since: v1.10
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe`]. Any tests declared in this callback will belong to the group.



## method: Test.describe.configure
* since: v1.10

Configures the enclosing scope. Can be executed either on the top level or inside a describe. Configuration applies to the entire scope, regardless of whether it run before or after the test declaration.

Learn more about the execution modes [here](../test-parallel.md).

**Usage**

* Running tests in parallel.

  ```js
  // Run all the tests in the file concurrently using parallel workers.
  test.describe.configure({ mode: 'parallel' });
  test('runs in parallel 1', async ({ page }) => {});
  test('runs in parallel 2', async ({ page }) => {});
  ```

* Running tests in order, retrying each failed test independently.

  This is the default mode. It can be useful to set it explicitly to override project configuration that uses `fullyParallel`.

  ```js
  // Tests in this file run in order. Retries, if any, run independently.
  test.describe.configure({ mode: 'default' });
  test('runs first', async ({ page }) => {});
  test('runs second', async ({ page }) => {});
  ```

* Running tests serially, retrying from the start. If one of the serial tests fails, all subsequent tests are skipped.

  :::note
  Running serially is not recommended. It is usually better to make your tests isolated, so they can be run independently.
  :::

  ```js
  // Annotate tests as inter-dependent.
  test.describe.configure({ mode: 'serial' });
  test('runs first', async ({ page }) => {});
  test('runs second', async ({ page }) => {});
  ```

* Configuring retries and timeout for each test.

  ```js
  // Each test in the file will be retried twice and have a timeout of 20 seconds.
  test.describe.configure({ retries: 2, timeout: 20_000 });
  test('runs first', async ({ page }) => {});
  test('runs second', async ({ page }) => {});
  ```

* Run multiple describes in parallel, but tests inside each describe in order.

  ```js
  test.describe.configure({ mode: 'parallel' });

  test.describe('A, runs in parallel with B', () => {
    test.describe.configure({ mode: 'default' });
    test('in order A1', async ({ page }) => {});
    test('in order A2', async ({ page }) => {});
  });

  test.describe('B, runs in parallel with A', () => {
    test.describe.configure({ mode: 'default' });
    test('in order B1', async ({ page }) => {});
    test('in order B2', async ({ page }) => {});
  });
  ```

### option: Test.describe.configure.mode
* since: v1.10
- `mode` <[TestMode]<"default"|"parallel"|"serial">>

Execution mode. Learn more about the execution modes [here](../test-parallel.md).

### option: Test.describe.configure.retries
* since: v1.28
- `retries` <[int]>

The number of retries for each test.

### option: Test.describe.configure.timeout
* since: v1.28
- `timeout` <[int]>

Timeout for each test in milliseconds. Overrides [`property: TestProject.timeout`] and [`property: TestConfig.timeout`].


## method: Test.describe.fixme
* since: v1.25

Declares a test group similarly to [`method: Test.describe`]. Tests in this group are marked as "fixme" and will not be executed.

* `test.describe.fixme(title, callback)`
* `test.describe.fixme(callback)`
* `test.describe.fixme(title, details, callback)`

**Usage**

```js
test.describe.fixme('broken tests that should be fixed', () => {
  test('example', async ({ page }) => {
    // This test will not run
  });
});
```

You can also omit the title.

```js
test.describe.fixme(() => {
  // ...
});
```

### param: Test.describe.fixme.title
* since: v1.25
- `title` ?<[string]>

Group title.

### param: Test.describe.fixme.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.describe`] for details description.

### param: Test.describe.fixme.callback
* since: v1.25
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.fixme`]. Any tests added in this callback will belong to the group, and will not be run.



## method: Test.describe.only
* since: v1.10

Declares a focused group of tests. If there are some focused tests or suites, all of them will be run but nothing else.

* `test.describe.only(title, callback)`
* `test.describe.only(callback)`
* `test.describe.only(title, details, callback)`

**Usage**

```js
test.describe.only('focused group', () => {
  test('in the focused group', async ({ page }) => {
    // This test will run
  });
});
test('not in the focused group', async ({ page }) => {
  // This test will not run
});
```

You can also omit the title.

```js
test.describe.only(() => {
  // ...
});
```


### param: Test.describe.only.title
* since: v1.10
- `title` ?<[string]>

Group title.

### param: Test.describe.only.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.describe`] for details description.

### param: Test.describe.only.callback
* since: v1.10
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.only`]. Any tests added in this callback will belong to the group.



## method: Test.describe.parallel
* since: v1.10
* discouraged: See [`method: Test.describe.configure`] for the preferred way of configuring the execution mode.

Declares a group of tests that could be run in parallel. By default, tests in a single test file run one after another, but using [`method: Test.describe.parallel`] allows them to run in parallel.

* `test.describe.parallel(title, callback)`
* `test.describe.parallel(callback)`
* `test.describe.parallel(title, details, callback)`

**Usage**

```js
test.describe.parallel('group', () => {
  test('runs in parallel 1', async ({ page }) => {});
  test('runs in parallel 2', async ({ page }) => {});
});
```

Note that parallel tests are executed in separate processes and cannot share any state or global variables. Each of the parallel tests executes all relevant hooks.

You can also omit the title.

```js
test.describe.parallel(() => {
  // ...
});
```

### param: Test.describe.parallel.title
* since: v1.10
- `title` ?<[string]>

Group title.

### param: Test.describe.parallel.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.describe`] for details description.

### param: Test.describe.parallel.callback
* since: v1.10
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.parallel`]. Any tests added in this callback will belong to the group.



## method: Test.describe.parallel.only
* since: v1.10
* discouraged: See [`method: Test.describe.configure`] for the preferred way of configuring the execution mode.

Declares a focused group of tests that could be run in parallel. This is similar to [`method: Test.describe.parallel`], but focuses the group. If there are some focused tests or suites, all of them will be run but nothing else.

* `test.describe.parallel.only(title, callback)`
* `test.describe.parallel.only(callback)`
* `test.describe.parallel.only(title, details, callback)`

**Usage**

```js
test.describe.parallel.only('group', () => {
  test('runs in parallel 1', async ({ page }) => {});
  test('runs in parallel 2', async ({ page }) => {});
});
```

You can also omit the title.

```js
test.describe.parallel.only(() => {
  // ...
});
```

### param: Test.describe.parallel.only.title
* since: v1.10
- `title` ?<[string]>

Group title.

### param: Test.describe.parallel.only.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.describe`] for details description.

### param: Test.describe.parallel.only.callback
* since: v1.10
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.parallel.only`]. Any tests added in this callback will belong to the group.



## method: Test.describe.serial
* since: v1.10
* discouraged: See [`method: Test.describe.configure`] for the preferred way of configuring the execution mode.

Declares a group of tests that should always be run serially. If one of the tests fails, all subsequent tests are skipped. All tests in a group are retried together.

:::note
Using serial is not recommended. It is usually better to make your tests isolated, so they can be run independently.
:::

* `test.describe.serial(title, callback)`
* `test.describe.serial(title)`
* `test.describe.serial(title, details, callback)`

**Usage**

```js
test.describe.serial('group', () => {
  test('runs first', async ({ page }) => {});
  test('runs second', async ({ page }) => {});
});
```

You can also omit the title.

```js
test.describe.serial(() => {
  // ...
});
```

### param: Test.describe.serial.title
* since: v1.10
- `title` ?<[string]>

Group title.

### param: Test.describe.serial.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.describe`] for details description.

### param: Test.describe.serial.callback
* since: v1.10
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.serial`]. Any tests added in this callback will belong to the group.



## method: Test.describe.serial.only
* since: v1.10
* discouraged: See [`method: Test.describe.configure`] for the preferred way of configuring the execution mode.

Declares a focused group of tests that should always be run serially. If one of the tests fails, all subsequent tests are skipped. All tests in a group are retried together. If there are some focused tests or suites, all of them will be run but nothing else.

:::note
Using serial is not recommended. It is usually better to make your tests isolated, so they can be run independently.
:::

* `test.describe.serial.only(title, callback)`
* `test.describe.serial.only(title)`
* `test.describe.serial.only(title, details, callback)`

**Usage**

```js
test.describe.serial.only('group', () => {
  test('runs first', async ({ page }) => {
  });
  test('runs second', async ({ page }) => {
  });
});
```

You can also omit the title.

```js
test.describe.serial.only(() => {
  // ...
});
```

### param: Test.describe.serial.only.title
* since: v1.10
- `title` <[string]>

Group title.

### param: Test.describe.serial.only.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.describe`] for details description.

### param: Test.describe.serial.only.callback
* since: v1.10
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.serial.only`]. Any tests added in this callback will belong to the group.




## method: Test.describe.skip
* since: v1.10

Declares a skipped test group, similarly to [`method: Test.describe`]. Tests in the skipped group are never run.

* `test.describe.skip(title, callback)`
* `test.describe.skip(title)`
* `test.describe.skip(title, details, callback)`

**Usage**

```js
test.describe.skip('skipped group', () => {
  test('example', async ({ page }) => {
    // This test will not run
  });
});
```

You can also omit the title.

```js
test.describe.skip(() => {
  // ...
});
```

### param: Test.describe.skip.title
* since: v1.10
- `title` <[string]>

Group title.

### param: Test.describe.skip.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.describe`] for details description.

### param: Test.describe.skip.callback
* since: v1.10
- `callback` <[function]>

A callback that is run immediately when calling [`method: Test.describe.skip`]. Any tests added in this callback will belong to the group, and will not be run.



## property: Test.expect
* since: v1.10
- type: <[Object]>

`expect` function can be used to create test assertions. Read more about [test assertions](../test-assertions.md).

**Usage**

```js
test('example', async ({ page }) => {
  await test.expect(page).toHaveTitle('Title');
});
```



## method: Test.extend
* since: v1.10
- returns: <[Test]>

Extends the `test` object by defining fixtures and/or options that can be used in the tests.

**Usage**

First define a fixture and/or an option.

```js tab=js-js title="my-test.js"
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

```js tab=js-ts
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

```js title="example.spec.ts"
import { test } from './my-test';

test('test 1', async ({ todoPage }) => {
  await todoPage.addToDo('my todo');
  // ...
});
```

Configure the option in config file.

```js tab=js-js title="playwright.config.ts"
// @ts-check

module.exports = defineConfig({
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
});
```

```js tab=js-ts title="playwright.config.ts"
import { defineConfig } from '@playwright/test';
import type { Options } from './my-test';

export default defineConfig<Options>({
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
});
```

Learn more about [fixtures](../test-fixtures.md) and [parametrizing tests](../test-parameterize.md).

### param: Test.extend.fixtures
* since: v1.10
- `fixtures` <[Object]>

An object containing fixtures and/or options. Learn more about [fixtures format](../test-fixtures.md).




## method: Test.fail
* since: v1.10

Marks a test as "should fail". Playwright runs this test and ensures that it is actually failing. This is useful for documentation purposes to acknowledge that some functionality is broken until it is fixed.

To declare a "failing" test:
* `test.fail(title, body)`
* `test.fail(title, details, body)`

To annotate test as "failing" at runtime:
* `test.fail(condition, description)`
* `test.fail(callback, description)`
* `test.fail()`

**Usage**

You can declare a test as failing, so that Playwright ensures it actually fails.

```js
import { test, expect } from '@playwright/test';

test.fail('not yet ready', async ({ page }) => {
  // ...
});
```

If your test fails in some configurations, but not all, you can mark the test as failing inside the test body based on some condition. We recommend passing a `description` argument in this case.

```js
import { test, expect } from '@playwright/test';

test('fail in WebKit', async ({ page, browserName }) => {
  test.fail(browserName === 'webkit', 'This feature is not implemented for Mac yet');
  // ...
});
```

You can mark all tests in a file or [`method: Test.describe`] group as "should fail" based on some condition with a single `test.fail(callback, description)` call.

```js
import { test, expect } from '@playwright/test';

test.fail(({ browserName }) => browserName === 'webkit', 'not implemented yet');

test('fail in WebKit 1', async ({ page }) => {
  // ...
});
test('fail in WebKit 2', async ({ page }) => {
  // ...
});
```

You can also call `test.fail()` without arguments inside the test body to always mark the test as failed. We recommend declaring a failing test with `test.fail(title, body)` instead.

```js
import { test, expect } from '@playwright/test';

test('less readable', async ({ page }) => {
  test.fail();
  // ...
});
```

### param: Test.fail.title
* since: v1.42
- `title` ?<[string]>

Test title.

### param: Test.fail.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.(call)`] for test details description.

### param: Test.fail.body
* since: v1.42
- `body` ?<[function]\([Fixtures], [TestInfo]\)>

Test body that takes one or two arguments: an object with fixtures and optional [TestInfo].

### param: Test.fail.condition
* since: v1.10
- `condition` ?<[boolean]>

Test is marked as "should fail" when the condition is `true`.

### param: Test.fail.callback
* since: v1.10
- `callback` ?<[function]\([Fixtures]\):[boolean]>

A function that returns whether to mark as "should fail", based on test fixtures. Test or tests are marked as "should fail" when the return value is `true`.

### param: Test.fail.description
* since: v1.10
- `description` ?<[string]>

Optional description that will be reflected in a test report.



## method: Test.fail.only
* since: v1.49

You can use `test.fail.only` to focus on a specific test that is expected to fail. This is particularly useful when debugging a failing test or working on a specific issue.

To declare a focused "failing" test:
* `test.fail.only(title, body)`
* `test.fail.only(title, details, body)`

**Usage**

You can declare a focused failing test, so that Playwright runs only this test and ensures it actually fails.

```js
import { test, expect } from '@playwright/test';

test.fail.only('focused failing test', async ({ page }) => {
  // This test is expected to fail
});
test('not in the focused group', async ({ page }) => {
  // This test will not run
});
```

### param: Test.fail.only.title
* since: v1.49

- `title` ?<[string]>

Test title.

### param: Test.fail.only.details
* since: v1.49

- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.describe`] for test details description.

### param: Test.fail.only.body
* since: v1.49

- `body` ?<[function]\([Fixtures], [TestInfo]\)>

Test body that takes one or two arguments: an object with fixtures and optional [TestInfo].



## method: Test.fixme
* since: v1.10

Mark a test as "fixme", with the intention to fix it. Playwright will not run the test past the `test.fixme()` call.

To declare a "fixme" test:
* `test.fixme(title, body)`
* `test.fixme(title, details, body)`

To annotate test as "fixme" at runtime:
* `test.fixme(condition, description)`
* `test.fixme(callback, description)`
* `test.fixme()`

**Usage**

You can declare a test as to be fixed, and Playwright will not run it.

```js
import { test, expect } from '@playwright/test';

test.fixme('to be fixed', async ({ page }) => {
  // ...
});
```

If your test should be fixed in some configurations, but not all, you can mark the test as "fixme" inside the test body based on some condition. We recommend passing a `description` argument in this case. Playwright will run the test, but abort it immediately after the `test.fixme` call.

```js
import { test, expect } from '@playwright/test';

test('to be fixed in Safari', async ({ page, browserName }) => {
  test.fixme(browserName === 'webkit', 'This feature breaks in Safari for some reason');
  // ...
});
```

You can mark all tests in a file or [`method: Test.describe`] group as "fixme" based on some condition with a single `test.fixme(callback, description)` call.

```js
import { test, expect } from '@playwright/test';

test.fixme(({ browserName }) => browserName === 'webkit', 'Should figure out the issue');

test('to be fixed in Safari 1', async ({ page }) => {
  // ...
});
test('to be fixed in Safari 2', async ({ page }) => {
  // ...
});
```

You can also call `test.fixme()` without arguments inside the test body to always mark the test as failed. We recommend using `test.fixme(title, body)` instead.

```js
import { test, expect } from '@playwright/test';

test('less readable', async ({ page }) => {
  test.fixme();
  // ...
});
```

### param: Test.fixme.title
* since: v1.10
- `title` ?<[string]>

Test title.

### param: Test.fixme.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.(call)`] for test details description.

### param: Test.fixme.body
* since: v1.10
- `body` ?<[function]\([Fixtures], [TestInfo]\)>

Test body that takes one or two arguments: an object with fixtures and optional [TestInfo].

### param: Test.fixme.condition
* since: v1.10
- `condition` ?<[boolean]>

Test is marked as "should fail" when the condition is `true`.

### param: Test.fixme.callback
* since: v1.10
- `callback` ?<[function]\([Fixtures]\):[boolean]>

A function that returns whether to mark as "should fail", based on test fixtures. Test or tests are marked as "should fail" when the return value is `true`.

### param: Test.fixme.description
* since: v1.10
- `description` ?<[string]>

Optional description that will be reflected in a test report.



## method: Test.info
* since: v1.10
- returns: <[TestInfo]>

Returns information about the currently running test. This method can only be called during the test execution, otherwise it throws.

**Usage**

```js
test('example test', async ({ page }) => {
  // ...
  await test.info().attach('screenshot', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });
});
```


## method: Test.only
* since: v1.10

Declares a focused test. If there are some focused tests or suites, all of them will be run but nothing else.

* `test.only(title, body)`
* `test.only(title, details, body)`

**Usage**

```js
test.only('focus this test', async ({ page }) => {
  // Run only focused tests in the entire project.
});
```

### param: Test.only.title
* since: v1.10
- `title` <[string]>

Test title.

### param: Test.only.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.(call)`] for test details description.

### param: Test.only.body
* since: v1.10
- `body` <[function]\([Fixtures], [TestInfo]\)>

Test body that takes one or two arguments: an object with fixtures and optional [TestInfo].


## method: Test.setTimeout
* since: v1.10

Changes the timeout for the test. Zero means no timeout. Learn more about [various timeouts](../test-timeouts.md).

Timeout for the currently running test is available through [`property: TestInfo.timeout`].

**Usage**

* Changing test timeout.

  ```js
  test('very slow test', async ({ page }) => {
    test.setTimeout(120000);
    // ...
  });
  ```

* Changing timeout from a slow `beforeEach` hook. Note that this affects the test timeout that is shared with `beforeEach` hooks.

  ```js
  test.beforeEach(async ({ page }, testInfo) => {
    // Extend timeout for all tests running this hook by 30 seconds.
    test.setTimeout(testInfo.timeout + 30000);
  });
  ```

* Changing timeout for a `beforeAll` or `afterAll` hook. Note this affects the hook's timeout, not the test timeout.

  ```js
  test.beforeAll(async () => {
    // Set timeout for this hook.
    test.setTimeout(60000);
  });
  ```

* Changing timeout for all tests in a [`method: Test.describe`] group.

  ```js
  test.describe('group', () => {
    // Applies to all tests in this group.
    test.describe.configure({ timeout: 60000 });

    test('test one', async () => { /* ... */ });
    test('test two', async () => { /* ... */ });
    test('test three', async () => { /* ... */ });
  });
  ```

### param: Test.setTimeout.timeout
* since: v1.10
- `timeout` <[int]>

Timeout in milliseconds.



## method: Test.skip
* since: v1.10

Skip a test. Playwright will not run the test past the `test.skip()` call.

Skipped tests are not supposed to be ever run. If you intend to fix the test, use [`method: Test.fixme`] instead.

To declare a skipped test:
* `test.skip(title, body)`
* `test.skip(title, details, body)`

To skip a test at runtime:
* `test.skip(condition, description)`
* `test.skip(callback, description)`
* `test.skip()`

**Usage**

You can declare a skipped test, and Playwright will not run it.

```js
import { test, expect } from '@playwright/test';

test.skip('never run', async ({ page }) => {
  // ...
});
```

If your test should be skipped in some configurations, but not all, you can skip the test inside the test body based on some condition. We recommend passing a `description` argument in this case. Playwright will run the test, but abort it immediately after the `test.skip` call.

```js
import { test, expect } from '@playwright/test';

test('Safari-only test', async ({ page, browserName }) => {
  test.skip(browserName !== 'webkit', 'This feature is Safari-only');
  // ...
});
```

You can skip all tests in a file or [`method: Test.describe`] group based on some condition with a single `test.skip(callback, description)` call.

```js
import { test, expect } from '@playwright/test';

test.skip(({ browserName }) => browserName !== 'webkit', 'Safari-only');

test('Safari-only test 1', async ({ page }) => {
  // ...
});
test('Safari-only test 2', async ({ page }) => {
  // ...
});
```

You can also call `test.skip()` without arguments inside the test body to always mark the test as failed. We recommend using `test.skip(title, body)` instead.

```js
import { test, expect } from '@playwright/test';

test('less readable', async ({ page }) => {
  test.skip();
  // ...
});
```

### param: Test.skip.title
* since: v1.10
- `title` ?<[string]>

Test title.

### param: Test.skip.details
* since: v1.42
- `details` ?<[Object]>
  - `tag` ?<[string]|[Array]<[string]>>
  - `annotation` ?<[Object]|[Array]<[Object]>>
    - `type` <[string]>
    - `description` ?<[string]>

See [`method: Test.(call)`] for test details description.

### param: Test.skip.body
* since: v1.10
- `body` ?<[function]\([Fixtures], [TestInfo]\)>

Test body that takes one or two arguments: an object with fixtures and optional [TestInfo].

### param: Test.skip.condition
* since: v1.10
- `condition` ?<[boolean]>

Test is marked as "should fail" when the condition is `true`.

### param: Test.skip.callback
* since: v1.10
- `callback` ?<[function]\([Fixtures]\):[boolean]>

A function that returns whether to mark as "should fail", based on test fixtures. Test or tests are marked as "should fail" when the return value is `true`.

### param: Test.skip.description
* since: v1.10
- `description` ?<[string]>

Optional description that will be reflected in a test report.





## method: Test.slow
* since: v1.10

Marks a test as "slow". Slow test will be given triple the default timeout.

Note that [`method: Test.slow`] cannot be used in a `beforeAll` or `afterAll` hook. Use [`method: Test.setTimeout`] instead.

* `test.slow()`
* `test.slow(condition, description)`
* `test.slow(callback, description)`

**Usage**

You can mark a test as slow by calling `test.slow()` inside the test body.

```js
import { test, expect } from '@playwright/test';

test('slow test', async ({ page }) => {
  test.slow();
  // ...
});
```

If your test is slow in some configurations, but not all, you can mark it as slow based on a condition. We recommend passing a `description` argument in this case.

```js
import { test, expect } from '@playwright/test';

test('slow in Safari', async ({ page, browserName }) => {
  test.slow(browserName === 'webkit', 'This feature is slow in Safari');
  // ...
});
```

You can mark all tests in a file or [`method: Test.describe`] group as "slow" based on some condition by passing a callback.

```js
import { test, expect } from '@playwright/test';

test.slow(({ browserName }) => browserName === 'webkit', 'all tests are slow in Safari');

test('slow in Safari 1', async ({ page }) => {
  // ...
});
test('fail in Safari 2', async ({ page }) => {
  // ...
});
```

### param: Test.slow.condition
* since: v1.10
- `condition` ?<[boolean]>

Test is marked as "slow" when the condition is `true`.

### param: Test.slow.callback
* since: v1.10
- `callback` ?<[function]\([Fixtures]\):[boolean]>

A function that returns whether to mark as "slow", based on test fixtures. Test or tests are marked as "slow" when the return value is `true`.

### param: Test.slow.description
* since: v1.10
- `description` ?<[string]>

Optional description that will be reflected in a test report.



## async method: Test.step
* since: v1.10
- returns: <[any]>

Declares a test step that is shown in the report.

**Usage**

```js
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await test.step('Log in', async () => {
    // ...
  });

  await test.step('Outer step', async () => {
    // ...
    // You can nest steps inside each other.
    await test.step('Inner step', async () => {
      // ...
    });
  });
});
```

**Details**

The method returns the value returned by the step callback.

```js
import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  const user = await test.step('Log in', async () => {
    // ...
    return 'john';
  });
  expect(user).toBe('john');
});
```

**Decorator**

You can use TypeScript method decorators to turn a method into a step.
Each call to the decorated method will show up as a step in the report.

```js
function step(target: Function, context: ClassMethodDecoratorContext) {
  return function replacementMethod(...args: any) {
    const name = this.constructor.name + '.' + (context.name as string);
    return test.step(name, async () => {
      return await target.call(this, ...args);
    });
  };
}

class LoginPage {
  constructor(readonly page: Page) {}

  @step
  async login() {
    const account = { username: 'Alice', password: 's3cr3t' };
    await this.page.getByLabel('Username or email address').fill(account.username);
    await this.page.getByLabel('Password').fill(account.password);
    await this.page.getByRole('button', { name: 'Sign in' }).click();
    await expect(this.page.getByRole('button', { name: 'View profile and more' })).toBeVisible();
  }
}

test('example', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login();
});
```

**Boxing**

When something inside a step fails, you would usually see the error pointing to the exact action that failed. For example, consider the following login step:

```js
async function login(page) {
  await test.step('login', async () => {
    const account = { username: 'Alice', password: 's3cr3t' };
    await page.getByLabel('Username or email address').fill(account.username);
    await page.getByLabel('Password').fill(account.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'View profile and more' })).toBeVisible();
  });
}

test('example', async ({ page }) => {
  await page.goto('https://github.com/login');
  await login(page);
});
```

```txt
Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
  ... error details omitted ...

   8 |     await page.getByRole('button', { name: 'Sign in' }).click();
>  9 |     await expect(page.getByRole('button', { name: 'View profile and more' })).toBeVisible();
     |                                                                               ^
  10 |   });
```

As we see above, the test may fail with an error pointing inside the step. If you would like the error to highlight the "login" step instead of its internals, use the `box` option. An error inside a boxed step points to the step call site.

```js
async function login(page) {
  await test.step('login', async () => {
    // ...
  }, { box: true });  // Note the "box" option here.
}
```

```txt
Error: Timed out 5000ms waiting for expect(locator).toBeVisible()
  ... error details omitted ...

  14 |   await page.goto('https://github.com/login');
> 15 |   await login(page);
     |         ^
  16 | });
```

You can also create a TypeScript decorator for a boxed step, similar to a regular step decorator above:

```js
function boxedStep(target: Function, context: ClassMethodDecoratorContext) {
  return function replacementMethod(...args: any) {
    const name = this.constructor.name + '.' + (context.name as string);
    return test.step(name, async () => {
      return await target.call(this, ...args);
    }, { box: true });  // Note the "box" option here.
  };
}

class LoginPage {
  constructor(readonly page: Page) {}

  @boxedStep
  async login() {
    // ....
  }
}

test('example', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login();  // <-- Error will be reported on this line.
});
```

### param: Test.step.title
* since: v1.10
- `title` <[string]>

Step name.


### param: Test.step.body
* since: v1.10
- `body` <[function]\([TestStepInfo]\):[Promise]<[any]>>

Step body.

### option: Test.step.box
* since: v1.39
- `box` <boolean>

Whether to box the step in the report. Defaults to `false`. When the step is boxed, errors thrown from the step internals point to the step call site. See below for more details.

### option: Test.step.location
* since: v1.48
- `location` <[Location]>

Specifies a custom location for the step to be shown in test reports and trace viewer. By default, location of the [`method: Test.step`] call is shown.

## async method: Test.step.skip
* since: v1.50
- returns: <[void]>

Mark a test step as "skip" to temporarily disable its execution, useful for steps that are currently failing and planned for a near-term fix. Playwright will not run the step. See also [`method: TestStepInfo.skip#2`].

We recommend [`method: TestStepInfo.skip#1`] instead.

**Usage**

You can declare a skipped step, and Playwright will not run it.

```js
import { test, expect } from '@playwright/test';

test('my test', async ({ page }) => {
  // ...
  await test.step.skip('not yet ready', async () => {
    // ...
  });
});
```

### param: Test.step.skip.title
* since: v1.50
- `title` <[string]>

Step name.

### param: Test.step.skip.body
* since: v1.50
- `body` <[function]\(\):[Promise]<[any]>>

Step body.

### option: Test.step.skip.box
* since: v1.50
- `box` <boolean>

Whether to box the step in the report. Defaults to `false`. When the step is boxed, errors thrown from the step internals point to the step call site. See below for more details.

### option: Test.step.skip.location
* since: v1.50
- `location` <[Location]>

Specifies a custom location for the step to be shown in test reports and trace viewer. By default, location of the [`method: Test.step`] call is shown.

### option: Test.step.skip.timeout
* since: v1.50
- `timeout` <[float]>

Maximum time in milliseconds for the step to finish. Defaults to `0` (no timeout).

### option: Test.step.timeout
* since: v1.50
- `timeout` <[float]>

The maximum time, in milliseconds, allowed for the step to complete. If the step does not complete within the specified timeout, the [`method: Test.step`] method will throw a [TimeoutError]. Defaults to `0` (no timeout).

## method: Test.use
* since: v1.10

Specifies options or fixtures to use in a single test file or a [`method: Test.describe`] group. Most useful to set an option, for example set `locale` to configure `context` fixture.

**Usage**

```js
import { test, expect } from '@playwright/test';

test.use({ locale: 'en-US' });

test('test with locale', async ({ page }) => {
  // Default context and page have locale as specified
});
```

**Details**

`test.use` can be called either in the global scope or inside `test.describe`. It is an error to call it within `beforeEach` or `beforeAll`.

It is also possible to override a fixture by providing a function.

```js
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
* since: v1.10
- `options` <[TestOptions]>

An object with local options.


