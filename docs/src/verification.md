---
id: verification
title: "Verification"
---

<!-- TOC -->

## Console logs

Console messages logged in the page can be brought into the Playwright context.

```js
// Listen for all console logs
page.on('console', msg => console.log(msg.text()))

// Listen for all console events and handle errors
page.on('console', msg => {
  if (msg.type() === 'error')
    console.log(`Error text: "${msg.text()}"`);
});

// Get the next console log
const [msg] = await Promise.all([
  page.waitForEvent('console'),
  // Issue console.log inside the page
  page.evaluate(() => {
    console.log('hello', 42, { foo: 'bar' });
  }),
]);

// Deconstruct console log arguments
await msg.args[0].jsonValue() // hello
await msg.args[1].jsonValue() // 42
```

```java
// Listen for all System.out.printlns
page.onConsoleMessage(msg -> System.out.println(msg.text()));

// Listen for all console events and handle errors
page.onConsoleMessage(msg -> {
  if ("error".equals(msg.type()))
    System.out.println("Error text: " + msg.text());
});

// Get the next System.out.println
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
// Listen for all System.out.printlns
page.Console += (_, msg) => Console.WriteLine(msg.Text);

// Listen for all console events and handle errors
page.Console += (_, msg) =>
{
    if ("error".Equals(msg.Type))
        Console.WriteLine("Error text: " + msg.Text);
};

// Get the next System.out.println
var waitForMessageTask = page.WaitForConsoleMessageAsync();
await page.EvaluateAsync("console.log('hello', 42, { foo: 'bar' });");
var message = await waitForMessageTask;
// Deconstruct console.log arguments
await message.Args.ElementAt(0).JsonValueAsync<string>(); // hello
await message.Args.ElementAt(1).JsonValueAsync<int>(); // 42
```

### API reference
- [ConsoleMessage]
- [Page]
- [`event: Page.console`]

<br/>

## Page errors

Listen for uncaught exceptions in the page with the `pagerror` event.

```js
// Log all uncaught errors to the terminal
page.on('pageerror', exception => {
  console.log(`Uncaught exception: "${exception}"`);
});

// Navigate to a page with an exception.
await page.goto('data:text/html,<script>throw new Error("Test")</script>');
```

```java
// Log all uncaught errors to the terminal
page.onPageError(exception -> {
  System.out.println("Uncaught exception: " + exception);
});

// Navigate to a page with an exception.
page.navigate("data:text/html,<script>throw new Error('Test')</script>");
```

```python async
# Log all uncaught errors to the terminal
page.on("pageerror", lambda exc: print(f"uncaught exception: {exc}"))

# Navigate to a page with an exception.
await page.goto("data:text/html,<script>throw new Error('test')</script>")
```

```python sync
# Log all uncaught errors to the terminal
page.on("pageerror", lambda exc: print(f"uncaught exception: {exc}"))

# Navigate to a page with an exception.
page.goto("data:text/html,<script>throw new Error('test')</script>")
```

```csharp
// Log all uncaught errors to the terminal
page.PageError += (_, exception) =>
{
  Console.WriteLine("Uncaught exception: " + exception);
};
```

### API reference
- [Page]
- [`event: Page.pageError`]

<br/>

## Page events

#### `"requestfailed"`

```js
page.on('requestfailed', request => {
  console.log(request.url() + ' ' + request.failure().errorText);
});
```

```java
page.onRequestFailed(request -> {
  System.out.println(request.url() + " " + request.failure());
});
```

```python
page.on("requestfailed", lambda request: print(request.url + " " + request.failure.error_text))
```

#### `"dialog"` - handle alert, confirm, prompt

```js
page.on('dialog', dialog => {
  dialog.accept();
});
```

```java
page.onDialog(dialog -> {
  dialog.accept();
});
```

```python
page.on("dialog", lambda dialog: dialog.accept())
```

```csharp
page.RequestFailed += (_, request) =>
{
    Console.WriteLine(request.Url + " " + request.Failure);
};
```

#### `"popup"` - handle popup windows

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('#open')
]);
```

```java
Page popup = page.waitForPopup(() -> {
  page.click("#open");
});
```

```python async
async with page.expect_popup() as popup_info:
    await page.click("#open")
popup = await popup_info.value
```

```python sync
with page.expect_popup() as popup_info:
    page.click("#open")
popup = popup_info.value
```

```csharp
var popup = await page.RunAndWaitForPopupAsync(async () =>
{
    await page.ClickAsync("#open");
});
```

### API reference
- [Page]
- [`event: Page.requestFailed`]
- [`event: Page.dialog`]
- [`event: Page.popup`]
