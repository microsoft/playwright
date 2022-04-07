# class: TestError
* langs: js

Information about an error thrown during test execution.

## property: TestError.message
- type: ?<[string]>

Error message. Set when [Error] (or its subclass) has been thrown.

## property: TestError.stack
- type: ?<[string]>

Error stack. Set when [Error] (or its subclass) has been thrown.

## property: TestError.value
- type: ?<[string]>

The value that was thrown. Set when anything except the [Error] (or its subclass) has been thrown.
