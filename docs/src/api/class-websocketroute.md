# class: WebSocketRoute
* since: v1.48

Whenever a [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) route is set up with [`method: Page.routeWebSocket`] or [`method: BrowserContext.routeWebSocket`], the `WebSocketRoute` object allows to handle the WebSocket.

By default, the routed WebSocket will not actually connect to the server. This way, you can mock entire communcation over the WebSocket. Here is an example that responds to a `"query"` with a `"result"`.

```js
await page.routeWebSocket('/ws', async ws => {
  ws.routeSend(message => {
    if (message === 'query')
      ws.receive('result');
  });
});
```

```java
page.routeWebSocket("/ws", ws -> {
  ws.routeSend(message -> {
    if ("query".equals(message))
      ws.receive("result");
  });
});
```

```python async
def message_handler(ws, message):
  if message == "query":
    ws.receive("result")

await page.route_web_socket("/ws", lambda ws: ws.route_send(
    lambda message: message_handler(ws, message)
))
```

```python sync
def message_handler(ws, message):
  if message == "query":
    ws.receive("result")

page.route_web_socket("/ws", lambda ws: ws.route_send(
    lambda message: message_handler(ws, message)
))
```

```csharp
await page.RouteWebSocketAsync("/ws", async ws => {
  ws.RouteSend(message => {
    if (message == "query")
      ws.receive("result");
  });
});
```


## event: WebSocketRoute.close
* since: v1.48

Emitted when the [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) closes.



## async method: WebSocketRoute.close
* since: v1.48

Closes the server connection and the [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) object in the page.

### option: WebSocketRoute.close.code
* since: v1.48
- `code` <[int]>

Optional [close code](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#code).

### option: WebSocketRoute.close.reason
* since: v1.48
- `reason` <[string]>

Optional [close reason](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#reason).


## async method: WebSocketRoute.connect
* since: v1.48

By default, routed WebSocket does not connect to the server, so you can mock entire WebSocket communication. This method connects to the actual WebSocket server, giving the ability to send and receive messages from the server.

Once connected:
* Messages received from the server will be automatically dispatched to the [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) object in the page, unless [`method: WebSocketRoute.routeReceive`] is called.
* Messages sent by the `WebSocket.send()` call in the page will be automatically sent to the server, unless [`method: WebSocketRoute.routeSend`] is called.


## method: WebSocketRoute.receive
* since: v1.48

Dispatches a message to the [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) object in the page, like it was received from the server.

### param: WebSocketRoute.receive.message
* since: v1.48
- `message` <[string]|[Buffer]>

Message to receive.


## async method: WebSocketRoute.routeReceive
* since: v1.48

This method allows to route messages that are received by the [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) object in the page from the server. This method only makes sense if you are also calling [`method: WebSocketRoute.connect`].

Once this method is called, received messages are not automatically dispatched to the [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) object in the page - you should do that manually by calling [`method: WebSocketRoute.receive`].

Calling this method again times will override the handler with a new one.

### param: WebSocketRoute.routeReceive.handler
* since: v1.48
* langs: js, python
- `handler` <[function]\([string]\): [Promise<any>|any]>

Handler function to route received messages.

### param: WebSocketRoute.routeReceive.handler
* since: v1.48
* langs: csharp, java
- `handler` <[function]\([WebSocketFrame]\)>

Handler function to route received messages.



## async method: WebSocketRoute.routeSend
* since: v1.48

This method allows to route messages that are sent by `WebSocket.send()` call in the page, instead of actually sending them to the server. Once this method is called, sent messages **are not** automatically forwarded to the server - you should do that manually by calling [`method: WebSocketRoute.send`].

Calling this method again times will override the handler with a new one.

### param: WebSocketRoute.routeSend.handler
* since: v1.48
* langs: js, python
- `handler` <[function]\([string]|[Buffer]\): [Promise<any>|any]>

Handler function to route sent messages.

### param: WebSocketRoute.routeSend.handler
* since: v1.48
* langs: csharp, java
- `handler` <[function]\([WebSocketFrame]\)>

Handler function to route sent messages.


## method: WebSocketRoute.send
* since: v1.48

Sends a message to the server, like it was sent in the page with `WebSocket.send()`.

### param: WebSocketRoute.send.message
* since: v1.48
- `message` <[string]|[Buffer]>

Message to send.


## method: WebSocketRoute.url
* since: v1.48
- returns: <[string]>

URL of the WebSocket created in the page.
