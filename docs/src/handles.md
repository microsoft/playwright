---
id: handles
title: "Handles"
---

## Introduction

Playwright can create handles to the page DOM elements or any other objects inside the
page. These handles live in the Playwright process, whereas the actual objects live
in the browser. There are two types of handles:
- [JSHandle] to reference any JavaScript objects in the page
- [ElementHandle] to reference DOM elements in the page, it has extra methods that allow
performing actions on the elements and asserting their properties.

Since any DOM element in the page is also a JavaScript object, any [ElementHandle] is
a [JSHandle] as well.

Handles are used to perform operations on those actual objects in the page. You can evaluate
on a handle, get handle properties, pass handle as an evaluation parameter, serialize page
object into JSON etc. See the [JSHandle] class API for these and methods.

### API reference
- [JSHandle]
- [ElementHandle]

Here is the easiest way to obtain a [JSHandle].

```js
const jsHandle = await page.evaluateHandle('window');
//  Use jsHandle for evaluations.
```

```java
JSHandle jsHandle = page.evaluateHandle("window");
//  Use jsHandle for evaluations.
```

```python async
js_handle = await page.evaluate_handle('window')
#  Use jsHandle for evaluations.
```

```python sync
js_handle = page.evaluate_handle('window')
#  Use jsHandle for evaluations.
```

```csharp
var jsHandle = await page.EvaluateHandleAsync("window");
//  Use jsHandle for evaluations.
```

## Element Handles

:::warning[Discouraged]
The use of [ElementHandle] is discouraged, use [Locator] objects and web-first assertions instead.
:::

When [ElementHandle] is required, it is recommended to fetch it with the
[`method: Page.waitForSelector`] or [`method: Frame.waitForSelector`] methods. These
APIs wait for the element to be attached and visible.

```js
// Get the element handle
const elementHandle = page.waitForSelector('#box');

// Assert bounding box for the element
const boundingBox = await elementHandle.boundingBox();
expect(boundingBox.width).toBe(100);

// Assert attribute for the element
const classNames = await elementHandle.getAttribute('class');
expect(classNames.includes('highlighted')).toBeTruthy();
```

```java
// Get the element handle
JSHandle jsHandle = page.waitForSelector("#box");
ElementHandle elementHandle = jsHandle.asElement();

// Assert bounding box for the element
BoundingBox boundingBox = elementHandle.boundingBox();
assertEquals(100, boundingBox.width);

// Assert attribute for the element
String classNames = elementHandle.getAttribute("class");
assertTrue(classNames.contains("highlighted"));
```

```python async
# Get the element handle
element_handle = page.wait_for_selector('#box')

# Assert bounding box for the element
bounding_box = await element_handle.bounding_box()
assert bounding_box.width == 100

# Assert attribute for the element
class_names = await element_handle.get_attribute('class')
assert 'highlighted' in class_names
```

```python sync
# Get the element handle
element_handle = page.wait_for_selector('#box')

# Assert bounding box for the element
bounding_box = element_handle.bounding_box()
assert bounding_box.width == 100

# Assert attribute for the element
class_names = element_handle.get_attribute('class')
assert 'highlighted' in class_names
```

```csharp
// Get the element handle
var jsHandle = await page.WaitForSelectorAsync("#box");
var elementHandle = jsHandle as ElementHandle;

// Assert bounding box for the element
var boundingBox = await elementHandle.BoundingBoxAsync();
Assert.AreEqual(100, boundingBox.Width);

// Assert attribute for the element
var classNames = await elementHandle.GetAttributeAsync("class");
Assert.True(classNames.Contains("highlighted"));
```

## Handles as parameters

Handles can be passed into the [`method: Page.evaluate`] and similar methods.
The following snippet creates a new array in the page, initializes it with data
and returns a handle to this array into Playwright. It then uses the handle
in subsequent evaluations:

```js
// Create new array in page.
const myArrayHandle = await page.evaluateHandle(() => {
  window.myArray = [1];
  return myArray;
});

// Get the length of the array.
const length = await page.evaluate(a => a.length, myArrayHandle);

// Add one more element to the array using the handle
await page.evaluate(arg => arg.myArray.push(arg.newElement), {
  myArray: myArrayHandle,
  newElement: 2
});

// Release the object when it's no longer needed.
await myArrayHandle.dispose();
```

```java
// Create new array in page.
JSHandle myArrayHandle = page.evaluateHandle("() => {\n" +
  "  window.myArray = [1];\n" +
  "  return myArray;\n" +
  "}");

// Get the length of the array.
int length = (int) page.evaluate("a => a.length", myArrayHandle);

// Add one more element to the array using the handle
Map<String, Object> arg = new HashMap<>();
arg.put("myArray", myArrayHandle);
arg.put("newElement", 2);
page.evaluate("arg => arg.myArray.add(arg.newElement)", arg);

// Release the object when it is no longer needed.
myArrayHandle.dispose();
```

```python async
# Create new array in page.
my_array_handle = await page.evaluate_handle("""() => {
  window.myArray = [1];
  return myArray;
}""")

# Get current length of the array.
length = await page.evaluate("a => a.length", my_array_handle)

# Add one more element to the array using the handle
await page.evaluate("(arg) => arg.myArray.push(arg.newElement)", {
  'myArray': my_array_handle,
  'newElement': 2
})

# Release the object when it's no longer needed.
await my_array_handle.dispose()
```

```python sync
# Create new array in page.
my_array_handle = page.evaluate_handle("""() => {
  window.myArray = [1];
  return myArray;
}""")

# Get current length of the array.
length = page.evaluate("a => a.length", my_array_handle)

# Add one more element to the array using the handle
page.evaluate("(arg) => arg.myArray.push(arg.newElement)", {
  'myArray': my_array_handle,
  'newElement': 2
})

# Release the object when it's no longer needed.
my_array_handle.dispose()
```

```csharp
// Create new array in page.
var myArrayHandle = await page.EvaluateHandleAsync(@"() => {
    window.myArray = [1];
    return myArray;
}");

// Get the length of the array.
var length = await page.EvaluateAsync<int>("a => a.length", myArrayHandle);

// Add one more element to the array using the handle
await page.EvaluateAsync("arg => arg.myArray.add(arg.newElement)",
    new { myArray = myArrayHandle, newElement = 2 });

// Release the object when it is no longer needed.
await myArrayHandle.DisposeAsync();
```


## Handle Lifecycle

Handles can be acquired using the page methods such as [`method: Page.evaluateHandle`],
[`method: Page.querySelector`] or [`method: Page.querySelectorAll`] or their frame counterparts
[`method: Frame.evaluateHandle`], [`method: Frame.querySelector`] or [`method: Frame.querySelectorAll`]. Once
created, handles will retain object from
[garbage collection](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Memory_Management)
unless page navigates or the handle is manually disposed via the [`method: JSHandle.dispose`] method.


### API reference
- [JSHandle]
- [ElementHandle]
- [`method: ElementHandle.boundingBox`]
- [`method: ElementHandle.getAttribute`]
- [`method: ElementHandle.innerText`]
- [`method: ElementHandle.innerHTML`]
- [`method: ElementHandle.textContent`]
- [`method: JSHandle.evaluate`]
- [`method: Page.evaluateHandle`]
- [`method: Page.querySelector`]
- [`method: Page.querySelectorAll`]


## Locator vs ElementHandle

:::caution
We only recommend using [ElementHandle] in the rare cases when you need to perform extensive DOM traversal
on a static page. For all user actions and assertions use locator instead.
:::

The difference between the [Locator] and [ElementHandle] is that the latter points to a particular element, while Locator captures the logic of how to retrieve that element.

In the example below, handle points to a particular DOM element on page. If that element changes text or is used by React to render an entirely different component, handle is still pointing to that very stale DOM element. This can lead to unexpected behaviors.

```js
const handle = await page.$('text=Submit');
// ...
await handle.hover();
await handle.click();
```

```java
ElementHandle handle = page.querySelector("text=Submit");
handle.hover();
handle.click();
```

```python async
handle = await page.query_selector("text=Submit")
await handle.hover()
await handle.click()
```

```python sync
handle = page.query_selector("text=Submit")
handle.hover()
handle.click()
```

```csharp
var handle = await page.QuerySelectorAsync("text=Submit");
await handle.HoverAsync();
await handle.ClickAsync();
```

With the locator, every time the locator is used, up-to-date DOM element is located in the page using the selector. So in the snippet below, underlying DOM element is going to be located twice.

```js
const locator = page.getByText('Submit');
// ...
await locator.hover();
await locator.click();
```

```java
Locator locator = page.getByText("Submit");
locator.hover();
locator.click();
```

```python async
locator = page.get_by_text("Submit")
await locator.hover()
await locator.click()
```

```python sync
locator = page.get_by_text("Submit")
locator.hover()
locator.click()
```

```csharp
var locator = page.GetByText("Submit");
await locator.HoverAsync();
await locator.ClickAsync();
```
