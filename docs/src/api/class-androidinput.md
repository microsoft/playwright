# class: AndroidInput
* since: v1.9
* langs: js

## async method: AndroidInput.drag
* since: v1.9

Performs a drag between [`param: from`] and [`param: to`] points.

### param: AndroidInput.drag.from
* since: v1.9
- `from` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

The start point of the drag.

### param: AndroidInput.drag.to
* since: v1.9
- `to` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

The end point of the drag.

### param: AndroidInput.drag.steps
* since: v1.9
- `steps` <[int]>

The number of steps in the drag. Each step takes 5 milliseconds to complete.

## async method: AndroidInput.press
* since: v1.9

Presses the [`param: key`].

### param: AndroidInput.press.key
* since: v1.9
- `key` <[AndroidKey]>

Key to press.

## async method: AndroidInput.swipe
* since: v1.9

Swipes following the path defined by [`param: segments`].

### param: AndroidInput.swipe.from
* since: v1.9
- `from` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

The point to start swiping from.

### param: AndroidInput.swipe.segments
* since: v1.9
- `segments` <[Array]<[Object]>>
  - `x` <[float]>
  - `y` <[float]>

Points following the [`param: from`] point in the swipe gesture.

### param: AndroidInput.swipe.steps
* since: v1.9
- `steps` <[int]>

The number of steps for each segment. Each step takes 5 milliseconds to complete, so 100 steps means half a second per each segment.

## async method: AndroidInput.tap
* since: v1.9

Taps at the specified [`param: point`].

### param: AndroidInput.tap.point
* since: v1.9
- `point` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

The point to tap at.

## async method: AndroidInput.type
* since: v1.9

Types [`param: text`] into currently focused widget.

### param: AndroidInput.type.text
* since: v1.9
- `text` <[string]>

Text to type.
