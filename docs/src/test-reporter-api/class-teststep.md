# class: TestStep
* since: v1.10
* langs: js

Represents a step in the [TestRun].

## property: TestStep.category
* since: v1.10
- type: <[string]>

Step category to differentiate steps with different origin and verbosity. Built-in categories are:
* `hook` for fixtures and hooks initialization and teardown
* `expect` for expect calls
* `pw:api` for Playwright API calls.
* `test.step` for test.step API calls.

## property: TestStep.duration
* since: v1.10
- type: <[float]>

Running time in milliseconds.

## property: TestStep.location
* since: v1.10
- type: ?<[Location]>

Optional location in the source where the step is defined.

## property: TestStep.error
* since: v1.10
- type: ?<[TestError]>

Error thrown during the step execution, if any.

## property: TestStep.parent
* since: v1.10
- type: ?<[TestStep]>

Parent step, if any.

## property: TestStep.startTime
* since: v1.10
- type: <[Date]>

Start time of this particular test step.

## property: TestStep.steps
* since: v1.10
- type: <[Array]<[TestStep]>>

List of steps inside this step.

## property: TestStep.title
* since: v1.10
- type: <[string]>

User-friendly test step title.

## method: TestStep.titlePath
* since: v1.10
- returns: <[Array]<[string]>>

Returns a list of step titles from the root step down to this step.
