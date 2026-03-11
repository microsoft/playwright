# class: Inspector
* since: v1.59
* langs: js

Interface to the Playwright inspector.

## event: Inspector.screencastFrame
* since: v1.59
- argument: <[Object]>
  - `data` <[Buffer]> JPEG-encoded frame data.

Emitted for each captured JPEG screencast frame while the screencast is running.

**Usage**

```js
const inspector = page.inspector();
inspector.on('screencastframe', ({ data, width, height }) => {
  console.log(`frame ${width}x${height}, jpeg size: ${data.length}`);
  require('fs').writeFileSync('frame.jpg', data);
});
await inspector.startScreencast({ maxSize: { width: 1200, height: 800 } });
// ... perform actions ...
await inspector.stopScreencast();
```

## async method: Inspector.startScreencast
* since: v1.59

Starts capturing screencast frames. Frames are emitted as [`event: Inspector.screencastFrame`] events.

**Usage**

```js
const inspector = page.inspector();
inspector.on('screencastframe', ({ data, width, height }) => {
  console.log(`frame ${width}x${height}, size: ${data.length}`);
});
await inspector.startScreencast({ maxSize: { width: 800, height: 600 } });
// ... perform actions ...
await inspector.stopScreencast();
```

### option: Inspector.startScreencast.maxSize
* since: v1.59
- `maxSize` ?<[Object]>
  - `width` <[int]> Max frame width in pixels.
  - `height` <[int]> Max frame height in pixels.

Maximum screencast frame dimensions. The output frame may be smaller to preserve the page aspect ratio. Defaults to 800×800.

## async method: Inspector.stopScreencast
* since: v1.59

Stops the screencast started with [`method: Inspector.startScreencast`].

**Usage**

```js
await inspector.startScreencast();
// ... perform actions ...
await inspector.stopScreencast();
```
