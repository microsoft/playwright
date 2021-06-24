---
id: assertions
title: "Assertions"
---

Playwright provides convenience APIs for common tasks, like reading the
text content of an element. These APIs can be used in your test assertions.

<!-- TOC -->

## Text content

```js
const content = await page.textContent('nav:first-child');
expect(content).toBe('home');
```

```java
String content = page.textContent("nav:first-child");
assertEquals("home", content);
```

```python async
content = await page.text_content("nav:first-child")
assert content == "home"
```

```python sync
content = page.text_content("nav:first-child")
assert content == "home"
```

```csharp
var content = await page.TextContentAsync("nav:first-child");
Assert.Equals("home", content);
```

### API reference
- [`method: Page.textContent`]
- [`method: ElementHandle.textContent`]

## Inner text

```js
const text = await page.innerText('.selected');
expect(text).toBe('value');
```

```java
String text = page.innerText(".selected");
assertEquals("value", text);
```

```python async
text = await page.inner_text(".selected")
assert text == "value"
```

```python sync
text = page.inner_text(".selected")
assert text == "value"
```

```csharp
var content = await page.InnerTextAsync(".selected");
Assert.Equals("value", content);
```

### API reference
- [`method: Page.innerText`]
- [`method: ElementHandle.innerText`]

## Attribute value

```js
const alt = await page.getAttribute('input', 'alt');
expect(alt).toBe('Text');
```

```java
String alt = page.getAttribute("input", "alt");
assertEquals("Text", alt);
```

```python async
alt = await page.get_attribute("input", "alt")
assert alt == "Text"
```

```python sync
alt = page.get_attribute("input", "alt")
assert alt == "Text"
```

```csharp
var value = await page.GetAttributeAsync("input", "alt");
Assert.Equals("Text", value);
```

## Checkbox state

```js
const checked = await page.isChecked('input');
expect(checked).toBeTruthy();
```

```java
boolean checked = page.isChecked("input");
assertTrue(checked);
```

```python async
checked = await page.is_checked("input")
assert checked
```

```python sync
checked = page.is_checked("input")
assert checked
```

```csharp
var checked = await page.IsCheckedAsync("input");
Assert.True(checked);
```

### API reference
- [`method: Page.isChecked`]
- [`method: ElementHandle.isChecked`]

## JS expression

```js
const content = await page.$eval('nav:first-child', e => e.textContent);
expect(content).toBe('home');
```

```java
Object content = page.evalOnSelector("nav:first-child", "e => e.textContent");
assertEquals("home", content);
```

```python async
content = await page.eval_on_selector("nav:first-child", "e => e.textContent")
assert content == "home"
```

```python sync
content = page.eval_on_selector("nav:first-child", "e => e.textContent")
assert content == "home"
```

```csharp
var content = await page.EvalOnSelectorAsync("nav:first-child", "e => e.textContent");
Assert.Equals("home", content);
```

### API reference
- [`method: Page.evalOnSelector`]
- [`method: JSHandle.evaluate`]

## Inner HTML

```js
const html = await page.innerHTML('div.result');
expect(html).toBe('<p>Result</p>');
```

```java
String html = page.innerHTML("div.result");
assertEquals("<p>Result</p>", html);
```

```python async
html = await page.inner_html("div.result")
assert html == "<p>Result</p>"
```

```python sync
html = page.inner_html("div.result")
assert html == "<p>Result</p>"
```

```csharp
var html = await page.InnerHTMLAsync("div.result");
Assert.Equals(html, "<p>Result</p>");
```

### API reference
- [`method: Page.innerHTML`]
- [`method: ElementHandle.innerHTML`]

## Visibility

```js
const visible = await page.isVisible('input');
expect(visible).toBeTruthy();
```

```java
boolean visible = page.isVisible("input");
assertTrue(visible);
```

```python async
visible = await page.is_visible("input")
assert visible
```

```python sync
visible = page.is_visible("input")
assert visible
```

```csharp
var visibility = await page.IsVisibleAsync("input");
Assert.True(visibility);
```

### API reference
- [`method: Page.isVisible`]
- [`method: ElementHandle.isVisible`]

## Enabled state

```js
const enabled = await page.isEnabled('input');
expect(enabled).toBeTruthy();
```

```java
boolean enabled = page.isEnabled("input");
assertTrue(enabled);
```

```python async
enabled = await page.is_enabled("input")
assert enabled
```

```python sync
enabled = page.is_enabled("input")
assert enabled
```

```csharp
var enabled = await page.IsEnabledAsync("input");
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
await page.waitForSelector('#search');
const value = await page.inputValue('#search');
expect(value === 'query').toBeTruthy();

// Assert computed style
const fontSize = await page.$eval('div', el => window.getComputedStyle(el).fontSize);
expect(fontSize === '16px').toBeTruthy();

// Assert list length
const length = await page.$$eval('li.selected', (items) => items.length);
expect(length === 3).toBeTruthy();
```

```java
// Assert local storage value
Object userId = page.evaluate("() => window.localStorage.getItem('userId')");
assertNotNull(userId);

// Assert value for input element
page.waitForSelector("#search");
Object value = page.evalOnSelector("#search", "el => el.value");
assertEquals("query", value);

// Assert computed style
Object fontSize = page.evalOnSelector("div", "el => window.getComputedStyle(el).fontSize");
assertEquals("16px", fontSize);

// Assert list length
Object length = page.evalOnSelectorAll("li.selected",  "items => items.length");
assertEquals(3, length);
```

```python async
# Assert local storage value
user_id = page.evaluate("() => window.localStorage.getItem('user_id')")
assert user_id

# Assert value for input element
await page.wait_for_selector('#search')
value = await page.eval_on_selector('#search', 'el => el.value')
assert value == 'query'

# Assert computed style
font_size = await page.eval_on_selector('div', 'el => window.getComputedStyle(el).fontSize')
assert font_size == '16px'

# Assert list length
length = await page.eval_on_selector_all('li.selected', '(items) => items.length')
assert length == 3
```

```python sync
# Assert local storage value
user_id = page.evaluate("() => window.localStorage.getItem('user_id')")
assert user_id

# Assert value for input element
page.wait_for_selector('#search')
value = page.eval_on_selector('#search', 'el => el.value')
assert value == 'query'

# Assert computed style
font_size = page.eval_on_selector('div', 'el => window.getComputedStyle(el).fontSize')
assert font_size == '16px'

# Assert list length
length = page.eval_on_selector_all('li.selected', '(items) => items.length')
assert length == 3
```

```csharp
// Assert local storage value
var userId = await page.EvaluateAsync<string>("() => window.localStorage.getItem('userId')");
Assert.NotNull(userId);

// Assert value for input element
await page.WaitForSelectorAsync("#search");
var value = await page.EvalOnSelectorAsync("#search", "el => el.value");
Assert.Equals("query", value);

// Assert computed style
var fontSize = await page.EvalOnSelectorAsync<string>("div", "el => window.getComputedStyle(el).fontSize");
Assert.Equals("16px", fontSize);

// Assert list length
var length = await page.EvalOnSelectorAllAsync<int>("li.selected", "items => items.length");
Assert.Equals(3, length);
```

### API reference
- [`method: Page.evaluate`]
- [`method: Page.evalOnSelector`]
- [`method: Page.evalOnSelectorAll`]
- [`method: Frame.evaluate`]
- [`method: Frame.evalOnSelector`]
- [`method: Frame.evalOnSelectorAll`]
- [`method: ElementHandle.evalOnSelector`]
- [`method: ElementHandle.evalOnSelectorAll`]
- [EvaluationArgument]