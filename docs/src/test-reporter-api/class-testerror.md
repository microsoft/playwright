# class: TestError
* since: v1.10
* langs: js

Information about an error thrown during test execution.

## property: TestError.message
* since: v1.10
- type: ?<[string]>

Error message. Set when [Error] (or its subclass) has been thrown.

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
