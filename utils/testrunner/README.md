# TestRunner

This test runner is used internally by Playwright to test Playwright itself.

- testrunner is a *library*: tests are `node.js` scripts
- parallel wrt IO operations
- supports async/await
- modular
- well-isolated state per execution thread

### Example

Save the following as `test.js` and run using `node`:

```sh
node test.js
```

```js
const {TestRunner, Reporter, Matchers} = require('.');

// Runner holds and runs all the tests
const runner = new TestRunner({
  parallel: 2, // run 2 parallel threads
  timeout: 1000, // setup timeout of 1 second per test
});
// Simple expect-like matchers
const {expect} = new Matchers();

// Extract jasmine-like DSL into the global namespace
const {describe, xdescribe, fdescribe} = runner;
const {it, fit, xit} = runner;
const {beforeAll, beforeEach, afterAll, afterEach} = runner;

// Test hooks can be async.
beforeAll(async state => {
  state.parallelIndex; // either 0 or 1 in this example, depending on the executing thread
  state.foo = 'bar'; // set state for every test
});

describe('math', () => {
  it('to be sane', async (state, test) => {
    state.parallelIndex; // Very first test will always be ran by the 0's thread
    state.foo; // this will be 'bar'
    expect(2 + 2).toBe(4);
  });
});

// Reporter subscribes to TestRunner events and displays information in terminal
const reporter = new Reporter(runner);

// Run all tests.
runner.run();
```

