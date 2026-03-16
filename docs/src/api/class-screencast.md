# class: Screencast
* since: v1.59
* langs: js

Interface for capturing screencast frames from a page.

## event: Screencast.screencastFrame
* since: v1.59
- argument: <[Object]>
  - `data` <[Buffer]> JPEG-encoded frame data.

Emitted for each captured JPEG screencast frame while the screencast is running.

**Usage**

```js
const screencast = page.screencast;
screencast.on('screencastframe', ({ data, width, height }) => {
  console.log(`frame ${width}x${height}, jpeg size: ${data.length}`);
  require('fs').writeFileSync('frame.jpg', data);
});
await screencast.start({ maxSize: { width: 1200, height: 800 } });
// ... perform actions ...
await screencast.stop();
```

## async method: Screencast.start
* since: v1.59

Starts capturing screencast frames. Frames are emitted as [`event: Screencast.screencastFrame`] events.

**Usage**

```js
const screencast = page.screencast;
screencast.on('screencastframe', ({ data, width, height }) => {
  console.log(`frame ${width}x${height}, size: ${data.length}`);
});
await screencast.start({ maxSize: { width: 800, height: 600 } });
// ... perform actions ...
await screencast.stop();
```

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
await screencast.start();
// ... perform actions ...
await screencast.stop();
```
