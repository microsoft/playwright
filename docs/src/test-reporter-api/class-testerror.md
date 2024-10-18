# class: TestError
* since: v1.10
* langs: js

Information about an error thrown during test execution.

## property: TestError.actual
* since: v1.49
- type: ?<[string]>

Actual value.

## property: TestError.expected
* since: v1.49
- type: ?<[string]>

Expected value.

## property: TestError.locator
* since: v1.49
- type: ?<[string]>

Receiver's locator.

## property: TestError.log
* since: v1.49
- type: ?<[Array]<[string]>>

Call log.

## property: TestError.message
* since: v1.10
- type: ?<[string]>

Error message. Set when [Error] (or its subclass) has been thrown.

## property: TestError.message
* since: v1.10
- type: ?<[string]>

Error message. Set when [Error] (or its subclass) has been thrown.
## property: TestError.shortMessage
* since: v1.49
- type: ?<[string]>

Failure message.

## property: TestError.stack
* since: v1.10
- type: ?<[string]>

Error stack. Set when [Error] (or its subclass) has been thrown.

## property: TestError.value
* since: v1.10
- type: ?<[string]>

The value that was thrown. Set when anything except the [Error] (or its subclass) has been thrown.

## property: TestError.location
* since: v1.30
- type: ?<[Location]>

Error location in the source code.

## property: TestError.snippet
* since: v1.33
- type: ?<[string]>

Source code snippet with highlighted error.
