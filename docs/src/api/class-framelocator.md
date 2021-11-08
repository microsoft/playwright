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

## method: FrameLocator.frameLocator
- returns: <[FrameLocator]>

When working with iframes, you can create a frame locator that will enter the iframe and allow selecting elements
in that iframe.

### param: FrameLocator.frameLocator.selector = %%-find-selector-%%


## method: FrameLocator.locator
- returns: <[Locator]>

The method finds an element matching the specified selector in the FrameLocator's subtree.

### param: FrameLocator.locator.selector = %%-find-selector-%%
