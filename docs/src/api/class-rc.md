# class: RC
* since: v1.59

Remote control allows streaming live screencast of the browser context over WebSocket.
It shows a tabbed browser-like UI with all context pages.

## async method: RC.startHttp
* since: v1.59
- returns: <[Object]>
  - `url` <[string]> URL of the screencast server.

Starts an HTTP server that streams live screencast frames over WebSocket. Returns an object with the server URL.
Open the URL in a browser to see the live screencast with a tabbed UI showing all pages in the context.

**Usage**

```js
const { url } = await context.rc.startHttp();
console.log('Open to view screencast:', url);
// ... perform actions ...
await context.rc.stopHttp();
```

### option: RC.startHttp.size
* since: v1.59
- `size` ?<[Object]>
  - `width` <[int]> Video frame width.
  - `height` <[int]> Video frame height.

Optional dimensions of the screencast frames. If not specified the size will be scaled down to fit into 800x800.

### option: RC.startHttp.port
* since: v1.59
- `port` ?<[int]>

Port to bind the HTTP server to. If not specified, a random available port will be used.

### option: RC.startHttp.host
* since: v1.59
- `host` ?<[string]>

Host to bind the HTTP server to. Default is localhost.

## async method: RC.stopHttp
* since: v1.59

Stops the screencast server started with [`method: RC.startHttp`].
