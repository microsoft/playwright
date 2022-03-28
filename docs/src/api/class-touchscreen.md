# class: Touchscreen

The Touchscreen class operates in main-frame CSS pixels relative to the top-left corner of the viewport. Methods on the
touchscreen can only be used in browser contexts that have been initialized with `hasTouch` set to true.

## async method: Touchscreen.tap

Dispatches a `touchstart` and `touchend` event with a single touch at the position ([`param: x`],[`param: y`]).

### param: Touchscreen.tap.x
- `x` <[float]>

### param: Touchscreen.tap.y
- `y` <[float]>

## async method: Touchscreen.move
Dispatches a `touchstart` and `touchmove` and `touchend` event with a single touch at the position ([`param: x`],[`param: y`],[`param: endX`],[`param: endY`]).

### param: Touchscreen.move.x
- `x` <[float]>

### param: Touchscreen.move.y
- `y` <[float]>
### param: Touchscreen.move.endX
- `endX` <[float]>

### param: Touchscreen.move.endY
- `endY` <[float]>

## async method: Touchscreen.down
### param: Touchscreen.down.x
- `x` <[float]>

### param: Touchscreen.down.y
- `y` <[float]>

## async method: Touchscreen.up
