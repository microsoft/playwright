# class: TestInfo
* since: v1.10
* langs: js

`TestInfo` contains information about currently running test. It is available to test functions, [`method: Test.beforeEach`], [`method: Test.afterEach`], [`method: Test.beforeAll`] and [`method: Test.afterAll`] hooks, and test-scoped fixtures. `TestInfo` provides utilities to control test execution: attach files, update test timeout, determine which test is currently running and whether it was retried, etc.

```js
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }, testInfo) => {
  expect(testInfo.title).toBe('basic test');
  await page.screenshot(testInfo.outputPath('screenshot.png'));
});
```


## property: TestInfo.annotations
* since: v1.10
- type: <[Array]<[Object]>>
  - `type` <[string]> Annotation type, for example `'skip'` or `'fail'`.
  - `description` ?<[string]> Optional description.

The list of annotations applicable to the current test. Includes annotations from the test, annotations from all [`method: Test.describe`] groups the test belongs to and file-level annotations for the test file.

Learn more about [test annotations](../test-annotations.md).

## property: TestInfo.attachments
* since: v1.10
- type: <[Array]<[Object]>>
  - `name` <[string]> Attachment name.
  - `contentType` <[string]> Content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`.
  - `path` ?<[string]> Optional path on the filesystem to the attached file.
  - `body` ?<[Buffer]> Optional attachment body used instead of a file.

The list of files or buffers attached to the current test. Some reporters show test attachments.

To add an attachment, use [`method: TestInfo.attach`] instead of directly pushing onto this array.

## async method: TestInfo.attach
* since: v1.10

Attach a value or a file from disk to the current test. Some reporters show test attachments. Either [`option: path`] or [`option: body`] must be specified, but not both.

For example, you can attach a screenshot to the test:

```js
import { test, expect } from '@playwright/test';

test('basic test', async ({ page }, testInfo) => {
  await page.goto('https://playwright.dev');
  const screenshot = await page.screenshot();
  await testInfo.attach('screenshot', { body: screenshot, contentType: 'image/png' });
});
```

Or you can attach files returned by your APIs:

```js
import { test, expect } from '@playwright/test';
import { download } from './my-custom-helpers';

test('basic test', async ({}, testInfo) => {
  const tmpPath = await download('a');
  await testInfo.attach('downloaded', { path: tmpPath });
});
```

:::note
[`method: TestInfo.attach`] automatically takes care of copying attached files to a
location that is accessible to reporters. You can safely remove the attachment
after awaiting the attach call.
:::

### param: TestInfo.attach.name
* since: v1.10
- `name` <[string]>

Attachment name. The name will also be sanitized and used as the prefix of file name
when saving to disk.

### option: TestInfo.attach.body
* since: v1.10
- `body` <[string]|[Buffer]>

Attachment body. Mutually exclusive with [`option: path`].

### option: TestInfo.attach.contentType
* since: v1.10
- `contentType` <[string]>

Content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`. If omitted, content type is inferred based on the [`option: path`], or defaults to `text/plain` for [string] attachments and `application/octet-stream` for [Buffer] attachments.

### option: TestInfo.attach.path
* since: v1.10
- `path` <[string]>

Path on the filesystem to the attached file. Mutually exclusive with [`option: body`].


## property: TestInfo.column
* since: v1.10
- type: <[int]>

Column number where the currently running test is declared.


## property: TestInfo.config
* since: v1.10
- type: <[FullConfig]>

Processed configuration from the [configuration file](../test-configuration.md).


## property: TestInfo.duration
* since: v1.10
- type: <[int]>

The number of milliseconds the test took to finish. Always zero before the test finishes, either successfully or not. Can be used in [`method: Test.afterEach`] hook.


## property: TestInfo.error
* since: v1.10
- type: ?<[TestInfoError]>

First error thrown during test execution, if any. This is equal to the first
element in [`property: TestInfo.errors`].

## property: TestInfo.errors
* since: v1.10
- type: <[Array]<[TestInfoError]>>

Errors thrown during test execution, if any.


## property: TestInfo.expectedStatus
* since: v1.10
- type: <[TestStatus]<"passed"|"failed"|"timedOut"|"skipped"|"interrupted">>

Expected status for the currently running test. This is usually `'passed'`, except for a few cases:
* `'skipped'` for skipped tests, e.g. with [`method: Test.skip`];
* `'failed'` for tests marked as failed with [`method: Test.fail`].

Expected status is usually compared with the actual [`property: TestInfo.status`]:

```js
import { test, expect } from '@playwright/test';

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus)
    console.log(`${testInfo.title} did not run as expected!`);
});
```

## method: TestInfo.fail#1
* since: v1.10

Marks the currently running test as "should fail". Playwright Test runs this test and ensures that it is actually failing. This is useful for documentation purposes to acknowledge that some functionality is broken until it is fixed. This is similar to [`method: Test.fail`].

## method: TestInfo.fail#2
* since: v1.10

Conditionally mark the currently running test as "should fail" with an optional description. This is similar to [`method: Test.fail`].

### param: TestInfo.fail#2.condition
* since: v1.10
- `condition` <[boolean]>

Test is marked as "should fail" when the condition is `true`.

### param: TestInfo.fail#2.description
* since: v1.10
- `description` ?<[string]>

Optional description that will be reflected in a test report.


## property: TestInfo.file
* since: v1.10
- type: <[string]>

Absolute path to a file where the currently running test is declared.


## method: TestInfo.fixme#1
* since: v1.10

Mark a test as "fixme", with the intention to fix it. Test is immediately aborted. This is similar to [`method: Test.fixme`].

## method: TestInfo.fixme#2
* since: v1.10

Conditionally mark the currently running test as "fixme" with an optional description. This is similar to [`method: Test.fixme`].

### param: TestInfo.fixme#2.condition
* since: v1.10
- `condition` <[boolean]>

Test is marked as "fixme" when the condition is `true`.

### param: TestInfo.fixme#2.description
* since: v1.10
- `description` ?<[string]>

Optional description that will be reflected in a test report.


## property: TestInfo.fn
* since: v1.10
- type: <[function]>

Test function as passed to `test(title, testFunction)`.

## property: TestInfo.tags
* since: v1.43
- type: <[Array]<[string]>>

Tags that apply to the test. Learn more about [tags](../test-annotations.md#tag-tests).

Note that any changes made to this list while the test is running will not be visible to test reporters.

## property: TestInfo.testId
* since: v1.32
- type: <[string]>

Test id matching the test case id in the reporter API.

## property: TestInfo.line
* since: v1.10
- type: <[int]>

Line number where the currently running test is declared.

## property: TestInfo.snapshotDir
* since: v1.10
- type: <[string]>

Absolute path to the snapshot output directory for this specific test. Each test suite gets its own directory so they cannot conflict.

This property does not account for the [`property: TestProject.snapshotPathTemplate`] configuration.

## property: TestInfo.outputDir
* since: v1.10
- type: <[string]>

Absolute path to the output directory for this specific test run. Each test run gets its own directory so they cannot conflict.

## method: TestInfo.outputPath
* since: v1.10
- returns: <[string]>

Returns a path inside the [`property: TestInfo.outputDir`] where the test can safely put a temporary file. Guarantees that tests running in parallel will not interfere with each other.

```js
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
* since: v1.10
- `...pathSegments` <[Array]<[string]>>

Path segments to append at the end of the resulting path.

## property: TestInfo.parallelIndex
* since: v1.10
- type: <[int]>

The index of the worker between `0` and `workers - 1`. It is guaranteed that workers running at the same time have a different `parallelIndex`. When a worker is restarted, for example after a failure, the new worker process has the same `parallelIndex`.

Also available as `process.env.TEST_PARALLEL_INDEX`. Learn more about [parallelism and sharding](../test-parallel.md) with Playwright Test.

## property: TestInfo.project
* since: v1.10
- type: <[FullProject]>

Processed project configuration from the [configuration file](../test-configuration.md).


## property: TestInfo.repeatEachIndex
* since: v1.10
- type: <[int]>

Specifies a unique repeat index when running in "repeat each" mode. This mode is enabled by passing `--repeat-each` to the [command line](../test-cli.md).

## property: TestInfo.retry
* since: v1.10
- type: <[int]>

Specifies the retry number when the test is retried after a failure. The first test run has [`property: TestInfo.retry`] equal to zero, the first retry has it equal to one, and so on. Learn more about [retries](../test-retries.md#retries).

```js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({}, testInfo) => {
  // You can access testInfo.retry in any hook or fixture.
  if (testInfo.retry > 0)
    console.log(`Retrying!`);
});

test('my test', async ({ page }, testInfo) => {
  // Here we clear some server-side state when retrying.
  if (testInfo.retry)
    await cleanSomeCachesOnTheServer();
  // ...
});
```

## method: TestInfo.setTimeout
* since: v1.10

Changes the timeout for the currently running test. Zero means no timeout. Learn more about [various timeouts](../test-timeouts.md).

Timeout is usually specified in the [configuration file](../test-configuration.md), but it could be useful to change the timeout in certain scenarios:

```js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
});
```

### param: TestInfo.setTimeout.timeout
* since: v1.10
- `timeout` <[int]>

Timeout in milliseconds.

## method: TestInfo.skip#1
* since: v1.10

Unconditionally skip the currently running test. Test is immediately aborted. This is similar to [`method: Test.skip`].

## method: TestInfo.skip#2
* since: v1.10

Conditionally skips the currently running test with an optional description. This is similar to [`method: Test.skip`].

### param: TestInfo.skip#2.condition
* since: v1.10
- `condition` <[boolean]>

A skip condition. Test is skipped when the condition is `true`.

### param: TestInfo.skip#2.description
* since: v1.10
- `description` ?<[string]>

Optional description that will be reflected in a test report.


## method: TestInfo.slow#1
* since: v1.10

Marks the currently running test as "slow", giving it triple the default timeout. This is similar to [`method: Test.slow`].

## method: TestInfo.slow#2
* since: v1.10

Conditionally mark the currently running test as "slow" with an optional description, giving it triple the default timeout. This is similar to [`method: Test.slow`].

### param: TestInfo.slow#2.condition
* since: v1.10
- `condition` <[boolean]>

Test is marked as "slow" when the condition is `true`.

### param: TestInfo.slow#2.description
* since: v1.10
- `description` ?<[string]>

Optional description that will be reflected in a test report.


## method: TestInfo.snapshotPath
* since: v1.10
- returns: <[string]>

Returns a path to a snapshot file with the given `pathSegments`. Learn more about [snapshots](../test-snapshots.md).

> Note that `pathSegments` accepts path segments to the snapshot file such as `testInfo.snapshotPath('relative', 'path', 'to', 'snapshot.png')`.
> However, this path must stay within the snapshots directory for each test file (i.e. `a.spec.js-snapshots`), otherwise it will throw.

### param: TestInfo.snapshotPath.pathSegments
* since: v1.10
- `...pathSegments` <[Array]<[string]>>

The name of the snapshot or the path segments to define the snapshot file path. Snapshots with the same name in the same test file are expected to be the same.

## property: TestInfo.snapshotSuffix
* since: v1.10
- type: <[string]>

:::note
Use of [`property: TestInfo.snapshotSuffix`] is discouraged. Please use [`property: TestConfig.snapshotPathTemplate`] to configure
snapshot paths.
:::

Suffix used to differentiate snapshots between multiple test configurations. For example, if snapshots depend on the platform, you can set `testInfo.snapshotSuffix` equal to `process.platform`. In this case `expect(value).toMatchSnapshot(snapshotName)` will use different snapshots depending on the platform. Learn more about [snapshots](../test-snapshots.md).

## property: TestInfo.status
* since: v1.10
- type: ?<[TestStatus]<"passed"|"failed"|"timedOut"|"skipped"|"interrupted">>

Actual status for the currently running test. Available after the test has finished in [`method: Test.afterEach`] hook and fixtures.

Status is usually compared with the [`property: TestInfo.expectedStatus`]:

```js
import { test, expect } from '@playwright/test';

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus)
    console.log(`${testInfo.title} did not run as expected!`);
});
```

## property: TestInfo.timeout
* since: v1.10
- type: <[int]>

Timeout in milliseconds for the currently running test. Zero means no timeout. Learn more about [various timeouts](../test-timeouts.md).

Timeout is usually specified in the [configuration file](../test-configuration.md)

```js
import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }, testInfo) => {
  // Extend timeout for all tests running this hook by 30 seconds.
  testInfo.setTimeout(testInfo.timeout + 30000);
});
```

## property: TestInfo.title
* since: v1.10
- type: <[string]>

The title of the currently running test as passed to `test(title, testFunction)`.

## property: TestInfo.titlePath
* since: v1.10
- type: <[Array]<[string]>>

The full title path starting with the test file name.

## property: TestInfo.workerIndex
* since: v1.10
- type: <[int]>

The unique index of the worker process that is running the test. When a worker is restarted, for example after a failure, the new worker process gets a new unique `workerIndex`.

Also available as `process.env.TEST_WORKER_INDEX`. Learn more about [parallelism and sharding](../test-parallel.md) with Playwright Test.
