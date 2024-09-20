---
id: evaluating
title: "Evaluating JavaScript"
---

## Introduction

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

## Different environments

Evaluated scripts run in the browser environment, while your test runs in a testing environments. This means you cannot use variables from your test in the page and vice versa. Instead, you should pass them explicitly as an argument.

The following snippet is **WRONG** because it uses the variable directly:

```js
const data = 'some data';
const result = await page.evaluate(() => {
  // WRONG: there is no "data" in the web page.
  window.myApp.use(data);
});
```

```java
String data = "some data";
Object result = page.evaluate("() => {\n" +
  "  // WRONG: there is no 'data' in the web page.\n" +
  "  window.myApp.use(data);\n" +
  "}");
```

```python async
data = "some data"
result = await page.evaluate("""() => {
  // WRONG: there is no "data" in the web page.
  window.myApp.use(data)
}""")
```

```python sync
data = "some data"
result = page.evaluate("""() => {
  // WRONG: there is no "data" in the web page.
  window.myApp.use(data)
}""")
```

```csharp
var data = "some data";
var result = await page.EvaluateAsync(@"() => {
  // WRONG: there is no 'data' in the web page.
  window.myApp.use(data);
}");
```

The following snippet is **CORRECT** because it passes the value explicitly as an argument:

```js
const data = 'some data';
// Pass |data| as a parameter.
const result = await page.evaluate(data => {
  window.myApp.use(data);
}, data);
```

```java
String data = "some data";
// Pass |data| as a parameter.
Object result = page.evaluate("data => {\n" +
  "  window.myApp.use(data);\n" +
  "}", data);
```

```python async
data = "some data"
# Pass |data| as a parameter.
result = await page.evaluate("""data => {
  window.myApp.use(data)
}""", data)
```

```python sync
data = "some data"
# Pass |data| as a parameter.
result = page.evaluate("""data => {
  window.myApp.use(data)
}""", data)
```

```csharp
var data = "some data";
// Pass |data| as a parameter.
var result = await page.EvaluateAsync("data => { window.myApp.use(data); }", data);
```

## Evaluation Argument

Playwright evaluation methods like [`method: Page.evaluate`] take a single optional argument. This argument can be a mix of [Serializable] values and [JSHandle] instances. Handles are automatically converted to the value they represent.

```js
// A primitive value.
await page.evaluate(num => num, 42);

// An array.
await page.evaluate(array => array.length, [1, 2, 3]);

// An object.
await page.evaluate(object => object.foo, { foo: 'bar' });

// A single handle.
const button = await page.evaluateHandle('window.button');
await page.evaluate(button => button.textContent, button);

// Alternative notation using JSHandle.evaluate.
await button.evaluate((button, from) => button.textContent.substring(from), 5);

// Object with multiple handles.
const button1 = await page.evaluateHandle('window.button1');
const button2 = await page.evaluateHandle('window.button2');
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

// Any mix of serializables and handles works.
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
ElementHandle button = page.evaluateHandle("window.button");
page.evaluate("button => button.textContent", button);

// Alternative notation using JSHandle.evaluate.
button.evaluate("(button, from) => button.textContent.substring(from)", 5);

// Object with multiple handles.
ElementHandle button1 = page.evaluateHandle("window.button1");
ElementHandle button2 = page.evaluateHandle("window.button2");
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

// Any mix of serializables and handles works.
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
button = await page.evaluate_handle('button')
await page.evaluate('button => button.textContent', button)

# Alternative notation using JSHandle.evaluate.
await button.evaluate('(button, from) => button.textContent.substring(from)', 5)

# Object with multiple handles.
button1 = await page.evaluate_handle('window.button1')
button2 = await page.evaluate_handle('window.button2')
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

# Any mix of serializables and handles works.
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
button = page.evaluate_handle('window.button')
page.evaluate('button => button.textContent', button)

# Alternative notation using JSHandle.evaluate.
button.evaluate('(button, from) => button.textContent.substring(from)', 5)

# Object with multiple handles.
button1 = page.evaluate_handle('window.button1')
button2 = page.evaluate_handle('.button2')
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

# Any mix of serializables and handles works.
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
var button = await page.EvaluateHandleAsync("window.button");
await page.EvaluateAsync<IJSHandle>("button => button.textContent", button);

// Alternative notation using JSHandle.EvaluateAsync.
await button.EvaluateAsync<string>("(button, from) => button.textContent.substring(from)", 5);

// Object with multiple handles.
var button1 = await page.EvaluateHandleAsync("window.button1");
var button2 = await page.EvaluateHandleAsync("window.button2");
await page.EvaluateAsync("o => o.button1.textContent + o.button2.textContent", new { button1, button2 });

// Object destructuring works. Note that property names must match
// between the destructured object and the argument.
// Also note the required parenthesis.
await page.EvaluateAsync("({ button1, button2 }) => button1.textContent + button2.textContent", new { button1, button2 });

// Array works as well. Arbitrary names can be used for destructuring.
// Note the required parenthesis.
await page.EvaluateAsync("([b1, b2]) => b1.textContent + b2.textContent", new[] { button1, button2 });

// Any mix of serializables and handles works.
await page.EvaluateAsync("x => x.button1.textContent + x.list[0].textContent + String(x.foo)", new { button1, list = new[] { button2 }, foo = null as object });
```

## Init scripts

Sometimes it is convenient to evaluate something in the page before it starts loading. For example, you might want to setup some mocks or test data.

In this case, use [`method: Page.addInitScript`] or [`method: BrowserContext.addInitScript`]. In the example below, we will replace `Math.random()` with a constant value.

First, create a `preload.js` file that contains the mock.

```js browser
// preload.js
Math.random = () => 42;
```

Next, add init script to the page.

```js
import { test, expect } from '@playwright/test';
import path from 'path';

test.beforeEach(async ({ page }) => {
  // Add script for every test in the beforeEach hook.
  // Make sure to correctly resolve the script path.
  await page.addInitScript({ path: path.resolve(__dirname, '../mocks/preload.js') });
});
```

```java
// In your test, assuming the "preload.js" file is in the "mocks" directory.
page.addInitScript(Paths.get("mocks/preload.js"));
```

```python async
# In your test, assuming the "preload.js" file is in the "mocks" directory.
await page.add_init_script(path="mocks/preload.js")
```

```python sync
# In your test, assuming the "preload.js" file is in the "mocks" directory.
page.add_init_script(path="mocks/preload.js")
```

```csharp
// In your test, assuming the "preload.js" file is in the "mocks" directory.
await Page.AddInitScriptAsync(scriptPath: "mocks/preload.js");
```

######
* langs: js

Alternatively, you can pass a function instead of creating a preload script file. This is more convenient for short or one-off scripts. You can also pass an argument this way.

```js
import { test, expect } from '@playwright/test';

// Add script for every test in the beforeEach hook.
test.beforeEach(async ({ page }) => {
  const value = 42;
  await page.addInitScript(value => {
    Math.random = () => value;
  }, value);
});
```
