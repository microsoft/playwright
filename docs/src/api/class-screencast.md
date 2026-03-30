# class: Screencast
* since: v1.59
* langs: js

Interface for capturing screencast frames from a page.

## async method: Screencast.start
* since: v1.59
* langs: js
- returns: <[Disposable]>

Starts capturing screencast frames.

**Usage**

```js
await page.screencast.start(({ data })  => {
  console.log(`frame size: ${data.length}`);
}, { preferredSize: { width: 800, height: 600 } });
// ... perform actions ...
await page.screencast.stop();
```

### param: Screencast.start.onFrame
* since: v1.59
* langs: js
- `onFrame` <[function]\([Object]\): [Promise]>
  - `data` <[Buffer]> JPEG-encoded frame data.

Callback that receives JPEG-encoded frame data.

### option: Screencast.start.preferredSize
* since: v1.59
* langs: js
- `preferredSize` ?<[Object=ScreencastSize]>
  - `width` <[int]> Max frame width in pixels.
  - `height` <[int]> Max frame height in pixels.

Specifies the preferred maximum dimensions of screencast frames. The actual frame is scaled to preserve the page’s aspect ratio and may be smaller than these bounds.

If a screencast is already active (e.g. started by tracing or video recording), the existing configuration takes precedence and the frame size may exceed these bounds or this option may be ignored.

Defaults to 800×800.

## async method: Screencast.stop
* since: v1.59
* langs: js

Stops the screencast started with [`method: Screencast.start`].

## async method: Screencast.startRecording
* since: v1.59
- returns: <[Disposable]>

Starts video recording. This method is mutually exclusive with the `recordVideo` context option.

### param: Screencast.startRecording.path
* since: v1.59
- `path` <[path]>

Path where the video should be saved when the recording is stopped.

### option: Screencast.startRecording.size
* since: v1.59
- `size` ?<[Object=ScreencastSize]>
  - `width` <[int]> Video frame width.
  - `height` <[int]> Video frame height.

Optional dimensions of the recorded video. If not specified the size will be equal to page viewport scaled down to fit into 800x800. Actual picture of the page will be scaled down if necessary to fit the specified size.

### option: Screencast.startRecording.annotate
* since: v1.59
- `annotate` ?<[Object=ScreencastAnnotation]>
  - `duration` ?<[float]> How long each annotation is displayed in milliseconds. Defaults to `500`.
  - `position` ?<[AnnotatePosition]<"top-left"|"top"|"top-right"|"bottom-left"|"bottom"|"bottom-right">> Position of the action title overlay. Defaults to `"top-right"`.
  - `fontSize` ?<[int]> Font size of the action title in pixels. Defaults to `24`.

If specified, enables visual annotations on interacted elements during video recording. Interacted elements are highlighted with a semi-transparent blue box and click points are shown as red circles.

## async method: Screencast.stopRecording
* since: v1.59

Stops video recording started with [`method: Screencast.startRecording`].

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

## async method: Screencast.showOverlays
* since: v1.59

Shows overlays.

## async method: Screencast.hideOverlays
* since: v1.59

Hides overlays without removing them.
