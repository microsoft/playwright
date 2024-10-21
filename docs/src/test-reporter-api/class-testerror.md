# class: TestError
* since: v1.10
* langs: js

Information about an error thrown during test execution.

## property: TestError.expected
* since: v1.49
- type: ?<[string]>

Expected value formatted as a human-readable string.

## property: TestError.locator
* since: v1.49
- type: ?<[string]>

Receiver's locator.

## property: TestError.log
* since: v1.49
- type: ?<[Array]<[string]>>

Call log.

## property: TestError.matcherName
* since: v1.49
- type: ?<[string]>

Expect matcher name.

## property: TestError.message
* since: v1.10
- type: ?<[string]>

Error message. Set when [Error] (or its subclass) has been thrown.

## property: TestError.received
* since: v1.49
- type: ?<[string]>

Received value formatted as a human-readable string.

## property: TestError.stack
* since: v1.10
- type: ?<[string]>

Error stack. Set when [Error] (or its subclass) has been thrown.

## property: TestError.timeout
* since: v1.49
- type: ?<[int]>

Timeout in milliseconds, if the error was caused by a timeout.

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
