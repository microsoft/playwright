# class: Mouse

The Mouse class operates in main-frame CSS pixels relative to the top-left corner of the viewport.

Every `page` object has its own Mouse, accessible with [`property: Page.mouse`].

```js
// Using ‘page.mouse’ to trace a 100x100 square.
await page.mouse.move(0, 0);
await page.mouse.down();
await page.mouse.move(0, 100);
await page.mouse.move(100, 100);
await page.mouse.move(100, 0);
await page.mouse.move(0, 0);
await page.mouse.up();
```

```java
// Using ‘page.mouse’ to trace a 100x100 square.
page.mouse().move(0, 0);
page.mouse().down();
page.mouse().move(0, 100);
page.mouse().move(100, 100);
page.mouse().move(100, 0);
page.mouse().move(0, 0);
page.mouse().up();
```

```python async
# using ‘page.mouse’ to trace a 100x100 square.
await page.mouse.move(0, 0)
await page.mouse.down()
await page.mouse.move(0, 100)
await page.mouse.move(100, 100)
await page.mouse.move(100, 0)
await page.mouse.move(0, 0)
await page.mouse.up()
```

```python sync
# using ‘page.mouse’ to trace a 100x100 square.
page.mouse.move(0, 0)
page.mouse.down()
page.mouse.move(0, 100)
page.mouse.move(100, 100)
page.mouse.move(100, 0)
page.mouse.move(0, 0)
page.mouse.up()
```

```csharp
await Page.Mouse.MoveAsync(0, 0);
await Page.Mouse.DownAsync();
await Page.Mouse.MoveAsync(0, 100);
await Page.Mouse.MoveAsync(100, 100);
await Page.Mouse.MoveAsync(100, 0);
await Page.Mouse.MoveAsync(0, 0);
await Page.Mouse.UpAsync();
```
## async method: Mouse.click

Shortcut for [`method: Mouse.move`], [`method: Mouse.down`], [`method: Mouse.up`].

### param: Mouse.click.x
- `x` <[float]>

### param: Mouse.click.y
- `y` <[float]>

### option: Mouse.click.button = %%-input-button-%%

### option: Mouse.click.clickCount = %%-input-click-count-%%

### option: Mouse.click.delay = %%-input-down-up-delay-%%

## async method: Mouse.dblclick
* langs:
  - alias-csharp: DblClickAsync

Shortcut for [`method: Mouse.move`], [`method: Mouse.down`], [`method: Mouse.up`], [`method: Mouse.down`] and
[`method: Mouse.up`].

### param: Mouse.dblclick.x
- `x` <[float]>

### param: Mouse.dblclick.y
- `y` <[float]>

### option: Mouse.dblclick.button = %%-input-button-%%

### option: Mouse.dblclick.delay = %%-input-down-up-delay-%%

## async method: Mouse.down

Dispatches a `mousedown` event.

### option: Mouse.down.button = %%-input-button-%%

### option: Mouse.down.clickCount = %%-input-click-count-%%

## async method: Mouse.move

Dispatches a `mousemove` event.

### param: Mouse.move.x
- `x` <[float]>

### param: Mouse.move.y
- `y` <[float]>

### option: Mouse.move.steps
- `steps` <[int]>

Defaults to 1. Sends intermediate `mousemove` events.

## async method: Mouse.up

Dispatches a `mouseup` event.

### option: Mouse.up.button = %%-input-button-%%

### option: Mouse.up.clickCount = %%-input-click-count-%%

## async method: Mouse.wheel

Dispatches a `wheel` event.

:::note
Wheel events may cause scrolling if they are not handled, and this method does not
wait for the scrolling to finish before returning.
:::

### param: Mouse.wheel.deltaX
- `deltaX` <[float]>

Pixels to scroll horizontally.

### param: Mouse.wheel.deltaY
- `deltaY` <[float]>

Pixels to scroll vertically.
