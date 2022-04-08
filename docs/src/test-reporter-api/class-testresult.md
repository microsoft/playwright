# class: TestResult
* langs: js

A result of a single [TestCase] run.

## property: TestResult.attachments
- type: <[Array]<[Object]>>
  - `name` <[string]> Attachment name.
  - `contentType` <[string]> Content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`.
  - `path` ?<[string]> Optional path on the filesystem to the attached file.
  - `body` ?<[Buffer]> Optional attachment body used instead of a file.

The list of files or buffers attached during the test execution through [`property: TestInfo.attachments`].

## property: TestResult.duration
- type: <[float]>

Running time in milliseconds.

## property: TestResult.error
- type: ?<[TestError]>

First error thrown during test execution, if any. This is equal to the first
element in [`property: TestResult.errors`].

## property: TestResult.errors
- type: <[Array]<[TestError]>>

Errors thrown during the test execution.

## property: TestResult.retry
- type: <[int]>

When test is retries multiple times, each retry attempt is given a sequential number.

Learn more about [test retries](../test-retries.md#retries).

## property: TestResult.startTime
- type: <[Date]>

Start time of this particular test run.

## property: TestResult.status
- type: <[TestStatus]<"passed"|"failed"|"timedOut"|"skipped">>

The status of this test result. See also [`property: TestCase.expectedStatus`].

## property: TestResult.stderr
- type: <[Array]<[string]|[Buffer]>>

Anything written to the standard error during the test run.

## property: TestResult.stdout
- type: <[Array]<[string]|[Buffer]>>

Anything written to the standard output during the test run.

## property: TestResult.steps
- type: <[Array]<[TestStep]>>

List of steps inside this test run.

## property: TestResult.workerIndex
- type: <[int]>

Index of the worker where the test was run. If the test was not run a single time, for example when the user interrupted testing, the only result will have a `workerIndex` equal to `-1`.

Learn more about [parallelism and sharding](../test-parallel.md) with Playwright Test.
