---
id: test-reporters
title: "Reporters"
---

<!-- TOC -->

## Using reporters

Playwright Test comes with a few built-in reporters for different needs and ability to provide custom reporters. The easiest way to try out built-in reporters is to pass `--reporter` [command line option](./test-cli.md).


```bash
npx playwright test --reporter=line
```

For more control, you can specify reporters programmatically in the [configuration file](./test-configuration.md).

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: 'line',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: 'line',
};
export default config;
```

### Multiple reporters

You can use multiple reporters at the same time. For example  you can use`'list'` for nice terminal output and `'json'` to get a comprehensive json file with the test results.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: [
    ['list'],
    ['json', {  outputFile: 'test-results.json' }]
  ],
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [
    ['list'],
    ['json', {  outputFile: 'test-results.json' }]
  ],
};
export default config;
```

### Reporters on CI

You can use different reporters locally and on CI. For example, using concise `'dot'` reporter avoids too much output. This is the default on CI.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  // Concise 'dot' for CI, default 'list' when running locally
  reporter: process.env.CI ? 'dot' : 'list',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // Concise 'dot' for CI, default 'list' when running locally
  reporter: process.env.CI ? 'dot' : 'list',
};
export default config;
```

## Built-in reporters

All built-in reporters show detailed information about failures, and mostly differ in verbosity for successful runs.

### List reporter

List reporter is default (except on CI where the `dot` reporter is default). It prints a line for each test being run.

```bash
npx playwright test --reporter=list
```

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: 'list',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: 'list',
};
export default config;
```

Here is an example output in the middle of a test run. Failures will be listed at the end.
```bash
npx playwright test --reporter=list
Running 124 tests using 6 workers

  ✓ should access error in env (438ms)
  ✓ handle long test names (515ms)
  x 1) render expected (691ms)
  ✓ should timeout (932ms)
    should repeat each:
  ✓ should respect enclosing .gitignore (569ms)
    should teardown env after timeout:
    should respect excluded tests:
  ✓ should handle env beforeEach error (638ms)
    should respect enclosing .gitignore:
```

### Line reporter

Line reporter is more concise than the list reporter. It uses a single line to report last finished test, and prints failures when they occur. Line reporter is useful for large test suites where it shows the progress but does not spam the output by listing all the tests.

```bash
npx playwright test --reporter=line
```

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: 'line',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: 'line',
};
export default config;
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

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: 'dot',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: 'dot',
};
export default config;
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

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: [ ['html', { open: 'never' }] ],
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [ ['html', { open: 'never' }] ],
};
export default config;
```

By default, report is written into the `playwright-report` folder in the current working directory. One can override
that location using the `PLAYWRIGHT_HTML_REPORT` environment variable or a reporter configuration.

In configuration file, pass options directly:
```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: [ ['html', { outputFolder: 'my-report' }] ],
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [ ['html', { outputFolder: 'my-report' }] ],
};
export default config;
```

A quick way of opening the last test run report is:

```bash
npx playwright show-report
```

Or if there is a custom folder name:

```bash
npx playwright show-report my-report
```


### JSON reporter

JSON reporter produces an object with all information about the test run.

Most likely you want to write the JSON to a file. When running with `--reporter=json`, use `PLAYWRIGHT_JSON_OUTPUT_NAME` environment variable:

```bash bash-flavor=bash
PLAYWRIGHT_JSON_OUTPUT_NAME=results.json npx playwright test --reporter=json
```

```bash bash-flavor=batch
set PLAYWRIGHT_JSON_OUTPUT_NAME=results.json
npx playwright test --reporter=json
```

```bash bash-flavor=powershell
$env:PLAYWRIGHT_JSON_OUTPUT_NAME="results.json"
npx playwright test --reporter=json
```

In configuration file, pass options directly:
```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: [ ['json', { outputFile: 'results.json' }] ],
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [ ['json', { outputFile: 'results.json' }] ],
};
export default config;
```

### JUnit reporter

JUnit reporter produces a JUnit-style xml report.

Most likely you want to write the report to an xml file. When running with `--reporter=junit`, use `PLAYWRIGHT_JUNIT_OUTPUT_NAME` environment variable:

```bash bash-flavor=bash
PLAYWRIGHT_JUNIT_OUTPUT_NAME=results.xml npx playwright test --reporter=junit
```

```bash bash-flavor=batch
set PLAYWRIGHT_JUNIT_OUTPUT_NAME=results.xml
npx playwright test --reporter=junit
```

```bash bash-flavor=powershell
$env:PLAYWRIGHT_JUNIT_OUTPUT_NAME="results.xml"
npx playwright test --reporter=junit
```

In configuration file, pass options directly:
```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: [ ['junit', { outputFile: 'results.xml' }] ],
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [ ['junit', { outputFile: 'results.xml' }] ],
};
export default config;
```

The JUnit reporter provides support for embedding additional information on the `testcase` elements using inner `properties`. This is based on an [evolved JUnit XML format](https://docs.getxray.app/display/XRAYCLOUD/Taking+advantage+of+JUnit+XML+reports) from Xray Test Management, but can also be used by other tools if they support this way of embedding additonal information for test results; please check it first.

In configuration file, a set of options can be used to configure this behavior. A full example, in this case for Xray, follows ahead.

```js js-flavor=ts
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

module.exports = {
  reporter: [['junit', xrayOptions]]
};
```

In the previous configuration sample, all annotations will be added as `<property>` elements on the JUnit XML report. The annotation type is mapped to the `name` attribute of the `<property>`, and the annotation description will be added as a `value` attribute. In this case, the exception will be the annotation type `testrun_evidence` whose description will be added as inner content on the respective `<property>`.
Annotations can be used to, for example, link a Playwright test with an existing Test in Xray or to link a test with an existing story/requirement in Jira (i.e., "cover" it).

```js js-flavor=js
test('using specific annotations for passing test metadata to Xray', async ({}, testInfo) => {
  testInfo.annotations.push({ type: 'test_id', description: '1234' });
  testInfo.annotations.push({ type: 'test_key', description: 'CALC-2' });
  testInfo.annotations.push({ type: 'test_summary', description: 'sample summary' });
  testInfo.annotations.push({ type: 'requirements', description: 'CALC-5,CALC-6' });
  testInfo.annotations.push({ type: 'test_description', description: 'sample description' });
});
```

Please note that the semantics of these properties will depend on the tool that will process this evoled report format; there are no standard property names/annotations.

If the configuration option `embedAttachmentsAsProperty` is defined, then a `property` with its name is created. Attachments, including their contents, will be embeded on the JUnit XML report inside `<item>` elements under this `property`. Attachments are obtained from the `TestInfo` object, using either a path or a body, and are added as base64 encoded content.
Embedding attachments can be used to attach screenshots or any other relevant evidence; nevertheless, use it wisely as it affects the report size.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  reporter: [ ['junit', { embedAttachmentsAsProperty: 'testrun_evidence', outputFile: 'results.xml' }] ],
};

```js js-flavor=js
test('embed attachments, including its content, on the JUnit report', async ({}, testInfo) => {
  const file = testInfo.outputPath('evidence1.txt');
  require('fs').writeFileSync(file, 'hello', 'utf8');
  testInfo.attachments.push({ name: 'evidence1.txt', path: file, contentType: 'text/plain' });
  testInfo.attachments.push({ name: 'evidence2.txt', body: Buffer.from('world'), contentType: 'text/plain' });
});
```

### GitHub Actions annotations

You can use the built in `github` reporter to get automatic failure annotations when running in GitHub actions.

Note that all other reporters work on GitHub Actions as well, but do not provide annotations.

```js js-flavor=js
// playwright.config.js
// @ts-check

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = {
  // 'github' for GitHub Actions CI to generate annotations, plus a concise 'dot'
  // default 'list' when running locally
  reporter: process.env.CI ? 'github' : 'list',
};

module.exports = config;
```

```js js-flavor=ts
// playwright.config.ts
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // 'github' for GitHub Actions CI to generate annotations, plus a concise 'dot'
  // default 'list' when running locally
  reporter: process.env.CI ? 'github' : 'list',
};
export default config;
```

## Custom reporters

You can create a custom reporter by implementing a class with some of the reporter methods. Learn more about the [Reporter] API.

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
import type { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: './my-awesome-reporter.ts',
};
export default config;
```


## Third party reporter showcase

* [Allure](https://www.npmjs.com/package/allure-playwright)
* [Tesults](https://www.tesults.com/docs/playwright)