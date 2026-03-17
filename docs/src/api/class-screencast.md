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
await page.screencast.start(buffer => {
  console.log(`frame size: ${buffer.length}`);
}, { maxSize: { width: 800, height: 600 } });
// ... perform actions ...
await page.screencast.stop();
```

### param: Screencast.start.onFrame
* since: v1.59
* langs: js
- `onFrame` <[function]\([Buffer]\): [Promise<any>|any]>

Callback that receives JPEG-encoded frame data.

### option: Screencast.start.maxSize
* since: v1.59
- `maxSize` ?<[Object]>
  - `width` <[int]> Max frame width in pixels.
  - `height` <[int]> Max frame height in pixels.

Maximum screencast frame dimensions. The output frame may be smaller to preserve the page aspect ratio. Defaults to 800×800.


## async method: Screencast.stop
* since: v1.59

Stops the screencast started with [`method: Screencast.start`].

**Usage**

```js
await screencast.start(buffer => { /* handle frame */ });
// ... perform actions ...
await screencast.stop();
```
