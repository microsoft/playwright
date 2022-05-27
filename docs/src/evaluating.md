---
id: evaluating
title: "Evaluating JavaScript"
---

Playwright scripts run in your Playwright environment. Your page scripts run in the browser page environment. Those environments don't intersect, they are running in different virtual machines in different processes and even potentially on different computers.

The [`method: Page.evaluate`] API can run a JavaScript function in the context
of the web page and bring results back to the Playwright environment. Browser globals like
`window` and `document` can be used in `evaluate`.

```js
const href = await page.evaluate(() => document.location.href);
```

```java
String href = (String) page.evaluate("document.location.href");
```

```python async
href = await page.evaluate('() => document.location.href')
```

```python sync
href = page.evaluate('() => document.location.href')
```

```csharp
var href = await page.EvaluateAsync<string>("document.location.href");
```

If the result is a Promise or if the function is asynchronous evaluate will automatically wait until it's resolved:

```js
const status = await page.evaluate(async () => {
  const response = await fetch(location.href);
  return response.status;
});
```

```java
int status = (int) page.evaluate("async () => {\n" +
  "  const response = await fetch(location.href);\n" +
  "  return response.status;\n" +
  "}");
```

```python async
status = await page.evaluate("""async () => {
  response = await fetch(location.href)
  return response.status
}""")
```

```python sync
status = page.evaluate("""async () => {
  response = await fetch(location.href)
  return response.status
}""")
```

```csharp
int status = await page.EvaluateAsync<int>(@"async () => {
  const response = await fetch(location.href);
  return response.status;
}");
```

## Evaluation Argument

Playwright evaluation methods like [`method: Page.evaluate`] take a single optional argument. This argument can be a mix of [Serializable] values and [JSHandle] or [ElementHandle] instances. Handles are automatically converted to the value they represent.

```js
// A primitive value.
await page.evaluate(num => num, 42);

// An array.
await page.evaluate(array => array.length, [1, 2, 3]);

// An object.
await page.evaluate(object => object.foo, { foo: 'bar' });

// A single handle.
const button = await page.evaluate('window.button');
await page.evaluate(button => button.textContent, button);

// Alternative notation using elementHandle.evaluate.
await button.evaluate((button, from) => button.textContent.substring(from), 5);

// Object with multiple handles.
const button1 = await page.evaluate('window.button1');
const button2 = await page.evaluate('window.button2');
await page.evaluate(
    o => o.button1.textContent + o.button2.textContent,
    { button1, button2 });

// Object destructuring works. Note that property names must match
// between the destructured object and the argument.
// Also note the required parenthesis.
await page.evaluate(
    ({ button1, button2 }) => button1.textContent + button2.textContent,
    { button1, button2 });

// Array works as well. Arbitrary names can be used for destructuring.
// Note the required parenthesis.
await page.evaluate(
    ([b1, b2]) => b1.textContent + b2.textContent,
    [button1, button2]);

// Any non-cyclic mix of serializables and handles works.
await page.evaluate(
    x => x.button1.textContent + x.list[0].textContent + String(x.foo),
    { button1, list: [button2], foo: null });
```

```java
// A primitive value.
page.evaluate("num => num", 42);

// An array.
page.evaluate("array => array.length", Arrays.asList(1, 2, 3));

// An object.
Map<String, Object> obj = new HashMap<>();
obj.put("foo", "bar");
page.evaluate("object => object.foo", obj);

// A single handle.
ElementHandle button = page.evaluate("window.button");
page.evaluate("button => button.textContent", button);

// Alternative notation using elementHandle.evaluate.
button.evaluate("(button, from) => button.textContent.substring(from)", 5);

// Object with multiple handles.
ElementHandle button1 = page.evaluate("window.button1");
ElementHandle button2 = page.evaluate("window.button2");
Map<String, ElementHandle> arg = new HashMap<>();
arg.put("button1", button1);
arg.put("button2", button2);
page.evaluate("o => o.button1.textContent + o.button2.textContent", arg);

// Object destructuring works. Note that property names must match
// between the destructured object and the argument.
// Also note the required parenthesis.
Map<String, ElementHandle> arg = new HashMap<>();
arg.put("button1", button1);
arg.put("button2", button2);
page.evaluate("({ button1, button2 }) => button1.textContent + button2.textContent", arg);

// Array works as well. Arbitrary names can be used for destructuring.
// Note the required parenthesis.
page.evaluate(
  "([b1, b2]) => b1.textContent + b2.textContent",
  Arrays.asList(button1, button2));

// Any non-cyclic mix of serializables and handles works.
Map<String, Object> arg = new HashMap<>();
arg.put("button1", button1);
arg.put("list", Arrays.asList(button2));
arg.put("foo", 0);
page.evaluate(
  "x => x.button1.textContent + x.list[0].textContent + String(x.foo)",
  arg);
```

```python async
# A primitive value.
await page.evaluate('num => num', 42)

# An array.
await page.evaluate('array => array.length', [1, 2, 3])

# An object.
await page.evaluate('object => object.foo', { 'foo': 'bar' })

# A single handle.
button = await page.evaluate('button')
await page.evaluate('button => button.textContent', button)

# Alternative notation using elementHandle.evaluate.
await button.evaluate('(button, from) => button.textContent.substring(from)', 5)

# Object with multiple handles.
button1 = await page.query_selector('window.button1')
button2 = await page.query_selector('window.button2')
await page.evaluate("""
    o => o.button1.textContent + o.button2.textContent""",
    { 'button1': button1, 'button2': button2 })

# Object destructuring works. Note that property names must match
# between the destructured object and the argument.
# Also note the required parenthesis.
await page.evaluate("""
    ({ button1, button2 }) => button1.textContent + button2.textContent""",
    { 'button1': button1, 'button2': button2 })

# Array works as well. Arbitrary names can be used for destructuring.
# Note the required parenthesis.
await page.evaluate("""
    ([b1, b2]) => b1.textContent + b2.textContent""",
    [button1, button2])

# Any non-cyclic mix of serializables and handles works.
await page.evaluate("""
    x => x.button1.textContent + x.list[0].textContent + String(x.foo)""",
    { 'button1': button1, 'list': [button2], 'foo': None })
```

```python sync
# A primitive value.
page.evaluate('num => num', 42)

# An array.
page.evaluate('array => array.length', [1, 2, 3])

# An object.
page.evaluate('object => object.foo', { 'foo': 'bar' })

# A single handle.
button = page.evaluate('window.button')
page.evaluate('button => button.textContent', button)

# Alternative notation using elementHandle.evaluate.
button.evaluate('(button, from) => button.textContent.substring(from)', 5)

# Object with multiple handles.
button1 = page.evaluate('window.button1')
button2 = page.evaluate('.button2')
page.evaluate("""o => o.button1.textContent + o.button2.textContent""",
    { 'button1': button1, 'button2': button2 })

# Object destructuring works. Note that property names must match
# between the destructured object and the argument.
# Also note the required parenthesis.
page.evaluate("""
    ({ button1, button2 }) => button1.textContent + button2.textContent""",
    { 'button1': button1, 'button2': button2 })

# Array works as well. Arbitrary names can be used for destructuring.
# Note the required parenthesis.
page.evaluate("""
    ([b1, b2]) => b1.textContent + b2.textContent""",
    [button1, button2])

# Any non-cyclic mix of serializables and handles works.
page.evaluate("""
    x => x.button1.textContent + x.list[0].textContent + String(x.foo)""",
    { 'button1': button1, 'list': [button2], 'foo': None })
```

```csharp
// A primitive value.
await page.EvaluateAsync<int>("num => num", 42);

// An array.
await page.EvaluateAsync<int[]>("array => array.length", new[] { 1, 2, 3 });

// An object.
await page.EvaluateAsync<object>("object => object.foo", new { foo = "bar" });

// A single handle.
var button = await page.EvaluateAsync("window.button");
await page.EvaluateAsync<IJSHandle>("button => button.textContent", button);

// Alternative notation using elementHandle.EvaluateAsync.
await button.EvaluateAsync<string>("(button, from) => button.textContent.substring(from)", 5);

// Object with multiple handles.
var button1 = await page.EvaluateAsync("window.button1");
var button2 = await page.EvaluateAsync("window.button2");
await page.EvaluateAsync("o => o.button1.textContent + o.button2.textContent", new { button1, button2 });

// Object destructuring works. Note that property names must match
// between the destructured object and the argument.
// Also note the required parenthesis.
await page.EvaluateAsync("({ button1, button2 }) => button1.textContent + button2.textContent", new { button1, button2 });

// Array works as well. Arbitrary names can be used for destructuring.
// Note the required parenthesis.
await page.EvaluateAsync("([b1, b2]) => b1.textContent + b2.textContent", new[] { button1, button2 });

// Any non-cyclic mix of serializables and handles works.
await page.EvaluateAsync("x => x.button1.textContent + x.list[0].textContent + String(x.foo)", new { button1, list = new[] { button2 }, foo = null as object });
```

Right:

```js
const data = { text: 'some data', value: 1 };
// Pass |data| as a parameter.
const result = await page.evaluate(data => {
  window.myApp.use(data);
}, data);
```

```java
Map<String, Object> data = new HashMap<>();
data.put("text", "some data");
data.put("value", 1);
// Pass |data| as a parameter.
Object result = page.evaluate("data => {\n" +
  "  window.myApp.use(data);\n" +
  "}", data);
```

```python async
data = { 'text': 'some data', 'value': 1 }
# Pass |data| as a parameter.
result = await page.evaluate("""data => {
  window.myApp.use(data)
}""", data)
```

```python sync
data = { 'text': 'some data', 'value': 1 }
# Pass |data| as a parameter.
result = page.evaluate("""data => {
  window.myApp.use(data)
}""", data)
```

```csharp
var data = new { text = "some data", value = 1};
// Pass data as a parameter
var result = await page.EvaluateAsync("data => { window.myApp.use(data); }", data);
```

Wrong:

```js
const data = { text: 'some data', value: 1 };
const result = await page.evaluate(() => {
  // There is no |data| in the web page.
  window.myApp.use(data);
});
```

```java
Map<String, Object> data = new HashMap<>();
data.put("text", "some data");
data.put("value", 1);
Object result = page.evaluate("() => {\n" +
  "  // There is no |data| in the web page.\n" +
  "  window.myApp.use(data);\n" +
  "}");
```

```python async
data = { 'text': 'some data', 'value': 1 }
result = await page.evaluate("""() => {
  # There is no |data| in the web page.
  window.myApp.use(data)
}""")
```

```python sync
data = { 'text': 'some data', 'value': 1 }
result = page.evaluate("""() => {
  # There is no |data| in the web page.
  window.myApp.use(data)
}""")
```

```csharp
var data = new { text = "some data", value = 1};
// Pass data as a parameter
var result = await page.EvaluateAsync(@"data => {
  // There is no |data| in the web page.
  window.myApp.use(data);
}");
```
