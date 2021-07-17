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
import { PlaywrightTestConfig } from '@playwright/test';

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
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [
    ['list'],
    ['json', {  outputFile: 'test-results.json' }]
  ],
};
export default config;
```

### Reporters on CI

You can use different reporters locally and on CI. For example, using concise `'dot'` reporter avoids too much output.

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
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  // Concise 'dot' for CI, default 'list' when running locally
  reporter: process.env.CI ? 'dot' : 'list',
};
export default config;
```

## Built-in reporters

All built-in reporters show detailed information about failures, and mostly differ in verbosity for successful runs.

### List reporter

List reporter is default. It prints a line for each test being run.

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
import { PlaywrightTestConfig } from '@playwright/test';

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
import { PlaywrightTestConfig } from '@playwright/test';

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

Dot reporter is very concise - it only produces a single character per successful test run. It is useful on CI where you don't want a lot of output.

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
import { PlaywrightTestConfig } from '@playwright/test';

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

### JSON reporter

JSON reporter produces an object with all information about the test run. It is usually used together with some terminal reporter like `dot` or `line`.

Most likely you want to write the JSON to a file. When running with `--reporter=json`, use `PLAYWRIGHT_JSON_OUTPUT_NAME` environment variable:
```bash
PLAYWRIGHT_JSON_OUTPUT_NAME=results.json npx playwright test --reporter=json,dot
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
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [ ['json', { outputFile: 'results.json' }] ],
};
export default config;
```

### JUnit reporter

JUnit reporter produces a JUnit-style xml report. It is usually used together with some terminal reporter like `dot` or `line`.

Most likely you want to write the report to an xml file. When running with `--reporter=junit`, use `PLAYWRIGHT_JUNIT_OUTPUT_NAME` environment variable:
```bash
PLAYWRIGHT_JUNIT_OUTPUT_NAME=results.xml npx playwright test --reporter=junit,line
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
import { PlaywrightTestConfig } from '@playwright/test';

const config: PlaywrightTestConfig = {
  reporter: [ ['junit', { outputFile: 'results.xml' }] ],
};
export default config;
```
