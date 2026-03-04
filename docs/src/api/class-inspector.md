# class: Inspector
* since: v1.59
* langs: js

Interface to the Playwright inspector.

## async method: Inspector.cancelPickLocator
* since: v1.59

Cancels an ongoing [`method: Inspector.pickLocator`] call by deactivating pick locator mode.
If no pick locator mode is active, this method is a no-op.

## async method: Inspector.pickLocator
* since: v1.59
- returns: <[Locator]>

Enters pick locator mode where hovering over page elements highlights them and shows the corresponding locator.
Once the user clicks an element, the mode is deactivated and the [Locator] for the picked element is returned.

**Usage**

```js
const locator = await page.inspector().pickLocator();
console.log(locator);
```

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

Maximum screencast frame dimensions. The output frame may be smaller to preserve the page aspect ratio. Defaults to the current page viewport size, or 800×800 if no viewport is configured.

## async method: Inspector.stopScreencast
* since: v1.59

Stops the screencast started with [`method: Inspector.startScreencast`].

**Usage**

```js
await inspector.startScreencast();
// ... perform actions ...
await inspector.stopScreencast();
```
