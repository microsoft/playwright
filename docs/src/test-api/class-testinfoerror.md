# class: TestInfoError
* since: v1.10
* langs: js

Information about an error thrown during test execution.

## property: TestInfoError.actual
* since: v1.49
- type: ?<[any]>

Actual value.

## property: TestInfoError.expected
* since: v1.49
- type: ?<[any]>

Expected value.

## property: TestInfoError.log
* since: v1.49
- type: ?<[Array]<[string]>>

Call log.

## property: TestInfoError.message
* since: v1.10
- type: ?<[string]>

Error message. Set when [Error] (or its subclass) has been thrown.

## property: TestInfoError.shortMessage
* since: v1.49
- type: ?<[string]>

Failure message.

## property: TestInfoError.stack
* since: v1.10
- type: ?<[string]>

Error stack. Set when [Error] (or its subclass) has been thrown.

## property: TestInfoError.value
* since: v1.10
- type: ?<[string]>

The value that was thrown. Set when anything except the [Error] (or its subclass) has been thrown.
