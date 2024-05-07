# class: TestCase
* since: v1.10
* langs: js

`TestCase` corresponds to every [`method: Test.(call)`] call in a test file. When a single [`method: Test.(call)`] is running in multiple projects or repeated multiple times, it will have multiple `TestCase` objects in corresponding projects' suites.

## property: TestCase.annotations
* since: v1.10
- type: <[Array]<[Object]>>
  - `type` <[string]> Annotation type, for example `'skip'` or `'fail'`.
  - `description` ?<[string]> Optional description.

The list of annotations applicable to the current test. Includes:
* annotations defined on the test or suite via [`method: Test.(call)`] and [`method: Test.describe`];
* annotations implicitly added by methods [`method: Test.skip`], [`method: Test.fixme`] and [`method: Test.fail`];
* annotations appended to [`property: TestInfo.annotations`] during the test execution.

Annotations are available during test execution through [`property: TestInfo.annotations`].

Learn more about [test annotations](../test-annotations.md).

## property: TestCase.expectedStatus
* since: v1.10
- type: <[TestStatus]<"passed"|"failed"|"timedOut"|"skipped"|"interrupted">>

Expected test status.
* Tests marked as [`method: Test.skip`] or [`method: Test.fixme`] are expected to be `'skipped'`.
* Tests marked as [`method: Test.fail`] are expected to be `'failed'`.
* Other tests are expected to be `'passed'`.

See also [`property: TestResult.status`] for the actual status.

## property: TestCase.id
* since: v1.25
- type: <[string]>

A test ID that is computed based on the test file name, test title and project name. The ID is unique within Playwright session.

## property: TestCase.location
* since: v1.10
- type: <[Location]>

Location in the source where the test is defined.

## method: TestCase.ok
* since: v1.10
- returns: <[boolean]>

Whether the test is considered running fine. Non-ok tests fail the test run with non-zero exit code.

## method: TestCase.outcome
* since: v1.10
- returns: <[TestOutcome]<"skipped"|"expected"|"unexpected"|"flaky">>

Testing outcome for this test. Note that outcome is not the same as [`property: TestResult.status`]:
* Test that is expected to fail and actually fails is `'expected'`.
* Test that passes on a second retry is `'flaky'`.

## property: TestCase.parent
* since: v1.10
- type: <[Suite]>

Suite this test case belongs to.

## property: TestCase.repeatEachIndex
* since: v1.10
- type: <[int]>

Contains the repeat index when running in "repeat each" mode. This mode is enabled by passing `--repeat-each` to the [command line](../test-cli.md).

## property: TestCase.results
* since: v1.10
- type: <[Array]<[TestResult]>>

Results for each run of this test.

## property: TestCase.retries
* since: v1.10
- type: <[int]>

The maximum number of retries given to this test in the configuration.

Learn more about [test retries](../test-retries.md#retries).

## property: TestCase.tags
* since: v1.42
- type: <[Array]<[string]>>

The list of tags defined on the test or suite via [`method: Test.(call)`] or [`method: Test.describe`], as well as `@`-tokens extracted from test and suite titles.

Learn more about [test tags](../test-annotations.md#tag-tests).

## property: TestCase.timeout
* since: v1.10
- type: <[float]>

The timeout given to the test. Affected by [`property: TestConfig.timeout`], [`property: TestProject.timeout`], [`method: Test.setTimeout`], [`method: Test.slow`] and [`method: TestInfo.setTimeout`].

## property: TestCase.title
* since: v1.10
- type: <[string]>

Test title as passed to the [`method: Test.(call)`] call.

## method: TestCase.titlePath
* since: v1.10
- returns: <[Array]<[string]>>

Returns a list of titles from the root down to this test.

## property: TestCase.type
* since: v1.44
- returns: <[TestCaseType]<"test">>

Returns "test". Useful for detecting test cases in [`method: Suite.entries`].
