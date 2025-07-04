# class: TestStep
* since: v1.10
* langs: js

Represents a step in the [TestRun].

## property: TestStep.category
* since: v1.10
- type: <[string]>

Step category to differentiate steps with different origin and verbosity. Built-in categories are:
* `expect` for expect calls
* `fixture` for fixtures setup and teardown
* `hook` for hooks initialization and teardown
* `pw:api` for Playwright API calls.
* `test.step` for test.step API calls.
* `test.attach` for test attachmen calls.


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

## property: TestStep.annotations
* since: v1.51
- type: <[Array]<[Object]>>
  - `type` <[string]> Annotation type, for example `'skip'`.
  - `description` ?<[string]> Optional description.
  - `location` ?<[Location]> Optional location in the source where the annotation is added.

The list of annotations applicable to the current test step.

## property: TestStep.attachments
* since: v1.50
- type: <[Array]<[Object]>>
  - `name` <[string]> Attachment name.
  - `contentType` <[string]> Content type of this attachment to properly present in the report, for example `'application/json'` or `'image/png'`.
  - `path` ?<[string]> Optional path on the filesystem to the attached file.
  - `body` ?<[Buffer]> Optional attachment body used instead of a file.

The list of files or buffers attached in the step execution through [`method: TestInfo.attach`].

## property: TestStep.title
* since: v1.10
- type: <[string]>

User-friendly test step title.

## method: TestStep.titlePath
* since: v1.10
- returns: <[Array]<[string]>>

Returns a list of step titles from the root step down to this step.
