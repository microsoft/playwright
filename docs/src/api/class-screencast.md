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
- `preferredSize` ?<[Object]>
  - `width` <[int]> Max frame width in pixels.
  - `height` <[int]> Max frame height in pixels.

Specifies the preferred maximum dimensions of screencast frames. The actual frame is scaled to preserve the page’s aspect ratio and may be smaller than these bounds.

If a screencast is already active (e.g. started by tracing or video recording), the existing configuration takes precedence and the frame size may exceed these bounds or this option may be ignored.

Defaults to 800×800.

### option: Screencast.start.annotate
* since: v1.59
* langs: js
- `annotate` ?<[Object]>
  - `delay` ?<[int]> How long each annotation is displayed in milliseconds. Defaults to `500`.

If specified, enables visual annotations on interacted elements during screencast. Interacted elements are highlighted with a semi-transparent blue box and click points are shown as red circles.

## async method: Screencast.stop
* since: v1.59
* langs: js

Stops the screencast started with [`method: Screencast.start`].
