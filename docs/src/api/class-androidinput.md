# class: AndroidInput
* langs: js

## async method: AndroidInput.drag

Performs a drag between [`param: from`] and [`param: to`] points.

### param: AndroidInput.drag.from
- `from` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

The start point of the drag.

### param: AndroidInput.drag.to
- `to` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

The end point of the drag.

### param: AndroidInput.drag.steps
- `steps` <[int]>

The number of steps in the drag. Each step takes 5 milliseconds to complete.

## async method: AndroidInput.press

Presses the [`param: key`].

### param: AndroidInput.press.key
- `key` <[AndroidKey]>

Key to press.


## async method: AndroidInput.swipe

Swipes following the path defined by [`param: segments`].

### param: AndroidInput.swipe.from
- `from` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

The point to start swiping from.

### param: AndroidInput.swipe.segments
- `segments` <[Array]<[Object]>>
  - `x` <[float]>
  - `y` <[float]>

Points following the [`param: from`] point in the swipe gesture.

### param: AndroidInput.swipe.steps
- `steps` <[int]>

The number of steps for each segment. Each step takes 5 milliseconds to complete, so 100 steps means half a second per each segment.

## async method: AndroidInput.tap

Taps at the specified [`param: point`].

### param: AndroidInput.tap.point
- `point` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

The point to tap at.

## async method: AndroidInput.type

Types [`param: text`] into currently focused widget.

### param: AndroidInput.type.text
- `text` <[string]>

Text to type.
