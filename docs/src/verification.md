---
id: verification
title: "Verification"
---

:::note
Playwright has [Web-First Assertions](./api/class-playwrightassertions) which automatically retry until the expected condition is met. This helps to reduce flakiness and readability of tests.
:::

<!-- TOC -->

## Text content

```js
const content = await page.locator('nav:first-child').textContent();
expect(content).toBe('home');
```

```java
String content = page.locator("nav:first-child").textContent();
assertEquals("home", content);
```

```python async
content = await page.locator("nav:first-child").text_content()
assert content == "home"
```

```python sync
content = page.locator("nav:first-child").text_content()
assert content == "home"
```

```csharp
var content = await page.Locator("nav:first-child").TextContentAsync();
Assert.AreEqual("home", content);
```

### API reference
- [`method: Page.textContent`]
- [`method: ElementHandle.textContent`]

## Inner text

```js
const text = await page.locator('.selected').innerText();
expect(text).toBe('value');
```

```java
String text = page.locator(".selected").innerText();
assertEquals("value", text);
```

```python async
text = await page.locator(".selected").inner_text()
assert text == "value"
```

```python sync
text = page.locator(".selected").inner_text()
assert text == "value"
```

```csharp
var content = await page.Locator(".selected").InnerTextAsync();
Assert.AreEqual("value", content);
```

### API reference
- [`method: Page.innerText`]
- [`method: ElementHandle.innerText`]

## Attribute value

```js
const alt = await page.locator('input').getAttribute('alt');
expect(alt).toBe('Text');
```

```java
String alt = page.locator("input").getAttribute("alt");
assertEquals("Text", alt);
```

```python async
alt = await page.locator("input").get_attribute("alt")
assert alt == "Text"
```

```python sync
alt = page.locator("input").get_attribute("alt")
assert alt == "Text"
```

```csharp
var value = await page.Locator("input").GetAttributeAsync("alt");
Assert.AreEqual("Text", value);
```

## Checkbox state

```js
const checked = await page.locator('input').isChecked();
expect(checked).toBeTruthy();
```

```java
boolean checked = page.locator("input").isChecked();
assertTrue(checked);
```

```python async
checked = await page.locator("input").is_checked()
assert checked
```

```python sync
checked = page.locator("input").is_checked()
assert checked
```

```csharp
var checked = await page.Locator("input").IsCheckedAsync();
Assert.True(checked);
```

### API reference
- [`method: Page.isChecked`]
- [`method: ElementHandle.isChecked`]

## Text content

```js
const content = await page.locator('nav:first-child').textContent();
expect(content).toBe('home');
```

```java
Object content = page.locator("nav:first-child").textContent();
assertEquals("home", content);
```

```python async
content = await page.locator("nav:first-child").text_content()
assert content == "home"
```

```python sync
content = page.locator("nav:first-child").text_content()
assert content == "home"
```

```csharp
var content = await page.locator("nav:first-child").TextContentAsync();
Assert.AreEqual("home", content);
```

### API reference
- [`method: Page.evalOnSelector`]
- [`method: JSHandle.evaluate`]

## Inner HTML

```js
const html = await page.locator('div.result').innerHTML();
expect(html).toBe('<p>Result</p>');
```

```java
String html = page.locator("div.result").innerHTML();
assertEquals("<p>Result</p>", html);
```

```python async
html = await page.locator("div.result").inner_html()
assert html == "<p>Result</p>"
```

```python sync
html = page.locator("div.result").inner_html()
assert html == "<p>Result</p>"
```

```csharp
var html = await page.Locator("div.result").InnerHTMLAsync();
Assert.AreEqual("<p>Result</p>", html);
```

### API reference
- [`method: Page.innerHTML`]
- [`method: ElementHandle.innerHTML`]

## Visibility

```js
const visible = await page.locator('input').isVisible();
expect(visible).toBeTruthy();
```

```java
boolean visible = page.locator("input").isVisible();
assertTrue(visible);
```

```python async
visible = await page.locator("input").is_visible()
assert visible
```

```python sync
visible = page.locator("input").is_visible()
assert visible
```

```csharp
var visibility = await page.Locator("input").IsVisibleAsync();
Assert.True(visibility);
```

### API reference
- [`method: Page.isVisible`]
- [`method: ElementHandle.isVisible`]

## Enabled state

```js
const enabled = await page.locator('input').isEnabled();
expect(enabled).toBeTruthy();
```

```java
boolean enabled = page.locator("input").isEnabled();
assertTrue(enabled);
```

```python async
enabled = await page.locator("input").is_enabled()
assert enabled
```

```python sync
enabled = page.locator("input").is_enabled()
assert enabled
```

```csharp
var enabled = await page.Locator("input").IsEnabledAsync();
Assert.True(enabled);
```

### API reference
- [`method: Page.isEnabled`]
- [`method: ElementHandle.isEnabled`]

## Custom assertions

With Playwright, you can also write custom JavaScript to run in the context of
the browser. This is useful in situations where you want to assert for values
that are not covered by the convenience APIs above.

```js
// Assert local storage value
const userId = page.evaluate(() => window.localStorage.getItem('userId'));
expect(userId).toBeTruthy();

// Assert value for input element
const value = await page.locator('#search').inputValue();
expect(value === 'query').toBeTruthy();

// Assert computed style
const fontSize = await page.locator('div').evaluate(el => window.getComputedStyle(el).fontSize);
expect(fontSize === '16px').toBeTruthy();

// Assert list length
const length = await page.locator('li.selected').count();
expect(length === 3).toBeTruthy();
```

```java
// Assert local storage value
Object userId = page.evaluate("() => window.localStorage.getItem('userId')");
assertNotNull(userId);

// Assert value for input element
Object value = page.locator("#search").inputValue();
assertEquals("query", value);

// Assert computed style
Object fontSize = page.locator("div").evaluate("el => window.getComputedStyle(el).fontSize");
assertEquals("16px", fontSize);

// Assert list length
Object length = page.locator("li.selected").count();
assertEquals(3, length);
```

```python async
# Assert local storage value
user_id = page.evaluate("() => window.localStorage.getItem('user_id')")
assert user_id

# Assert value for input element
value = await page.locator('#search').input_value()
assert value == 'query'

# Assert computed style
font_size = await page.locator('div').evaluate('el => window.getComputedStyle(el).fontSize')
assert font_size == '16px'

# Assert list length
length = await page.locator('li.selected').count()
assert length == 3
```

```python sync
# Assert local storage value
user_id = page.evaluate("() => window.localStorage.getItem('user_id')")
assert user_id

# Assert value for input element
value = page.locator('#search').input_value()
assert value == 'query'

# Assert computed style
font_size = page.locator('div').evaluate('el => window.getComputedStyle(el).fontSize')
assert font_size == '16px'

# Assert list length
length = page.locator('li.selected').count()
assert length == 3
```

```csharp
// Assert local storage value
var userId = await page.EvaluateAsync<string>("() => window.localStorage.getItem('userId')");
Assert.NotNull(userId);

// Assert value for input element
var value = await page.Locator("#search").InputValueAsync();
Assert.AreEqual("query", value);

// Assert computed style
var fontSize = await page.Locator("div").EvalOnSelectorAsync<string>("el => window.getComputedStyle(el).fontSize");
Assert.AreEqual("16px", fontSize);

// Assert list length
var length = await page.Locator("li.selected").CountAsync();
Assert.AreEqual(3, length);
```


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
