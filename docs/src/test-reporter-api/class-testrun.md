# class: TestRun
* since: v1.62
* langs: js

Controls which tests will run and their expected status, and provides information about suite execution modes. A [TestRun] is available during [`method: Reporter.preprocess`]. Setup and teardown projects cannot be changed.

## method: TestRun.exclude
* since: v1.62

Excludes a test or suite from the run. Excluded tests do not appear in the report and their bodies are not executed.

### param: TestRun.exclude.test
* since: v1.62
- `test` <[TestCase]|[Suite]>

Test or suite to exclude. The root suite cannot be excluded.

## method: TestRun.fail
* since: v1.62

Marks a test or every test in a suite as "should fail". Playwright runs the tests and ensures they are actually failing, useful for documenting broken functionality until it is fixed.

### param: TestRun.fail.test
* since: v1.62
- `test` <[TestCase]|[Suite]>

Test or suite to mark as expected-to-fail.

### param: TestRun.fail.reason
* since: v1.62
- `reason` ?<[string]>

Optional explanation surfaced as the annotation description.

## method: TestRun.fixme
* since: v1.62

Marks a test or every test in a suite as fixme. The test bodies are not executed and the tests are reported as skipped, with the intention to fix them.

### param: TestRun.fixme.test
* since: v1.62
- `test` <[TestCase]|[Suite]>

Test or suite to mark as fixme.

### param: TestRun.fixme.reason
* since: v1.62
- `reason` ?<[string]>

Optional explanation surfaced as the annotation description.

## method: TestRun.mode
* since: v1.65
- returns: "TestMode" <"serial"|"parallel"|"default">

Returns the execution mode configured for a suite with [`method: Test.describe.configure`], [`method: Test.describe.serial`] or [`method: Test.describe.parallel`].
If the suite does not configure a mode, it inherits its parent's mode. Project suites use `"parallel"` when [`property: TestProject.fullyParallel`] is enabled, and `"default"` otherwise. The root suite uses `"default"`.

An explicit `"default"` suite does not inherit `"parallel"` from its parent: its tests run in order in the same worker. The mode alone does not describe complete test groups, which also depend on worker fixtures and hooks.

This method can only be called during [`method: Reporter.preprocess`], and can also inspect setup and teardown projects.

### param: TestRun.mode.suite
* since: v1.65
- `suite` <[Suite]>

Suite to inspect.

## method: TestRun.skip
* since: v1.62

Skips a test or every test in a suite. The test bodies are not executed and the tests are reported as skipped.

### param: TestRun.skip.test
* since: v1.62
- `test` <[TestCase]|[Suite]>

Test or suite to skip.

### param: TestRun.skip.reason
* since: v1.62
- `reason` ?<[string]>

Optional explanation surfaced as the annotation description.

## method: TestRun.skipSharding
* since: v1.62

Disables Playwright's built-in shard filter for this run, leaving sharding to the reporter. Reporters typically implement their own sharding by calling [`method: TestRun.exclude`] on out-of-shard tests.
