# class: TestInfoError
* since: v1.10
* langs: js

Information about an error thrown during test execution.

## property: TestInfoError.cause
* since: v1.49
- type: ?<[TestInfoError]>

Error cause. Set when there is a [cause](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error/cause) for the error. Will be `undefined` if there is no cause or if the cause is not an instance of [Error].

## property: TestInfoError.message
* since: v1.10
- type: ?<[string]>

Error message. Set when [Error] (or its subclass) has been thrown.

## property: TestInfoError.stack
* since: v1.10
- type: ?<[string]>

Error stack. Set when [Error] (or its subclass) has been thrown.

## property: TestInfoError.matcherResult
* since: v1.60
- type: ?<[Object]>
  - `name` <[string]> Matcher name (e.g. `toBeVisible`).
  - `pass` <[boolean]> Whether the matcher passed.
  - `expected` ?<[any]> Expected value.
  - `actual` ?<[any]> Received value.
  - `log` ?<[Array]<[string]>> Matcher log lines, if any.
  - `timeout` ?<[int]> Matcher timeout in milliseconds, set when the matcher timed out.
  - `ariaSnapshot` ?<[string]> Aria snapshot of the receiver at the time of failure, if available.

Structured information about a matcher failure. Set when the error originated from an `expect(...)` matcher; unset otherwise.

## property: TestInfoError.value
* since: v1.10
- type: ?<[string]>

The value that was thrown. Set when anything except the [Error] (or its subclass) has been thrown.
