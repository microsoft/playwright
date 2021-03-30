# class: Touchscreen

The Touchscreen class operates in main-frame CSS pixels relative to the top-left corner of the viewport. Methods on the
touchscreen can only be used in browser contexts that have been initialized with `hasTouch` set to true.

## async method: Touchscreen.tap

Dispatches a `touchstart` and `touchend` event with a single touch at the position ([`param: x`],[`param: y`]).

### param: Touchscreen.tap.x
- `x` <[float]>

### param: Touchscreen.tap.y
- `y` <[float]>
