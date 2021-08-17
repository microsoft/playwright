# class: TestStep
* langs: js

Represents a step in the [TestRun].

## property: TestStep.category
- type: <[string]>

Step category to differentiate steps with different origin and verbosity. Built-in categories are:
* `hook` for fixtures and hooks initialization and teardown
* `expect` for expect calls
* `pw:api` for Playwright API calls.

## property: TestStep.duration
- type: <[float]>

Running time in milliseconds.

## property: TestStep.error
- type: <[void]|[TestError]>

An error thrown during the step execution, if any.

## property: TestStep.startTime
- type: <[Date]>

Start time of this particular test step.

## property: TestStep.steps
- type: <[Array]<[TestStep]>>

List of steps inside this step.

## property: TestStep.title
- type: <[string]>

User-friendly test step title.
