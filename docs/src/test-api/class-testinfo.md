# class: TestInfo
* langs: js

`TestInfo` contains information about currently running test. It is available to any test function, [`method: Test.beforeEach`] and [`method: Test.afterEach`] hooks and test-scoped fixtures. `TestInfo` provides utilities to control test execution: attach files, update test timeout, determine which test is currently running and whether it was retried, etc.

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }, testInfo) => {
  expect(testInfo.title).toBe('basic test');
  await page.screenshot(testInfo.outputPath('screenshot.png'));
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }, testInfo) => {
  expect(testInfo.title).toBe('basic test');
  await page.screenshot(testInfo.outputPath('screenshot.png'));
});
```


## property: TestInfo.annotations
- type: <[Array]<[Object]>>
  - `type` <[string]> Annotation type, for example `'skip'` or `'fail'`.
  - `description` <[void]|[string]> Optional description.

The list of annotations applicable to the current test. Includes annotations from the test, annotations from all [`method: Test.describe`] groups the test belongs to and file-level annotations for the test file.

Learn more about [test annotations](./test-annotations.md).

## property: TestInfo.attachments
- type: <[Array]<[Object]>>
  - `name` <[string]> Attachment name.
  - `contentType` <[string]> Content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`.
  - `path` <[void]|[string]> Optional path on the filesystem to the attached file.
  - `body` <[void]|[Buffer]> Optional attachment body used instead of a file.

The list of files or buffers attached to the current test. Some reporters show test attachments.

To safely add a file from disk as an attachment, please use [`method: TestInfo.attach#1`] instead of directly pushing onto this array. For inline attachments, use [`method: TestInfo.attach#1`].

## method: TestInfo.attach#1
Attach a file from disk to the current test. Some reporters show test attachments. The [`option: name`] and [`option: contentType`] will be inferred by default from the [`param: path`], but you can optionally override either of these.

For example, you can attach a screenshot to the test:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('basic test', async ({ page }, testInfo) => {
  await page.goto('https://playwright.dev');

  // Capture a screenshot and attach it.
  const path = testInfo.outputPath('screenshot.png');
  await page.screenshot({ path });
  await testInfo.attach(path);
  // Optionally override the name.
  await testInfo.attach(path, { name: 'example.png' });
  // Optionally override the contentType.
  await testInfo.attach(path, { name: 'example.custom-file', contentType: 'x-custom-content-type' });
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }, testInfo) => {
  await page.goto('https://playwright.dev');

  // Capture a screenshot and attach it.
  const path = testInfo.outputPath('screenshot.png');
  await page.screenshot({ path });
  await testInfo.attach(path);
  // Optionally override the name.
  await testInfo.attach(path, { name: 'example.png' });
  // Optionally override the contentType.
  await testInfo.attach(path, { name: 'example.custom-file', contentType: 'x-custom-content-type' });
});
```

Or you can attach files returned by your APIs:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test('basic test', async ({}, testInfo) => {
  const { download } = require('./my-custom-helpers');
  const tmpPath = await download('a');
  await testInfo.attach(tmpPath, { name: 'example.json' });
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test('basic test', async ({}, testInfo) => {
  const { download } = require('./my-custom-helpers');
  const tmpPath = await download('a');
  await testInfo.attach(tmpPath, { name: 'example.json' });
});
```

:::note
[`method: TestInfo.attach#1`] automatically takes care of copying attachments to a
location that is accessible to reporters, even if you were to delete the attachment
after awaiting the attach call.
:::

### param: TestInfo.attach#1.path
- `path` <[string]> Path on the filesystem to the attached file.

### option: TestInfo.attach#1.name
- `name` <[void]|[string]> Optional attachment name. If omitted, this will be inferred from [`param: path`].

### option: TestInfo.attach#1.contentType
- `contentType` <[void]|[string]> Optional content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`. If omitted, this falls back to an inferred type based on the [`param: name`] (if set) or [`param: path`]'s extension; it will be set to `application/octet-stream` if the type cannot be inferred from the file extension.


## method: TestInfo.attach#2

Attach data to the current test, either a `string` or a `Buffer`. Some reporters show test attachments.

### param: TestInfo.attach#2.body
- `body` <[string]|[Buffer]> Attachment body.

### param: TestInfo.attach#2.name
- `name` <[string]> Attachment name.

### param: TestInfo.attach#2.contentType
- `contentType` <[void]|[string]> Optional content type of this attachment to properly present in the report, for example `'application/json'` or `'application/xml'`. If omitted, this falls back to an inferred type based on the [`param: name`]'s extension; if the type cannot be inferred from the name's extension, it will be set to `text/plain` (if [`param: body`] is a `string`) or `application/octet-stream` (if [`param: body`] is a `Buffer`).

## property: TestInfo.column
- type: <[int]>

Column number where the currently running test is declared.


## property: TestInfo.config
- type: <[TestConfig]>

Processed configuration from the [configuration file](./test-configuration.md).


## property: TestInfo.duration
- type: <[int]>

The number of milliseconds the test took to finish. Always zero before the test finishes, either successfully or not.


## property: TestInfo.error
- type: <[Object]>
  - `message` <[void]|[string]> Error message. Set when `Error` (or its subclass) has been thrown.
  - `stack` <[void]|[string]> Error stack. Set when `Error` (or its subclass) has been thrown.
  - `value` <[void]|[string]> The thrown value. Set when anything except the `Error` (or its subclass) has been thrown.

An error thrown during test execution, if any.


## property: TestInfo.expectedStatus
- type: <[TestStatus]<"passed"|"failed"|"timedOut"|"skipped">>

Expected status for the currently running test. This is usually `'passed'`, except for a few cases:
* `'skipped'` for skipped tests, e.g. with [`method: Test.skip#2`];
* `'failed'` for tests marked as failed with [`method: Test.fail`].

Expected status is usually compared with the actual [`property: TestInfo.status`]:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus)
    console.log(`${testInfo.title} did not run as expected!`);
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus)
    console.log(`${testInfo.title} did not run as expected!`);
});
```

## method: TestInfo.fail

Marks the currently running test as "should fail". Playwright Test ensures that this test is actually failing. This is similar to [`method: Test.fail`].

### param: TestInfo.fail.condition
- `condition` <[void]|[boolean]>

Optional condition - the test is marked as "should fail" when the condition is `true`.

### param: TestInfo.fail.description
- `description` <[void]|[string]>

Optional description that will be reflected in a test report.

## property: TestInfo.file
- type: <[string]>

Absolute path to a file where the currently running test is declared.

## method: TestInfo.fixme

Marks the currently running test as "fixme". The test will be skipped, but the intention is to fix it. This is similar to [`method: Test.fixme`].

### param: TestInfo.fixme.condition
- `condition` <[void]|[boolean]>

Optional condition - the test is marked as "fixme" when the condition is `true`.

### param: TestInfo.fixme.description
- `description` <[void]|[string]>

Optional description that will be reflected in a test report.

## property: TestInfo.fn
- type: <[function]\([TestArgs], [TestInfo]\)>

Test function as passed to `test(title, testFunction)`.

## property: TestInfo.line
- type: <[int]>

Line number where the currently running test is declared.

## property: TestInfo.snapshotDir
- type: <[string]>

Absolute path to the snapshot output directory for this specific test. Each test suite gets its own directory so they cannot conflict.

## property: TestInfo.outputDir
- type: <[string]>

Absolute path to the output directory for this specific test run. Each test run gets its own directory so they cannot conflict.

## method: TestInfo.outputPath
- returns: <[string]>

Returns a path inside the [`property: TestInfo.outputDir`] where the test can safely put a temporary file. Guarantees that tests running in parallel will not interfere with each other.

```js js-flavor=js
const { test, expect } = require('@playwright/test');
const fs = require('fs');

test('example test', async ({}, testInfo) => {
  const file = testInfo.outputPath('dir', 'temporary-file.txt');
  await fs.promises.writeFile(file, 'Put some data to the dir/temporary-file.txt', 'utf8');
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';
import fs from 'fs';

test('example test', async ({}, testInfo) => {
  const file = testInfo.outputPath('dir', 'temporary-file.txt');
  await fs.promises.writeFile(file, 'Put some data to the dir/temporary-file.txt', 'utf8');
});
```

> Note that `pathSegments` accepts path segments to the test output directory such as `testInfo.outputPath('relative', 'path', 'to', 'output')`.
> However, this path must stay within the [`property: TestInfo.outputDir`] directory for each test (i.e. `test-results/a-test-title`), otherwise it will throw.

### param: TestInfo.outputPath.pathSegments
- `pathSegments` <[string...]>

Path segments to append at the end of the resulting path.

## property: TestInfo.parallelIndex
- type: <[int]>

The index of the worker between `0` and `workers - 1`. It is guaranteed that workers running at the same time have a different `parallelIndex`. When a worker is restarted, for example after a failure, the new worker process has the same `parallelIndex`.

Also available as `process.env.TEST_PARALLEL_INDEX`. Learn more about [parallelism and sharding](./test-parallel.md) with Playwright Test.

## property: TestInfo.project
- type: <[TestProject]>

Processed project configuration from the [configuration file](./test-configuration.md).


## property: TestInfo.repeatEachIndex
- type: <[int]>

Specifies a unique repeat index when running in "repeat each" mode. This mode is enabled by passing `--repeat-each` to the [command line](./test-cli.md).

## property: TestInfo.retry
- type: <[int]>

Specifies the retry number when the test is retried after a failure. The first test run has [`property: TestInfo.retry`] equal to zero, the first retry has it equal to one, and so on. Learn more about [retries](./test-retries.md#retries).

## method: TestInfo.setTimeout

Changes the timeout for the currently running test. Zero means no timeout.

Timeout is usually specified in the [configuration file](./test-configuration.md), but it could be useful to change the timeout in certain scenarios:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
});
```

### param: TestInfo.setTimeout.timeout
- `timeout` <[int]>

Timeout in milliseconds.

## method: TestInfo.skip

Skips the currently running test. This is similar to [`method: Test.skip#2`].

### param: TestInfo.skip.condition
- `condition` <[void]|[boolean]>

Optional condition - the test is skipped when the condition is `true`.

### param: TestInfo.skip.description
- `description` <[void]|[string]>

Optional description that will be reflected in a test report.

## method: TestInfo.slow

Marks the currently running test as "slow", giving it triple the default timeout. This is similar to [`method: Test.slow`].

### param: TestInfo.slow.condition
- `condition` <[void]|[boolean]>

Optional condition - the test is marked as "slow" when the condition is `true`.

### param: TestInfo.slow.description
- `description` <[void]|[string]>

Optional description that will be reflected in a test report.

## method: TestInfo.snapshotPath
- returns: <[string]>

Returns a path to a snapshot file with the given `pathSegments`. Learn more about [snapshots](./test-snapshots.md).

> Note that `pathSegments` accepts path segments to the snapshot file such as `testInfo.snapshotPath('relative', 'path', 'to', 'snapshot.png')`.
> However, this path must stay within the snapshots directory for each test file (i.e. `a.spec.js-snapshots`), otherwise it will throw.

### param: TestInfo.snapshotPath.pathSegments
- `pathSegments` <[string...]>

The name of the snapshot or the path segments to define the snapshot file path. Snapshots with the same name in the same test file are expected to be the same.

## property: TestInfo.snapshotSuffix
- type: <[string]>

Suffix used to differentiate snapshots between multiple test configurations. For example, if snapshots depend on the platform, you can set `testInfo.snapshotSuffix` equal to `process.platform`. In this case `expect(value).toMatchSnapshot(snapshotName)` will use different snapshots depending on the platform. Learn more about [snapshots](./test-snapshots.md).

## property: TestInfo.status
- type: <[void]|[TestStatus]<"passed"|"failed"|"timedOut"|"skipped">>

Actual status for the currently running test. Available after the test has finished in [`method: Test.afterEach`] hook and fixtures.

Status is usually compared with the [`property: TestInfo.expectedStatus`]:

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus)
    console.log(`${testInfo.title} did not run as expected!`);
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus)
    console.log(`${testInfo.title} did not run as expected!`);
});
```

## property: TestInfo.stderr
- type: <[Array]<[string]|[Buffer]>>

Output written to `process.stderr` or `console.error` during the test execution.

## property: TestInfo.stdout
- type: <[Array]<[string]|[Buffer]>>

Output written to `process.stdout` or `console.log` during the test execution.

## property: TestInfo.timeout
- type: <[int]>

Timeout in milliseconds for the currently running test. Zero means no timeout. Timeout is usually specified in the [configuration file](./test-configuration.md)

```js js-flavor=js
const { test, expect } = require('@playwright/test');

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
});
```

```js js-flavor=ts
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
});
```

## property: TestInfo.title
- type: <[string]>

The title of the currently running test as passed to `test(title, testFunction)`.

## property: TestInfo.titlePath
- type: <[Array]<[string]>>

The full title path starting with the project.

## property: TestInfo.workerIndex
- type: <[int]>

The unique index of the worker process that is running the test. When a worker is restarted, for example after a failure, the new worker process gets a new unique `workerIndex`.

Also available as `process.env.TEST_WORKER_INDEX`. Learn more about [parallelism and sharding](./test-parallel.md) with Playwright Test.
