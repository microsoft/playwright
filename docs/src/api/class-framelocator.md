# class: FrameLocator

FrameLocator represents a view to the `iframe` on the page. It captures the logic sufficient to retrieve the `iframe` and locate elements in that iframe. FrameLocator can be created with either [`method: Page.frameLocator`] or [`method: Locator.frameLocator`] method.

```js
const locator = page.frameLocator('#my-frame').locator('text=Submit');
await locator.click();
```

```java
Locator locator = page.frameLocator("#my-frame").locator("text=Submit");
locator.click();
```

```python async
locator = page.frame_locator("#my-frame").locator("text=Submit")
await locator.click()
```

```python sync
locator = page.frame_locator("my-frame").locator("text=Submit")
locator.click()
```

```csharp
var locator = page.FrameLocator("#my-frame").Locator("text=Submit");
await locator.ClickAsync();
```

**Strictness**

Frame locators are strict. This means that all operations on frame locators will throw if more than one element matches given selector.

```js
// Throws if there are several frames in DOM:
await page.frameLocator('.result-frame').locator('button').click();

// Works because we explicitly tell locator to pick the first frame:
await page.frameLocator('.result-frame').first().locator('button').click();
```

```python async
# Throws if there are several frames in DOM:
await page.frame_locator('.result-frame').locator('button').click()

# Works because we explicitly tell locator to pick the first frame:
await page.frame_locator('.result-frame').first.locator('button').click()
```

```python sync
# Throws if there are several frames in DOM:
page.frame_locator('.result-frame').locator('button').click()

# Works because we explicitly tell locator to pick the first frame:
page.frame_locator('.result-frame').first.locator('button').click()
```

```java
// Throws if there are several frames in DOM:
page.frame_locator(".result-frame").locator("button").click();

// Works because we explicitly tell locator to pick the first frame:
page.frame_locator(".result-frame").first().locator("button").click();
```

```csharp
// Throws if there are several frames in DOM:
await page.FrameLocator(".result-frame").Locator("button").ClickAsync();

// Works because we explicitly tell locator to pick the first frame:
await page.FrameLocator(".result-frame").First.Locator("button").ClickAsync();
```

**Converting Locator to FrameLocator**

If you have a [Locator] object pointing to an `iframe` it can be converted to [FrameLocator] using [`:scope`](https://developer.mozilla.org/en-US/docs/Web/CSS/:scope) CSS selector:

```js
const frameLocator = locator.frameLocator(':scope');
```

```java
Locator frameLocator = locator.frameLocator(':scope');
```

```python async
frameLocator = locator.frame_locator(":scope");
```

```python sync
frameLocator = locator.frame_locator(":scope");
```

```csharp
var frameLocator = locator.FrameLocator(":scope");
```

## method: FrameLocator.first
- returns: <[FrameLocator]>

Returns locator to the first matching frame.


## method: FrameLocator.frameLocator
- returns: <[FrameLocator]>

When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements
in that iframe.

### param: FrameLocator.frameLocator.selector = %%-find-selector-%%


## method: FrameLocator.last
- returns: <[FrameLocator]>

Returns locator to the last matching frame.


## method: FrameLocator.locator
- returns: <[Locator]>

The method finds an element matching the specified selector in the FrameLocator's subtree.

### param: FrameLocator.locator.selector = %%-find-selector-%%
### option: FrameLocator.locator.-inline- = %%-locator-options-list-%%


## method: FrameLocator.nth
- returns: <[FrameLocator]>

Returns locator to the n-th matching frame.

### param: FrameLocator.nth.index
- `index` <[int]>
