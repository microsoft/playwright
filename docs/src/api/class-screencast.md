# class: Screencast
* since: v1.59
* langs: js

Interface for capturing screencast frames from a page.

## async method: Screencast.start
* since: v1.59
- returns: <[Disposable]>

Starts capturing screencast frames.

**Usage**

```js
const disposable = await page.screencast.start(({ data }) => {
  console.log(`frame size: ${data.length}`);
}, { preferredSize: { width: 800, height: 600 } });
// ... perform actions ...
await disposable.dispose();
```

### param: Screencast.start.onFrame
* since: v1.59
* langs: js
- `onFrame` <[function]\([Object]\): [Promise<any>|any]>
  - `data` <[Buffer]> JPEG-encoded frame data.

Callback that receives JPEG-encoded frame data.

### option: Screencast.start.preferredSize
* since: v1.59
- `preferredSize` ?<[Object]>
  - `width` <[int]> Max frame width in pixels.
  - `height` <[int]> Max frame height in pixels.

Preferred screencast frame dimensions. The output frame may be smaller to preserve the page aspect ratio. Defaults to 800×800. Note that the actual size may not match this constraint if screencast has already been started with different parameters, for example for tracing or video recording.


