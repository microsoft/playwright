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

## async method: Mouse.click

Shortcut for [`method: Mouse.move`], [`method: Mouse.down`], [`method: Mouse.up`].

### param: Mouse.click.x
- `x` <[int]>

### param: Mouse.click.y
- `y` <[int]>

### option: Mouse.click.button = %%-input-button-%%

### option: Mouse.click.clickCount = %%-input-click-count-%%

### option: Mouse.click.delay = %%-input-down-up-delay-%%

## async method: Mouse.dblclick

Shortcut for [`method: Mouse.move`], [`method: Mouse.down`], [`method: Mouse.up`], [`method: Mouse.down`] and
[`method: Mouse.up`].

### param: Mouse.dblclick.x
- `x` <[int]>

### param: Mouse.dblclick.y
- `y` <[int]>

### option: Mouse.dblclick.button = %%-input-button-%%

### option: Mouse.dblclick.delay = %%-input-down-up-delay-%%

## async method: Mouse.down

Dispatches a `mousedown` event.

### option: Mouse.down.button = %%-input-button-%%

### option: Mouse.down.clickCount = %%-input-click-count-%%

## async method: Mouse.move

Dispatches a `mousemove` event.

### param: Mouse.move.x
- `x` <[int]>

### param: Mouse.move.y
- `y` <[int]>

### option: Mouse.move.steps
- `steps` <[int]>

defaults to 1. Sends intermediate `mousemove` events.

## async method: Mouse.up

Dispatches a `mouseup` event.

### option: Mouse.up.button = %%-input-button-%%

### option: Mouse.up.clickCount = %%-input-click-count-%%
