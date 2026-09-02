# class: TestStep
* since: v1.10
* langs: js

Represents a step in a [TestResult].

## property: TestStep.category
* since: v1.10
- type: <[string]>

Step category to differentiate steps with different origin and verbosity. Built-in categories are:
* `expect` for expect calls
* `fixture` for fixtures setup and teardown
* `hook` for hooks initialization and teardown
* `pw:api` for Playwright API calls.
* `test.step` for test.step API calls.
* `test.attach` for testInfo.attach API calls.


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

## property: TestStep.params
* since: v1.63
- type: ?<[Object]<[string], [any]>>

Step-dependent parameters, when available. For example, steps produced by the Playwright API calls contain the target
`locator` and the call arguments such as `url`, while [`method: Test.step`] steps contain the parameters passed by the
test author.

```js
// { locator: 'getByRole(\'button\')' }
await page.getByRole('button').click();

// { url: 'https://example.com' }
await page.goto('https://example.com');

// { locator: 'getByLabel(\'Password\')', value: 'secret' }
await page.getByLabel('Password').fill('secret');

// { orderId: 42 }
await test.step('checkout', async () => {
  // ...
}, { params: { orderId: 42 } });
```

To keep the reports small, Playwright API calls only report a curated set of arguments per call, and long string values
are truncated. Unbounded arguments such as the page content, evaluated expressions or request bodies are never
reported.

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

User-friendly test step title, for example `Click` or `Navigate`.

## property: TestStep.subtitle
* since: v1.63
- type: ?<[string]>

User-friendly test step subtitle that complements the title, when available. For Playwright API
calls, it is the target locator or the navigation url. For example, a `Click` step has the clicked
locator as a subtitle. User interfaces typically render the subtitle next to the title or on a
separate line.

```js
// title `Click`, subtitle `getByRole('button')`
await page.getByRole('button').click();

// title `Navigate`, subtitle `example.com/index.html`
await page.goto('https://example.com/index.html');
```

## method: TestStep.titlePath
* since: v1.10
- returns: <[Array]<[string]>>

Returns a list of step titles from the root step down to this step.
