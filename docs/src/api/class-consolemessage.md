# class: ConsoleMessage

[ConsoleMessage] objects are dispatched by page via the [`event: Page.console`] event.

## method: ConsoleMessage.args
- returns: <[Array]<[JSHandle]>>

List or arguments passed to a `console` function call.

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await Promise.all([
    page.evaluate(() => console.log('hello', 5, {foo: 'bar'})),
    page.waitForEvent('console')
  ]);
  console.log(await message.args()[0].jsonValue()); // It will print 'hello'
  console.log(await message.args()[1].jsonValue()); // It will print 5
  console.log((await message.args()[2].jsonValue()).foo); // It will print 'bar'
  await browser.close();
})();
```

## method: ConsoleMessage.location
* langs: js, python
- returns: <[Object]>
  - `url` <[string]> URL of the resource.
  - `lineNumber` <[int]> 0-based line number in the resource.
  - `columnNumber` <[int]> 0-based column number in the resource.

## method: ConsoleMessage.location
* langs: csharp, java
- returns: <[string]>

URL of the resource followed by 0-based line and column numbers in the resource formatted as `URL:line:column`.

## method: ConsoleMessage.text
- returns: <[string]>

The text of the console message.

## method: ConsoleMessage.type
- returns: <[string]>

One of the following values: `'log'`, `'debug'`, `'info'`, `'error'`, `'warning'`, `'dir'`, `'dirxml'`, `'table'`,
`'trace'`, `'clear'`, `'startGroup'`, `'startGroupCollapsed'`, `'endGroup'`, `'assert'`, `'profile'`, `'profileEnd'`,
`'count'`, `'timeEnd'`.
