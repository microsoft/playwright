# class: Touchscreen
* since: v1.8

The Touchscreen class operates in main-frame CSS pixels relative to the top-left corner of the viewport. Methods on the
touchscreen can only be used in browser contexts that have been initialized with `hasTouch` set to true.

## async method: Touchscreen.tap
* since: v1.8

Dispatches a `touchstart` and `touchend` event with a single touch at the position ([`param: x`],[`param: y`]).

:::note
[`method: Page.tap`] the method will throw if [`option: hasTouch`] option of the browser context is false.
:::

### param: Touchscreen.tap.x
* since: v1.8
- `x` <[float]>

X coordinate relative to the main frame's viewport in CSS pixels.

### param: Touchscreen.tap.y
* since: v1.8
- `y` <[float]>

Y coordinate relative to the main frame's viewport in CSS pixels.

## async method: Touchscreen.touch
* since: v1.46

Synthesizes a touch event.

### param: Touchscreen.touch.type
* since: v1.46
- `type` <[TouchType]<"touchstart"|"touchend"|"touchmove"|"touchcancel">>

Type of the touch event.

### param: Touchscreen.touch.touches
* since: v1.46
- `touchPoints` <[Array]<[Object]>>
  - `x` <[float]> x coordinate of the event in CSS pixels.
  - `y` <[float]> y coordinate of the event in CSS pixels.
  - `id` ?<[int]> Identifier used to track the touch point between events, must be unique within an event. Optional.

List of touch points for this event. `id` is a unique identifier of a touch point that helps identify it between touch events for the duration of its movement around the surface.