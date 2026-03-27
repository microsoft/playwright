# class: Screencast
* since: v1.59
* langs: js

Interface for capturing screencast and recording video from a page.

## async method: Screencast.start
* since: v1.59
* langs: js
- returns: <[Disposable]>

Starts capturing screencast frames and/or recording video. At least one of [`option: Screencast.start.onFrame`] or
[`option: Screencast.start.path`] must be specified.

When [`option: Screencast.start.path`] is specified, video is recorded to the given file. When
[`option: Screencast.start.onFrame`] is specified, JPEG-encoded frames are delivered to the callback.
Both options can be used simultaneously.

**Usage**

```js
// Record video to a file
await page.screencast.start({ path: 'video.webm' });
// ... perform actions ...
await page.screencast.stop();
```

```js
// Capture screencast frames
await page.screencast.start({
  onFrame: ({ data }) => console.log(`frame size: ${data.length}`),
  size: { width: 800, height: 600 },
});
// ... perform actions ...
await page.screencast.stop();
```

### option: Screencast.start.onFrame
* since: v1.59
* langs: js
- `onFrame` ?<[function]\([Object]\): [Promise]>
  - `data` <[Buffer]> JPEG-encoded frame data.

Callback that receives JPEG-encoded frame data.

### option: Screencast.start.path
* since: v1.59
* langs: js
- `path` ?<[path]>

Path where the video should be saved when the recording is stopped.

### option: Screencast.start.size
* since: v1.59
* langs: js
- `size` ?<[Object]>
  - `width` <[int]> Frame width in pixels.
  - `height` <[int]> Frame height in pixels.

Specifies the box this screencast should be inscribed into, defaults to 800x800.

:::note[Disclaimer]
Data passed into [`option: Screencast.start.onFrame`] may exceed the specified size if another client initiated the recording.
:::

### option: Screencast.start.annotate
* since: v1.59
* langs: js
- `annotate` ?<[Object]>
  - `duration` ?<[float]> How long each annotation is displayed in milliseconds. Defaults to `500`.
  - `position` ?<[AnnotatePosition]<"top-left"|"top"|"top-right"|"bottom-left"|"bottom"|"bottom-right">> Position of the action title overlay. Defaults to `"top-right"`.
  - `fontSize` ?<[int]> Font size of the action title in pixels. Defaults to `24`.

If specified, enables visual annotations on interacted elements during video recording. Interacted elements are highlighted with a semi-transparent blue box and click points are shown as red circles.

## async method: Screencast.stop
* since: v1.59
* langs: js

Stops the screencast started with [`method: Screencast.start`].
