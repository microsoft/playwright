# class: Reporter
* since: v1.10
* langs: js

Test runner notifies the reporter about various events during test execution. All methods of the reporter are optional.

You can create a custom reporter by implementing a class with some of the reporter methods. Make sure to export this class as default.

```js tab=js-js
// my-awesome-reporter.js
// @ts-check

/** @implements {import('@playwright/test/reporter').Reporter} */
class MyReporter {
  constructor(options) {
    console.log(`my-awesome-reporter setup with customOption set to ${options.customOption}`);
  }

  onBegin(config, suite) {
    console.log(`Starting the run with ${suite.allTests().length} tests`);
  }

  onTestBegin(test) {
    console.log(`Starting test ${test.title}`);
  }

  onTestEnd(test, result) {
    console.log(`Finished test ${test.title}: ${result.status}`);
  }

  onEnd(result) {
    console.log(`Finished the run: ${result.status}`);
  }
}

module.exports = MyReporter;
```

```js tab=js-ts
// my-awesome-reporter.ts
import { Reporter, FullConfig, Suite, TestCase, TestResult, FullResult } from '@playwright/test/reporter';

class MyReporter implements Reporter {
  constructor(options: {customOption: { customOption?: string } = {}) {
    console.log(`my-awesome-reporter setup with customOption set to ${options.customOption}`);
  }

  onBegin(config: FullConfig, suite: Suite) {
    console.log(`Starting the run with ${suite.allTests().length} tests`);
  }

  onTestBegin(test: TestCase) {
    console.log(`Starting test ${test.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    console.log(`Finished test ${test.title}: ${result.status}`);
  }

  onEnd(result: FullResult) {
    console.log(`Finished the run: ${result.status}`);
  }
}
export default MyReporter;
```

Now use this reporter with [`property: TestConfig.reporter`]. Learn more about [using reporters](../test-reporters.md).

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: ['./my-awesome-reporter.js', { customOption: 'some value' }],
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: ['./my-awesome-reporter.ts', { customOption: 'some value' }],
});
```

Here is a typical order of reporter calls:
* [`method: Reporter.onBegin`] is called once with a root suite that contains all other suites and tests. Learn more about [suites hierarchy][Suite].
* [`method: Reporter.onTestBegin`] is called for each test run. It is given a [TestCase] that is executed, and a [TestResult] that is almost empty. Test result will be populated while the test runs (for example, with steps and stdio) and will get final `status` once the test finishes.
* [`method: Reporter.onStepBegin`] and [`method: Reporter.onStepEnd`] are called for each executed step inside the test. When steps are executed, test run has not finished yet.
* [`method: Reporter.onTestEnd`] is called when test run has finished. By this time, [TestResult] is complete and you can use [`property: TestResult.status`], [`property: TestResult.error`] and more.
* [`method: Reporter.onEnd`] is called once after all tests that should run had finished.

Additionally, [`method: Reporter.onStdOut`] and [`method: Reporter.onStdErr`] are called when standard output is produced in the worker process, possibly during a test execution,
and [`method: Reporter.onError`] is called when something went wrong outside of the test execution.

If your custom reporter does not print anything to the terminal, implement [`method: Reporter.printsToStdio`] and return `false`. This way, Playwright will use one of the standard terminal reporters in addition to your custom reporter to enhance user experience.

## optional method: Reporter.onBegin
* since: v1.10

Called once before running tests. All tests have been already discovered and put into a hierarchy of [Suite]s.

### param: Reporter.onBegin.config
* since: v1.10
- `config` <[TestConfig]>

Resolved configuration.

### param: Reporter.onBegin.suite
* since: v1.10
- `suite` <[Suite]>

The root suite that contains all projects, files and test cases.

## optional async method: Reporter.onEnd
* since: v1.10

Called after all tests has been run, or testing has been interrupted. Note that this method may return a [Promise] and Playwright Test will await it.

### param: Reporter.onEnd.result
* since: v1.10
- `result` <[Object]>
  - `status` <[FullStatus]<"passed"|"failed"|"timedout"|"interrupted">>

Result of the full test run.
* `'passed'` - Everything went as expected.
* `'failed'` - Any test has failed.
* `'timedout'` - The [`property: TestConfig.globalTimeout`] has been reached.
* `'interrupted'` - Interrupted by the user.

## optional method: Reporter.onError
* since: v1.10

Called on some global error, for example unhandled exception in the worker process.

### param: Reporter.onError.error
* since: v1.10
- `error` <[TestError]>

The error.


## optional method: Reporter.onStdErr
* since: v1.10

Called when something has been written to the standard error in the worker process.

### param: Reporter.onStdErr.chunk
* since: v1.10
- `chunk` <[string]|[Buffer]>

Output chunk.

### param: Reporter.onStdErr.test
* since: v1.10
- `test` <[void]|[TestCase]>

Test that was running. Note that output may happen when no test is running, in which case this will be [void].

### param: Reporter.onStdErr.result
* since: v1.10
- `result` <[void]|[TestResult]>

Result of the test run, this object gets populated while the test runs.


## optional method: Reporter.onStdOut
* since: v1.10

Called when something has been written to the standard output in the worker process.

### param: Reporter.onStdOut.chunk
* since: v1.10
- `chunk` <[string]|[Buffer]>

Output chunk.

### param: Reporter.onStdOut.test
* since: v1.10
- `test` <[void]|[TestCase]>

Test that was running. Note that output may happen when no test is running, in which case this will be [void].

### param: Reporter.onStdOut.result
* since: v1.10
- `result` <[void]|[TestResult]>

Result of the test run, this object gets populated while the test runs.

## optional method: Reporter.onStepBegin
* since: v1.10

Called when a test step started in the worker process.

### param: Reporter.onStepBegin.test
* since: v1.10
- `test` <[TestCase]>

Test that the step belongs to.

### param: Reporter.onStepBegin.result
* since: v1.10
- `result` <[TestResult]>

Result of the test run, this object gets populated while the test runs.

### param: Reporter.onStepBegin.step
* since: v1.10
- `step` <[TestStep]>

Test step instance that has started.

## optional method: Reporter.onStepEnd
* since: v1.10

Called when a test step finished in the worker process.

### param: Reporter.onStepEnd.test
* since: v1.10
- `test` <[TestCase]>

Test that the step belongs to.

### param: Reporter.onStepEnd.result
* since: v1.10
- `result` <[TestResult]>

Result of the test run.

### param: Reporter.onStepEnd.step
* since: v1.10
- `step` <[TestStep]>

Test step instance that has finished.

## optional method: Reporter.onTestBegin
* since: v1.10

Called after a test has been started in the worker process.

### param: Reporter.onTestBegin.test
* since: v1.10
- `test` <[TestCase]>

Test that has been started.

### param: Reporter.onTestBegin.result
* since: v1.10
- `result` <[TestResult]>

Result of the test run, this object gets populated while the test runs.


## optional method: Reporter.onTestEnd
* since: v1.10

Called after a test has been finished in the worker process.

### param: Reporter.onTestEnd.test
* since: v1.10
- `test` <[TestCase]>

Test that has been finished.

### param: Reporter.onTestEnd.result
* since: v1.10
- `result` <[TestResult]>

Result of the test run.


## optional method: Reporter.printsToStdio
* since: v1.10
- returns: <[boolean]>

Whether this reporter uses stdio for reporting. When it does not, Playwright Test could add some output to enhance user experience. If your reporter does not print to the terminal, it is strongly recommended to return `false`.
