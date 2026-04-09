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
  onFrame: ({ data }) => console.log(`frame size: ${data.length}`),
  size: { width: 800, height: 600 },
});
// ... perform actions ...
await page.screencast.stop();
```

### option: Screencast.start.onFrame
* since: v1.59
- `onFrame` <[function]\([Object]\): [Promise]>
  - alias-csharp: ScreencastFrame
  - `data` <[Buffer]> JPEG-encoded frame data.

Callback that receives JPEG-encoded frame data.

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
* langs: js
- `size` ?<[Object]>
  - alias-csharp: ScreencastSize
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
- `fontSize` ?<[int]>

Font size of the action title in pixels. Defaults to `24`.

## async method: Screencast.showOverlays
* since: v1.59

Shows overlays.

## async method: Screencast.hideActions
* since: v1.59

Removes action decorations.

## async method: Screencast.hideOverlays
* since: v1.59

Hides overlays without removing them.
