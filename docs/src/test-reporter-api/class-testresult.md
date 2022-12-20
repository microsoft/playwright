# class: TestResult
* since: v1.10
* langs: js

A result of a single [TestCase] run.

## property: TestResult.attachments
* since: v1.10
- type: <[Array]<[Object]>>
  - `name` <[string]> Attachment name.
  - `contentType` <[string]> Content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`.
  - `path` ?<[string]> Optional path on the filesystem to the attached file.
  - `body` ?<[Buffer]> Optional attachment body used instead of a file.

The list of files or buffers attached during the test execution through [`property: TestInfo.attachments`].

## property: TestResult.duration
* since: v1.10
- type: <[float]>

Running time in milliseconds.

## property: TestResult.error
* since: v1.10
- type: ?<[TestError]>

First error thrown during test execution, if any. This is equal to the first
element in [`property: TestResult.errors`].

## property: TestResult.errors
* since: v1.10
- type: <[Array]<[TestError]>>

Errors thrown during the test execution.

## property: TestResult.retry
* since: v1.10
- type: <[int]>

When test is retries multiple times, each retry attempt is given a sequential number.

Learn more about [test retries](../test-retries.md#retries).

## property: TestResult.startTime
* since: v1.10
- type: <[Date]>

Start time of this particular test run.

## property: TestResult.status
* since: v1.10
- type: <[TestStatus]<"passed"|"failed"|"timedOut"|"skipped"|"interrupted">>

The status of this test result. See also [`property: TestCase.expectedStatus`].

## property: TestResult.stderr
* since: v1.10
- type: <[Array]<[string]|[Buffer]>>

Anything written to the standard error during the test run.

## property: TestResult.stdout
* since: v1.10
- type: <[Array]<[string]|[Buffer]>>

Anything written to the standard output during the test run.

## property: TestResult.steps
* since: v1.10
- type: <[Array]<[TestStep]>>

List of steps inside this test run.

## property: TestResult.workerIndex
* since: v1.10
- type: <[int]>

Index of the worker where the test was run. If the test was not run a single time, for example when the user interrupted testing, the only result will have a `workerIndex` equal to `-1`.

Learn more about [parallelism and sharding](../test-parallel.md) with Playwright Test.

## property: TestResult.parallelIndex
* since: v1.30
- type: <[int]>

The index of the worker between `0` and `workers - 1`. It is guaranteed that workers running at the same time have a different `parallelIndex`.
