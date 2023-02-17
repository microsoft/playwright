---
id: test-reporters
title: "Reporters"
---

Playwright Test comes with a few built-in reporters for different needs and ability to provide custom reporters. The easiest way to try out built-in reporters is to pass `--reporter` [command line option](./test-cli.md).


```bash
npx playwright test --reporter=line
```

For more control, you can specify reporters programmatically in the [configuration file](./test-configuration.md).

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: 'line',
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: 'line',
});
```

### Multiple reporters

You can use multiple reporters at the same time. For example  you can use `'list'` for nice terminal output and `'json'` to get a comprehensive json file with the test results.

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: [
    ['list'],
    ['json', {  outputFile: 'test-results.json' }]
  ],
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [
    ['list'],
    ['json', {  outputFile: 'test-results.json' }]
  ],
});
```

### Reporters on CI

You can use different reporters locally and on CI. For example, using concise `'dot'` reporter avoids too much output. This is the default on CI.

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  // Concise 'dot' for CI, default 'list' when running locally
  reporter: process.env.CI ? 'dot' : 'list',
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Concise 'dot' for CI, default 'list' when running locally
  reporter: process.env.CI ? 'dot' : 'list',
});
```

## Built-in reporters

All built-in reporters show detailed information about failures, and mostly differ in verbosity for successful runs.

### List reporter

List reporter is default (except on CI where the `dot` reporter is default). It prints a line for each test being run.

```bash
npx playwright test --reporter=list
```

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: 'list',
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: 'list',
});
```

Here is an example output in the middle of a test run. Failures will be listed at the end.
```bash
npx playwright test --reporter=list
Running 124 tests using 6 workers

 1  ✓ should access error in env (438ms)
 2  ✓ handle long test names (515ms)
 3  x 1) render expected (691ms)
 4  ✓ should timeout (932ms)
 5    should repeat each:
 6  ✓ should respect enclosing .gitignore (569ms)
 7    should teardown env after timeout:
 8    should respect excluded tests:
 9  ✓ should handle env beforeEach error (638ms)
10    should respect enclosing .gitignore:
```

You can opt into the step rendering via passing the following config option:

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: [['list', { printSteps: true }]],
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['list', { printSteps: true }]],
});
```

### Line reporter

Line reporter is more concise than the list reporter. It uses a single line to report last finished test, and prints failures when they occur. Line reporter is useful for large test suites where it shows the progress but does not spam the output by listing all the tests.

```bash
npx playwright test --reporter=line
```

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: 'line',
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: 'line',
});
```

Here is an example output in the middle of a test run. Failures are reported inline.
```bash
npx playwright test --reporter=line
Running 124 tests using 6 workers
  1) dot-reporter.spec.ts:20:1 › render expected ===================================================

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 0

[23/124] gitignore.spec.ts - should respect nested .gitignore
```

### Dot reporter

Dot reporter is very concise - it only produces a single character per successful test run. It is the default on CI and useful where you don't want a lot of output.

```bash
npx playwright test --reporter=dot
```

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: 'dot',
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: 'dot',
});
```

Here is an example output in the middle of a test run. Failures will be listed at the end.
```bash
npx playwright test --reporter=dot
Running 124 tests using 6 workers
······F·············································
```

### HTML reporter

HTML reporter produces a self-contained folder that contains report for the test run that can be served as a web page.

```bash
npx playwright test --reporter=html
```

By default, HTML report is opened automatically if some of the tests failed. You can control this behavior via the
`open` property in the Playwright config. The possible values for that property are `always`, `never` and `on-failure`
(default).

You can also configure `host` and `port` that are used to serve the HTML report.

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: [['html', {
    open: 'never',
    host: '0.0.0.0',
    port: 9223,
  }]],
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['html', { open: 'never' }]],
});
```

By default, report is written into the `playwright-report` folder in the current working directory. One can override
that location using the `PLAYWRIGHT_HTML_REPORT` environment variable or a reporter configuration.

In configuration file, pass options directly:
```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: [['html', { outputFolder: 'my-report' }]],
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['html', { outputFolder: 'my-report' }]],
});
```

A quick way of opening the last test run report is:

```bash
npx playwright show-report
```

Or if there is a custom folder name:

```bash
npx playwright show-report my-report
```

> The `html` reporter currently does not support merging reports generated across multiple [`--shards`](./test-parallel.md#shard-tests-between-multiple-machines) into a single report. See [this](https://github.com/microsoft/playwright/issues/10437) issue for available third party solutions.


### JSON reporter

JSON reporter produces an object with all information about the test run.

Most likely you want to write the JSON to a file. When running with `--reporter=json`, use `PLAYWRIGHT_JSON_OUTPUT_NAME` environment variable:

```bash tab=bash-bash
PLAYWRIGHT_JSON_OUTPUT_NAME=results.json npx playwright test --reporter=json
```

```batch tab=bash-batch
set PLAYWRIGHT_JSON_OUTPUT_NAME=results.json
npx playwright test --reporter=json
```

```powershell tab=bash-powershell
$env:PLAYWRIGHT_JSON_OUTPUT_NAME="results.json"
npx playwright test --reporter=json
```

In configuration file, pass options directly:
```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: [['json', { outputFile: 'results.json' }]],
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['json', { outputFile: 'results.json' }]],
});
```

### JUnit reporter

JUnit reporter produces a JUnit-style xml report.

Most likely you want to write the report to an xml file. When running with `--reporter=junit`, use `PLAYWRIGHT_JUNIT_OUTPUT_NAME` environment variable:

```bash tab=bash-bash
PLAYWRIGHT_JUNIT_OUTPUT_NAME=results.xml npx playwright test --reporter=junit
```

```batch tab=bash-batch
set PLAYWRIGHT_JUNIT_OUTPUT_NAME=results.xml
npx playwright test --reporter=junit
```

```powershell tab=bash-powershell
$env:PLAYWRIGHT_JUNIT_OUTPUT_NAME="results.xml"
npx playwright test --reporter=junit
```

In configuration file, pass options directly:
```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: [['junit', { outputFile: 'results.xml' }]],
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: [['junit', { outputFile: 'results.xml' }]],
});
```

The JUnit reporter provides support for embedding additional information on the `testcase` elements using inner `properties`. This is based on an [evolved JUnit XML format](https://docs.getxray.app/display/XRAYCLOUD/Taking+advantage+of+JUnit+XML+reports) from Xray Test Management, but can also be used by other tools if they support this way of embedding additional information for test results; please check it first.

In configuration file, a set of options can be used to configure this behavior. A full example, in this case for Xray, follows ahead.

```js tab=js-js
// playwright.config.js
// @ts-check

// JUnit reporter config for Xray
const xrayOptions = {
  // Whether to add <properties> with all annotations; default is false
  embedAnnotationsAsProperties: true,

  // By default, annotation is reported as <property name='' value=''>.
  // These annotations are reported as <property name=''>value</property>.
  textContentAnnotations: ['test_description'],

  // This will create a "testrun_evidence" property that contains all attachments. Each attachment is added as an inner <item> element.
  // Disables [[ATTACHMENT|path]] in the <system-out>.
  embedAttachmentsAsProperty: 'testrun_evidence',

  // Where to put the report.
  outputFile: './xray-report.xml'
};

module.exports = defineConfig({
  reporter: [['junit', xrayOptions]]
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

// JUnit reporter config for Xray
const xrayOptions = {
  // Whether to add <properties> with all annotations; default is false
  embedAnnotationsAsProperties: true,

  // By default, annotation is reported as <property name='' value=''>.
  // These annotations are reported as <property name=''>value</property>.
  textContentAnnotations: ['test_description'],

  // This will create a "testrun_evidence" property that contains all attachments. Each attachment is added as an inner <item> element.
  // Disables [[ATTACHMENT|path]] in the <system-out>.
  embedAttachmentsAsProperty: 'testrun_evidence',

  // Where to put the report.
  outputFile: './xray-report.xml'
};

export default defineConfig({
  reporter: [['junit', xrayOptions]]
});
```

In the previous configuration sample, all annotations will be added as `<property>` elements on the JUnit XML report. The annotation type is mapped to the `name` attribute of the `<property>`, and the annotation description will be added as a `value` attribute. In this case, the exception will be the annotation type `testrun_evidence` whose description will be added as inner content on the respective `<property>`.
Annotations can be used to, for example, link a Playwright test with an existing Test in Xray or to link a test with an existing story/requirement in Jira (i.e., "cover" it).

```js tab=js-js
// @ts-check
const { test } = require('@playwright/test');

test('using specific annotations for passing test metadata to Xray', async ({}, testInfo) => {
  testInfo.annotations.push({ type: 'test_id', description: '1234' });
  testInfo.annotations.push({ type: 'test_key', description: 'CALC-2' });
  testInfo.annotations.push({ type: 'test_summary', description: 'sample summary' });
  testInfo.annotations.push({ type: 'requirements', description: 'CALC-5,CALC-6' });
  testInfo.annotations.push({ type: 'test_description', description: 'sample description' });
});
```

```js tab=js-ts
import { test } from '@playwright/test';

test('using specific annotations for passing test metadata to Xray', async ({}, testInfo) => {
  testInfo.annotations.push({ type: 'test_id', description: '1234' });
  testInfo.annotations.push({ type: 'test_key', description: 'CALC-2' });
  testInfo.annotations.push({ type: 'test_summary', description: 'sample summary' });
  testInfo.annotations.push({ type: 'requirements', description: 'CALC-5,CALC-6' });
  testInfo.annotations.push({ type: 'test_description', description: 'sample description' });
});
```

Please note that the semantics of these properties will depend on the tool that will process this evolved report format; there are no standard property names/annotations.

If the configuration option `embedAttachmentsAsProperty` is defined, then a `property` with its name is created. Attachments, including their contents, will be embedded on the JUnit XML report inside `<item>` elements under this `property`. Attachments are obtained from the `TestInfo` object, using either a path or a body, and are added as base64 encoded content.
Embedding attachments can be used to attach screenshots or any other relevant evidence; nevertheless, use it wisely as it affects the report size.

The following configuration sample enables embedding attachments by using the `testrun_evidence` element on the JUnit XML report:

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: [['junit', { embedAttachmentsAsProperty: 'testrun_evidence', outputFile: 'results.xml' }]],
});
```

```js tab=js-ts
// playwright.config.js

import { defineConfig } from '@playwright/test';
export default defineConfig({
  reporter: [['junit', { embedAttachmentsAsProperty: 'testrun_evidence', outputFile: 'results.xml' }]],
});
```

The following test adds attachments:

```js tab=js-js
// @ts-check
const { test } = require('@playwright/test');

test('embed attachments, including its content, on the JUnit report', async ({}, testInfo) => {
  const file = testInfo.outputPath('evidence1.txt');
  require('fs').writeFileSync(file, 'hello', 'utf8');
  await testInfo.attach('evidence1.txt', { path: file, contentType: 'text/plain' });
  await testInfo.attach('evidence2.txt', { body: Buffer.from('world'), contentType: 'text/plain' });
});
```

```js tab=js-ts
import { test } from '@playwright/test';

test('embed attachments, including its content, on the JUnit report', async ({}, testInfo) => {
  const file = testInfo.outputPath('evidence1.txt');
  require('fs').writeFileSync(file, 'hello', 'utf8');
  await testInfo.attach('evidence1.txt', { path: file, contentType: 'text/plain' });
  await testInfo.attach('evidence2.txt', { body: Buffer.from('world'), contentType: 'text/plain' });
});
```

### GitHub Actions annotations

You can use the built in `github` reporter to get automatic failure annotations when running in GitHub actions.

Note that all other reporters work on GitHub Actions as well, but do not provide annotations.

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  // 'github' for GitHub Actions CI to generate annotations, plus a concise 'dot'
  // default 'list' when running locally
  reporter: process.env.CI ? 'github' : 'list',
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // 'github' for GitHub Actions CI to generate annotations, plus a concise 'dot'
  // default 'list' when running locally
  reporter: process.env.CI ? 'github' : 'list',
});
```

## Custom reporters

You can create a custom reporter by implementing a class with some of the reporter methods. Learn more about the [Reporter] API.

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
import { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';

class MyReporter implements Reporter {
  onBegin(config: FullConfig, suite: Suite) {
    console.log(`Starting the run with ${suite.allTests().length} tests`);
  }

  onTestBegin(test: TestCase, result: TestResult) {
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

Now use this reporter with [`property: TestConfig.reporter`].

```js tab=js-js
// playwright.config.js
// @ts-check

const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  reporter: './my-awesome-reporter.js',
});
```

```js tab=js-ts
// playwright.config.ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  reporter: './my-awesome-reporter.ts',
});
```


## Third party reporter showcase

* [Allure](https://www.npmjs.com/package/allure-playwright)
* [Monocart](https://github.com/cenfun/monocart-reporter)
* [Tesults](https://www.tesults.com/docs/playwright)
* [ReportPortal](https://github.com/reportportal/agent-js-playwright)

