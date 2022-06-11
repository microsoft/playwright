# class: Reporter
* langs: js

Test runner notifies the reporter about various events during test execution. All methods of the reporter are optional.

You can create a custom reporter by implementing a class with some of the reporter methods. Make sure to export this class as default.

```js tab=js-js
// my-awesome-reporter.js
// @ts-check

/** @implements {import('@playwright/test/reporter').Reporter} */
class MyReporter {
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
import { Reporter } from '@playwright/test/reporter';

class MyReporter implements Reporter {
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
export default MyReporter;
```

Now use this reporter with [`property: TestConfig.reporter`]. Learn more about [using reporters](../test-reporters.md).

```js tab=js-js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: './my-awesome-reporter.js',
};

module.exports = config;
```

```js tab=js-ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: './my-awesome-reporter.ts',
};
export default config;
```

Here is a typical order of reporter calls:
* [`method: Reporter.onBegin`] is called once with a root suite that contains all other suites and tests. Learn more about [suites hierarchy][Suite].
* [`method: Reporter.onTestBegin`] is called for each test run. It is given a [TestCase] that is executed, and a [TestResult] that is almost empty. Test result will be populated while the test runs (for example, with steps and stdio) and will get final `status` once the test finishes.
* [`method: Reporter.onStepBegin`] and [`method: Reporter.onStepEnd`] are called for each executed step inside the test. When steps are executed, test run has not finished yet.
* [`method: Reporter.onTestEnd`] is called when test run has finished. By this time, [TestResult] is complete and you can use [`property: TestResult.status`], [`property: TestResult.error`] and more.
* [`method: Reporter.onEnd`] is called once after all tests that should run had finished.

Additionally, [`method: Reporter.onStdOut`] and [`method: Reporter.onStdErr`] are called when standard output is produced in the worker process, possibly during a test execution,
and [`method: Reporter.onError`] is called when something went wrong outside of the test execution.

## optional method: Reporter.onBegin

Called once before running tests. All tests have been already discovered and put into a hierarchy of [Suite]s.

### param: Reporter.onBegin.config
- `config` <[TestConfig]>

Resolved configuration.

### param: Reporter.onBegin.suite
- `suite` <[Suite]>

The root suite that contains all projects, files and test cases.



## optional async method: Reporter.onEnd

Called after all tests has been run, or testing has been interrupted. Note that this method may return a [Promise] and Playwright Test will await it.

### param: Reporter.onEnd.result
- `result` <[Object]>
  - `status` <[FullStatus]<"passed"|"failed"|"timedout"|"interrupted">>

Result of the full test run.
* `'passed'` - Everything went as expected.
* `'failed'` - Any test has failed.
* `'timedout'` - The [`property: TestConfig.globalTimeout`] has been reached.
* `'interrupted'` - Interrupted by the user.




## optional method: Reporter.onError

Called on some global error, for example unhandled exception in the worker process.

### param: Reporter.onError.error
- `error` <[TestError]>

The error.


## optional method: Reporter.onStdErr

Called when something has been written to the standard error in the worker process.

### param: Reporter.onStdErr.chunk
- `chunk` <[string]|[Buffer]>

Output chunk.

### param: Reporter.onStdErr.test
- `test` <[void]|[TestCase]>

Test that was running. Note that output may happen when no test is running, in which case this will be [void].

### param: Reporter.onStdErr.result
- `result` <[void]|[TestResult]>

Result of the test run, this object gets populated while the test runs.


## optional method: Reporter.onStdOut

Called when something has been written to the standard output in the worker process.

### param: Reporter.onStdOut.chunk
- `chunk` <[string]|[Buffer]>

Output chunk.

### param: Reporter.onStdOut.test
- `test` <[void]|[TestCase]>

Test that was running. Note that output may happen when no test is running, in which case this will be [void].

### param: Reporter.onStdOut.result
- `result` <[void]|[TestResult]>

Result of the test run, this object gets populated while the test runs.

## optional method: Reporter.onStepBegin

Called when a test step started in the worker process.

### param: Reporter.onStepBegin.test
- `test` <[TestCase]>

Test that the step belongs to.

### param: Reporter.onStepBegin.result
- `result` <[TestResult]>

Result of the test run, this object gets populated while the test runs.

### param: Reporter.onStepBegin.step
- `step` <[TestStep]>

Test step instance that has started.

## optional method: Reporter.onStepEnd

Called when a test step finished in the worker process.

### param: Reporter.onStepEnd.test
- `test` <[TestCase]>

Test that the step belongs to.

### param: Reporter.onStepEnd.result
- `result` <[TestResult]>

Result of the test run.

### param: Reporter.onStepEnd.step
- `step` <[TestStep]>

Test step instance that has finished.

## optional method: Reporter.onTestBegin

Called after a test has been started in the worker process.

### param: Reporter.onTestBegin.test
- `test` <[TestCase]>

Test that has been started.

### param: Reporter.onTestBegin.result
- `result` <[TestResult]>

Result of the test run, this object gets populated while the test runs.


## optional method: Reporter.onTestEnd

Called after a test has been finished in the worker process.

### param: Reporter.onTestEnd.test
- `test` <[TestCase]>

Test that has been finished.

### param: Reporter.onTestEnd.result
- `result` <[TestResult]>

Result of the test run.


## optional method: Reporter.printsToStdio
- returns: <[boolean]>

Whether this reporter uses stdio for reporting. When it does not, Playwright Test could add some output to enhance user experience.
