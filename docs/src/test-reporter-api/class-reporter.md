# class: Reporter
* langs: js

Test runner notifies the reporter about various events during test execution. All methods of the reporter are optional.

You can create a custom reporter my implementing a class with some of the reporter methods. Make sure to export this class as default.

```js js-flavor=js
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

```js js-flavor=ts
// playwright.config.ts
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

Now use this reporter with [`property: TestConfig.reporter`].

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: './my-awesome-reporter.js',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: './my-awesome-reporter.ts',
};
export default config;
```

Learn more about [reporters](./test-reporters.md).

## method: Reporter.onBegin

Called once before running tests. All tests have been already discovered and put into a hierarchy of [Suite]s.

### param: Reporter.onBegin.config
- `config` <[TestConfig]>

Resolved configuration.

### param: Reporter.onBegin.suite
- `suite` <[Suite]>

The root suite that contains all projects, files and test cases.



## async method: Reporter.onEnd

Called after all tests has been run, or testing has been interrupted. Note that this method may return a [Promise] and Playwright Test will await it.

### param: Reporter.onEnd.result
- `result` <[Object]>
  - `status` <[FullStatus]<"passed"|"failed"|"timedout"|"interrupted">>

Result of the full test run.
* `'passed'` - Everything went as expected.
* `'failed'` - Any test has failed.
* `'timedout'` - The [`property: TestConfig.globalTimeout`] has been reached.
* `'interrupted'` - Interrupted by the user.




## method: Reporter.onError

Called on some global error, for example unhandled exception in the worker process.

### param: Reporter.onError.error
- `error` <[TestError]>

The error.


## method: Reporter.onStdErr

Called when something has been written to the standard error in the worker process.

### param: Reporter.onStdErr.chunk
- `chunk` <[string]|[Buffer]>

Output chunk.

### param: Reporter.onStdErr.test
- `test` <[void]|[TestCase]>

Test that was running. Note that output may happen when to test is running, in which case this will be [void].



## method: Reporter.onStdOut

Called when something has been written to the standard output in the worker process.

### param: Reporter.onStdOut.chunk
- `chunk` <[string]|[Buffer]>

Output chunk.

### param: Reporter.onStdOut.test
- `test` <[void]|[TestCase]>

Test that was running. Note that output may happen when to test is running, in which case this will be [void].



## method: Reporter.onTestBegin

Called after a test has been started in the worker process.

### param: Reporter.onTestBegin.test
- `test` <[TestCase]>

Test that has been started.



## method: Reporter.onTestEnd

Called after a test has been finished in the worker process.

### param: Reporter.onTestEnd.test
- `test` <[TestCase]>

Test that has been finished.

### param: Reporter.onTestEnd.result
- `result` <[TestResult]>

Result of the test run.
