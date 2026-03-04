# class: Inspector
* since: v1.59
* langs: js

Interface to the Playwright inspector.

**Usage**

```js
const inspector = page.inspector();
inspector.on('screencastframe', ({ data, width, height }) => {
  console.log(`received frame ${width}x${height}, jpeg size: ${data.length}`);
});
await inspector.startScreencast();
// ... perform actions ...
await inspector.stopScreencast();
```

## event: Inspector.screencastFrame
* since: v1.59
- argument: <[Object]>
  - `data` <[Buffer]> JPEG-encoded frame data.
  - `width` <[int]> Frame width in pixels.
  - `height` <[int]> Frame height in pixels.

Emitted for each captured JPEG screencast frame while the screencast is running.

**Usage**

```js
const inspector = page.inspector();
inspector.on('screencastframe', ({ data, width, height }) => {
  console.log(`frame ${width}x${height}, jpeg size: ${data.length}`);
  require('fs').writeFileSync('frame.jpg', data);
});
await inspector.startScreencast({ size: { width: 1280, height: 720 } });
// ... perform actions ...
await inspector.stopScreencast();
```

## async method: Inspector.startScreencast
* since: v1.59

Starts capturing screencast frames. Frames are emitted as [`event: Inspector.screencastFrame`] events.

**Usage**

```js
const inspector = page.inspector();
inspector.on('screencastframe', ({ data, width, height }) => console.log(`frame ${width}x${height}, size: ${data.length}`));
await inspector.startScreencast({ size: { width: 800, height: 600 } });
// ... perform actions ...
await inspector.stopScreencast();
```

### option: Inspector.startScreencast.size
* since: v1.59
- `size` ?<[Object]>
  - `width` <[int]> Frame width in pixels.
  - `height` <[int]> Frame height in pixels.

Optional dimensions for the screencast frames. If not specified, the current page viewport size is used.

## async method: Inspector.stopScreencast
* since: v1.59

Stops the screencast started with [`method: Inspector.startScreencast`].

**Usage**

```js
await inspector.startScreencast();
// ... perform actions ...
await inspector.stopScreencast();
```
