---
id: test-fixtures
title: "Advanced: fixtures"
---

<!-- TOC -->

## Introduction to fixtures

Playwright Test is based on the concept of the test fixtures. Test fixtures are used to establish environment for each test, giving the test everything it needs and nothing else. Test fixtures are isolated between tests, which gives Playwright Test following benefits:
- Playwright Test runs tests in parallel by default, making your test suite much faster.
- Playwright Test can efficiently retry the flaky failures, instead of re-running the whole suite.
- You can group tests based on their meaning, instead of their common setup.

Here is how typical test environment setup differs between traditional test style and the fixture-based one. We assume a `TodoPage` class that helps interacting with a "todo list" page of the web app.

### Without fixtures

```js
// todo.spec.js
const { test } = require('@playwright/test');
const { TodoPage } = require('./todo-page');

test.describe('todo tests', () => {
  let todoPage;

  test.beforeEach(async ({ page }) => {
    todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo('item1');
    await todoPage.addToDo('item2');
  });

  test.afterEach(async () => {
    await todoPage.removeAll();
  });

  test('should add an item', async () => {
    await todoPage.addToDo('my item');
    // ...
  });

  test('should remove an item', async () => {
    await todoPage.remove('item1');
    // ...
  });
});
```

### With fixtures

```js js-flavor=js
// todo.spec.js
const base = require('@playwright/test');
const { TodoPage } = require('./todo-page');

// Extend basic test by providing a "todoPage" fixture.
const test = base.test.extend({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo('item1');
    await todoPage.addToDo('item2');
    await use(todoPage);
    await todoPage.removeAll();
  },
});

test('should add an item', async ({ todoPage }) => {
  await todoPage.addToDo('my item');
  // ...
});

test('should remove an item', async ({ todoPage }) => {
  await todoPage.remove('item1');
  // ...
});
```

```js js-flavor=ts
// example.spec.ts
import { test as base } from '@playwright/test';
import { TodoPage } from './todo-page';

// Extend basic test by providing a "table" fixture.
const test = base.extend<{ todoPage: TodoPage }>({
  todoPage: async ({ page }, use) => {
    const todoPage = new TodoPage(page);
    await todoPage.goto();
    await todoPage.addToDo('item1');
    await todoPage.addToDo('item2');
    await use(todoPage);
    await todoPage.removeAll();
  },
});

test('should add an item', async ({ todoPage }) => {
  await todoPage.addToDo('my item');
  // ...
});

test('should remove an item', async ({ todoPage }) => {
  await todoPage.remove('item1');
  // ...
});
```

You declare exact fixtures that the test needs and the runner initializes them for each test individually. Tests can use any combinations of the fixtures to tailor precise environment they need. You no longer need to wrap tests in `describe`s that set up environment, everything is declarative and typed.

There are two types of fixtures: `test` and `worker`. Test fixtures are set up for each test and worker fixtures are set up for each process that runs test files.

## Test fixtures

Test fixtures are set up for each test. Consider the following test file:

```js js-flavor=js
// hello.spec.js
const test = require('./hello');

test('hello', ({ hello }) => {
  test.expect(hello).toBe('Hello');
});

test('hello world', ({ helloWorld }) => {
  test.expect(helloWorld).toBe('Hello, world!');
});
```

```js js-flavor=ts
// hello.spec.ts
import test from './hello';

test('hello', ({ hello }) => {
  test.expect(hello).toBe('Hello');
});

test('hello world', ({ helloWorld }) => {
  test.expect(helloWorld).toBe('Hello, world!');
});
```

It uses fixtures `hello` and `helloWorld` that are set up by the framework for each test run.

Here is how test fixtures are declared and defined. Fixtures can use other fixtures - note how `helloWorld` uses `hello`.

```js js-flavor=js
// hello.js
const base = require('@playwright/test');

// Extend base test with fixtures "hello" and "helloWorld".
// This new "test" can be used in multiple test files, and each of them will get the fixtures.
module.exports = base.test.extend({
  // This fixture is a constant, so we can just provide the value.
  hello: 'Hello',

  // This fixture has some complex logic and is defined with a function.
  helloWorld: async ({ hello }, use) => {
    // Set up the fixture.
    const value = hello + ', world!';

    // Use the fixture value in the test.
    await use(value);

    // Clean up the fixture. Nothing to cleanup in this example.
  },
});
```

```js js-flavor=ts
// hello.ts
import { test as base } from '@playwright/test';

// Define test fixtures "hello" and "helloWorld".
type TestFixtures = {
  hello: string;
  helloWorld: string;
};

// Extend base test with our fixtures.
const test = base.extend<TestFixtures>({
  // This fixture is a constant, so we can just provide the value.
  hello: 'Hello',

  // This fixture has some complex logic and is defined with a function.
  helloWorld: async ({ hello }, use) => {
    // Set up the fixture.
    const value = hello + ', world!';

    // Use the fixture value in the test.
    await use(value);

    // Clean up the fixture. Nothing to cleanup in this example.
  },
});

// Now, this "test" can be used in multiple test files, and each of them will get the fixtures.
export default test;
```

With fixtures, test organization becomes flexible - you can put tests that make sense next to each other based on what they test, not based on the environment they need.

## Worker fixtures

Playwright Test uses worker processes to run test files. You can specify the maximum number of workers using `--workers` command line option. Similarly to how test fixtures are set up for individual test runs, worker fixtures are set up for each worker process. That's where you can set up services, run servers, etc. Playwright Test will reuse the worker process for as many test files as it can, provided their worker fixtures match and hence environments are identical.

Here is how the test looks:
```js js-flavor=js
// express.spec.js
const test = require('./express-test');
const fetch = require('node-fetch');

test('fetch 1', async ({ port }) => {
  const result = await fetch(`http://localhost:${port}/1`);
  test.expect(await result.text()).toBe('Hello World 1!');
});

test('fetch 2', async ({ port }) => {
  const result = await fetch(`http://localhost:${port}/2`);
  test.expect(await result.text()).toBe('Hello World 2!');
});
```

```js js-flavor=ts
// express.spec.ts
import test from './express-test';
import fetch from 'node-fetch';

test('fetch 1', async ({ port }) => {
  const result = await fetch(`http://localhost:${port}/1`);
  test.expect(await result.text()).toBe('Hello World 1!');
});

test('fetch 2', async ({ port }) => {
  const result = await fetch(`http://localhost:${port}/2`);
  test.expect(await result.text()).toBe('Hello World 2!');
});
```

And here is how fixtures are declared and defined:
```js js-flavor=js
// express-test.js
const base = require('@playwright/test');
const express = require('express');

// Define "port" and "express" worker fixtures.
module.exports = base.test.extend({

  // We pass a tuple to specify fixtures options.
  // In this case, we mark this fixture as worker-scoped.
  port: [ async ({}, use, workerInfo) => {
    // "port" fixture uses a unique value of the worker process index.
    await use(3000 + workerInfo.workerIndex);
  }, { scope: 'worker' } ],

  // "express" fixture starts automatically for every worker - we pass "auto" for that.
  express: [ async ({ port }, use) => {
    // Setup express app.
    const app = express();
    app.get('/1', (req, res) => {
      res.send('Hello World 1!')
    });
    app.get('/2', (req, res) => {
      res.send('Hello World 2!')
    });

    // Start the server.
    let server;
    console.log('Starting server...');
    await new Promise(f => {
      server = app.listen(port, f);
    });
    console.log('Server ready');

    // Use the server in the tests.
    await use(server);

    // Cleanup.
    console.log('Stopping server...');
    await new Promise(f => server.close(f));
    console.log('Server stopped');
  }, { scope: 'worker', auto: true } ],
});
```

```js js-flavor=ts
// express-test.ts
import { test as base } from '@playwright/test';
import express from 'express';
import type { Express } from 'express';

// Declare worker fixtures.
type ExpressWorkerFixtures = {
  port: number;
  express: Express;
};

// Note that we did not provide an test-scoped fixtures, so we pass {}.
const test = base.extend<{}, ExpressWorkerFixtures>({

  // We pass a tuple to specify fixtures options.
  // In this case, we mark this fixture as worker-scoped.
  port: [ async ({}, use, workerInfo) => {
    // "port" fixture uses a unique value of the worker process index.
    await use(3000 + workerInfo.workerIndex);
  }, { scope: 'worker' } ],

  // "express" fixture starts automatically for every worker - we pass "auto" for that.
  express: [ async ({ port }, use) => {
    // Setup express app.
    const app = express();
    app.get('/1', (req, res) => {
      res.send('Hello World 1!')
    });
    app.get('/2', (req, res) => {
      res.send('Hello World 2!')
    });

    // Start the server.
    let server;
    console.log('Starting server...');
    await new Promise(f => {
      server = app.listen(port, f);
    });
    console.log('Server ready');

    // Use the server in the tests.
    await use(server);

    // Cleanup.
    console.log('Stopping server...');
    await new Promise(f => server.close(f));
    console.log('Server stopped');
  }, { scope: 'worker', auto: true } ],
});

export default test;
```
