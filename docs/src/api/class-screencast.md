# class: Screencast
* since: v1.59

Interface for capturing screencast frames from a page.

## async method: Screencast.start
* since: v1.59
- returns: <[Disposable]>

Starts the screencast. When [`option: Screencast.start.path`] is provided, it saves video recording to the specified file.
When [`option: Screencast.start.onFrame`] is provided, delivers JPEG-encoded frames to the callback. Both can be used together.

**Usage**

```js
// Record video
await page.screencast.start({ path: 'video.webm', size: { width: 1280, height: 800 } });
// ... perform actions ...
await page.screencast.stop();
```

```js
// Capture frames
await page.screencast.start({
  onFrame: ({ data, timestamp, viewportWidth, viewportHeight }) => {
    console.log(`frame size: ${data.length} (${viewportWidth}x${viewportHeight}) at ${timestamp}`);
  },
  size: { width: 800, height: 600 },
});
// ... perform actions ...
await page.screencast.stop();
```

### option: Screencast.start.fps
* since: v1.64
- `fps` <[int]>

Frame rate of the video recording in frames per second. Only used together with [`option: Screencast.start.path`]. Defaults to `25`.

Higher frame rates make animations and scrolling smoother at the cost of more CPU spent on encoding. Combine with [`option: Screencast.start.size`] to record high resolution videos. The video can only contain as many distinct frames as the browser produces; Firefox and WebKit currently capture up to 25 frames per second.

### option: Screencast.start.onFrame
* since: v1.59
- `onFrame` <[function]\([Object]\): [Promise]>
  * alias: ScreencastFrame
  - `data` <[Buffer]> JPEG-encoded frame data.
  - `timestamp` <[float]> The timestamp of when the frame was presented by the browser, in milliseconds since the Unix epoch.
  - `viewportWidth` <[int]> Width of the page viewport at the time the frame was captured.
  - `viewportHeight` <[int]> Height of the page viewport at the time the frame was captured.

Callback that receives JPEG-encoded frame data along with the page viewport size at the time of capture.

### option: Screencast.start.path
* since: v1.59
- `path` <[path]>

Path where the video should be saved when the screencast is stopped. When provided, video recording is started.

### option: Screencast.start.quality
* since: v1.59
- `quality` <[int]>

The quality of the image, between 0-100.

### option: Screencast.start.size
* since: v1.59
- `size` ?<[Object]>
  * alias-csharp: ScreencastSize
  - `width` <[int]> Max frame width in pixels.
  - `height` <[int]> Max frame height in pixels.

Specifies the dimensions of screencast frames. The actual frame is scaled to preserve the page's aspect ratio and may be smaller than these bounds.
If a screencast is already active (e.g. started by tracing or video recording), the existing configuration takes precedence and the frame size may exceed these bounds or this option may be ignored.
If not specified the size will be equal to page viewport scaled down to fit into 800×800.

## async method: Screencast.stop
* since: v1.59

Stops the screencast and video recording if active. If a video was being recorded, saves it to the path specified in [`method: Screencast.start`].

## async method: Screencast.showOverlay
* since: v1.59
- returns: <[Disposable]>

Adds an overlay with the given HTML content. The overlay is displayed on top of the page until removed. Returns a disposable that removes the overlay when disposed.

### param: Screencast.showOverlay.html
* since: v1.59
- `html` <[string]>

HTML content for the overlay.

### option: Screencast.showOverlay.duration
* since: v1.59
- `duration` <[float]>

Duration in milliseconds after which the overlay is automatically removed. Overlay stays until dismissed if not provided.

## async method: Screencast.showChapter
* since: v1.59

Shows a chapter overlay with a title and optional description, centered on the page with a blurred backdrop. Useful for narrating video recordings. The overlay is removed after the specified duration, or 2000ms.

### param: Screencast.showChapter.title
* since: v1.59
- `title` <[string]>

Title text displayed prominently in the overlay.

### option: Screencast.showChapter.description
* since: v1.59
- `description` <[string]>

Optional description text displayed below the title.

### option: Screencast.showChapter.duration
* since: v1.59
- `duration` <[float]>

Duration in milliseconds after which the overlay is automatically removed. Defaults to `2000`.

## async method: Screencast.showActions
* since: v1.59
- returns: <[Disposable]>

Enables visual annotations on interacted elements. Returns a disposable that stops showing actions when disposed.

### option: Screencast.showActions.duration
* since: v1.59
- `duration` ?<[float]>

How long each annotation is displayed in milliseconds. Defaults to `500`.

### option: Screencast.showActions.position
* since: v1.59
- `position` ?<[AnnotatePosition]<"top-left"|"top"|"top-right"|"bottom-left"|"bottom"|"bottom-right">>

Position of the action title overlay. Defaults to `"top-right"`.

### option: Screencast.showActions.fontSize
* since: v1.59
* deprecated: Use `title` in [`option: Screencast.showActions.style`] instead, for example `style: { title: 'font-size: 32px' }`.
- `fontSize` ?<[int]>

Font size of the action title in pixels. Defaults to `24`.

### option: Screencast.showActions.cursor
* since: v1.61
- `cursor` ?<[ScreencastCursor]<"none"|"pointer">>

Cursor decoration shown for pointer actions. `"pointer"` (the default) renders
a mouse pointer that animates from the previous action point to the next one.
`"none"` disables the cursor decoration.

### option: Screencast.showActions.style
* since: v1.64
- `style` ?<[Object]>
  * alias-csharp: ScreencastActionStyle
  - `point` ?<[string]> CSS declarations for the marker at the action point. The marker is positioned at the action point, has zero size and is centered on the point, so its size and look come from this style. Not shown when omitted.
  - `highlight` ?<[string]> CSS declarations for the box that covers the target element. The box is positioned and sized to the element bounds. Not shown when omitted.
  - `title` ?<[string]> CSS declarations for the action title, for example `'font-size: 32px; background: #333'`. The title is placed according to [`option: Screencast.showActions.position`].

Styles of the action decorations. All decorations fade out over [`option: Screencast.showActions.duration`].

**Usage**

```js
await page.screencast.showActions({
  style: {
    point: 'width: 20px; height: 20px; border-radius: 50%; background: red',
    highlight: 'outline: 2px solid #333; background: rgba(0, 128, 255, .15)',
    title: 'font-size: 16px',
  },
});
```

## async method: Screencast.showOverlays
* since: v1.59

Shows overlays.

## async method: Screencast.hideActions
* since: v1.59

Removes action decorations.

## async method: Screencast.hideOverlays
* since: v1.59

Hides overlays without removing them.
