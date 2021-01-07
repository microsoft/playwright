# class: ConsoleMessage

[ConsoleMessage] objects are dispatched by page via the [`event: Page.console`] event.

## method: ConsoleMessage.args
- returns: <[Array]<[JSHandle]>>

## method: ConsoleMessage.location
- returns: <[Object]>
  - `url` <[string]> URL of the resource.
  - `lineNumber` <[int]> 0-based line number in the resource.
  - `columnNumber` <[int]> 0-based column number in the resource.

## method: ConsoleMessage.text
- returns: <[string]>

## method: ConsoleMessage.type
- returns: <[string]>

One of the following values: `'log'`, `'debug'`, `'info'`, `'error'`, `'warning'`, `'dir'`, `'dirxml'`, `'table'`,
`'trace'`, `'clear'`, `'startGroup'`, `'startGroupCollapsed'`, `'endGroup'`, `'assert'`, `'profile'`, `'profileEnd'`,
`'count'`, `'timeEnd'`.
