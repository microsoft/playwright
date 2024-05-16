# class: ConsoleMessage
* since: v1.8

[ConsoleMessage] objects are dispatched by page via the [`event: Page.console`] event.
For each console message logged in the page there will be corresponding event in the Playwright
context.

```js
// Listen for all console logs
page.on('console', msg => console.log(msg.text()));

// Listen for all console events and handle errors
page.on('console', msg => {
  if (msg.type() === 'error')
    console.log(`Error text: "${msg.text()}"`);
});

// Get the next console log
const msgPromise = page.waitForEvent('console');
await page.evaluate(() => {
  console.log('hello', 42, { foo: 'bar' });  // Issue console.log inside the page
});
const msg = await msgPromise;

// Deconstruct console log arguments
await msg.args()[0].jsonValue(); // hello
await msg.args()[1].jsonValue(); // 42
```

```java
// Listen for all console messages and print them to the standard output.
page.onConsoleMessage(msg -> System.out.println(msg.text()));

// Listen for all console messages and print errors to the standard output.
page.onConsoleMessage(msg -> {
  if ("error".equals(msg.type()))
    System.out.println("Error text: " + msg.text());
});

// Get the next console message
ConsoleMessage msg = page.waitForConsoleMessage(() -> {
  // Issue console.log inside the page
  page.evaluate("console.log('hello', 42, { foo: 'bar' });");
});

// Deconstruct console.log arguments
msg.args().get(0).jsonValue() // hello
msg.args().get(1).jsonValue() // 42
```

```python async
# Listen for all console logs
page.on("console", lambda msg: print(msg.text))

# Listen for all console events and handle errors
page.on("console", lambda msg: print(f"error: {msg.text}") if msg.type == "error" else None)

# Get the next console log
async with page.expect_console_message() as msg_info:
    # Issue console.log inside the page
    await page.evaluate("console.log('hello', 42, { foo: 'bar' })")
msg = await msg_info.value

# Deconstruct print arguments
await msg.args[0].json_value() # hello
await msg.args[1].json_value() # 42
```

```python sync
# Listen for all console logs
page.on("console", lambda msg: print(msg.text))

# Listen for all console events and handle errors
page.on("console", lambda msg: print(f"error: {msg.text}") if msg.type == "error" else None)

# Get the next console log
with page.expect_console_message() as msg_info:
    # Issue console.log inside the page
    page.evaluate("console.log('hello', 42, { foo: 'bar' })")
msg = msg_info.value

# Deconstruct print arguments
msg.args[0].json_value() # hello
msg.args[1].json_value() # 42
```

```csharp
// Listen for all console messages and print them to the standard output.
page.Console += (_, msg) => Console.WriteLine(msg.Text);

// Listen for all console messages and print errors to the standard output.
page.Console += (_, msg) =>
{
    if ("error".Equals(msg.Type))
        Console.WriteLine("Error text: " + msg.Text);
};

// Get the next console message
var waitForMessageTask = page.WaitForConsoleMessageAsync();
await page.EvaluateAsync("console.log('hello', 42, { foo: 'bar' });");
var message = await waitForMessageTask;
// Deconstruct console.log arguments
await message.Args.ElementAt(0).JsonValueAsync<string>(); // hello
await message.Args.ElementAt(1).JsonValueAsync<int>(); // 42
```

## method: ConsoleMessage.args
* since: v1.8
- returns: <[Array]<[JSHandle]>>

List of arguments passed to a `console` function call. See also [`event: Page.console`].

## method: ConsoleMessage.location
* since: v1.8
* langs: js, python
- returns: <[Object]>
  - `url` <[string]> URL of the resource.
  - `lineNumber` <[int]> 0-based line number in the resource.
  - `columnNumber` <[int]> 0-based column number in the resource.

## method: ConsoleMessage.location
* since: v1.8
* langs: csharp, java
- returns: <[string]>

URL of the resource followed by 0-based line and column numbers in the resource formatted as `URL:line:column`.

## method: ConsoleMessage.page
* since: v1.34
- returns: <[null]|[Page]>

The page that produced this console message, if any.

## method: ConsoleMessage.text
* since: v1.8
- returns: <[string]>

The text of the console message.

## method: ConsoleMessage.type
* since: v1.8
- returns: <[string]>

One of the following values: `'log'`, `'debug'`, `'info'`, `'error'`, `'warning'`, `'dir'`, `'dirxml'`, `'table'`,
`'trace'`, `'clear'`, `'startGroup'`, `'startGroupCollapsed'`, `'endGroup'`, `'assert'`, `'profile'`, `'profileEnd'`,
`'count'`, `'timeEnd'`.
