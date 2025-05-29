# class: WebSocketRoute
* since: v1.48

Whenever a [`WebSocket`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket) route is set up with [`method: Page.routeWebSocket`] or [`method: BrowserContext.routeWebSocket`], the `WebSocketRoute` object allows to handle the WebSocket, like an actual server would do.

**Mocking**

By default, the routed WebSocket will not connect to the server. This way, you can mock entire communication over the WebSocket. Here is an example that responds to a `"request"` with a `"response"`.

```js
await page.routeWebSocket('wss://example.com/ws', ws => {
  ws.onMessage(message => {
    if (message === 'request')
      ws.send('response');
  });
});
```

```java
page.routeWebSocket("wss://example.com/ws", ws -> {
  ws.onMessage(frame -> {
    if ("request".equals(frame.text()))
      ws.send("response");
  });
});
```

```python async
def message_handler(ws: WebSocketRoute, message: Union[str, bytes]):
  if message == "request":
    ws.send("response")

await page.route_web_socket("wss://example.com/ws", lambda ws: ws.on_message(
    lambda message: message_handler(ws, message)
))
```

```python sync
def message_handler(ws: WebSocketRoute, message: Union[str, bytes]):
  if message == "request":
    ws.send("response")

page.route_web_socket("wss://example.com/ws", lambda ws: ws.on_message(
    lambda message: message_handler(ws, message)
))
```

```csharp
await page.RouteWebSocketAsync("wss://example.com/ws", ws => {
  ws.OnMessage(frame => {
    if (frame.Text == "request")
      ws.Send("response");
  });
});
```

Since we do not call [`method: WebSocketRoute.connectToServer`] inside the WebSocket route handler, Playwright assumes that WebSocket will be mocked, and opens the WebSocket inside the page automatically.

Here is another example that handles JSON messages:

```js
await page.routeWebSocket('wss://example.com/ws', ws => {
  ws.onMessage(message => {
    const json = JSON.parse(message);
    if (json.request === 'question')
      ws.send(JSON.stringify({ response: 'answer' }));
  });
});
```

```java
page.routeWebSocket("wss://example.com/ws", ws -> {
  ws.onMessage(frame -> {
    JsonObject json = new JsonParser().parse(frame.text()).getAsJsonObject();
    if ("question".equals(json.get("request").getAsString())) {
      Map<String, String> result = new HashMap();
      result.put("response", "answer");
      ws.send(gson.toJson(result));
    }
  });
});
```

```python async
def message_handler(ws: WebSocketRoute, message: Union[str, bytes]):
  json_message = json.loads(message)
  if json_message["request"] == "question":
    ws.send(json.dumps({ "response": "answer" }))

await page.route_web_socket("wss://example.com/ws", lambda ws: ws.on_message(
    lambda message: message_handler(ws, message)
))
```

```python sync
def message_handler(ws: WebSocketRoute, message: Union[str, bytes]):
  json_message = json.loads(message)
  if json_message["request"] == "question":
    ws.send(json.dumps({ "response": "answer" }))

page.route_web_socket("wss://example.com/ws", lambda ws: ws.on_message(
    lambda message: message_handler(ws, message)
))
```

```csharp
await page.RouteWebSocketAsync("wss://example.com/ws", ws => {
  ws.OnMessage(frame => {
    using var jsonDoc = JsonDocument.Parse(frame.Text);
    JsonElement root = jsonDoc.RootElement;
    if (root.TryGetProperty("request", out JsonElement requestElement) && requestElement.GetString() == "question")
    {
      var response = new Dictionary<string, string> { ["response"] = "answer" };
      string jsonResponse = JsonSerializer.Serialize(response);
      ws.Send(jsonResponse);
    }
  });
});
```


**Intercepting**

Alternatively, you may want to connect to the actual server, but intercept messages in-between and modify or block them. Calling [`method: WebSocketRoute.connectToServer`] returns a server-side `WebSocketRoute` instance that you can send messages to, or handle incoming messages.

Below is an example that modifies some messages sent by the page to the server. Messages sent from the server to the page are left intact, relying on the default forwarding.

```js
await page.routeWebSocket('/ws', ws => {
  const server = ws.connectToServer();
  ws.onMessage(message => {
    if (message === 'request')
      server.send('request2');
    else
      server.send(message);
  });
});
```

```java
page.routeWebSocket("/ws", ws -> {
  WebSocketRoute server = ws.connectToServer();
  ws.onMessage(frame -> {
    if ("request".equals(frame.text()))
      server.send("request2");
    else
      server.send(frame.text());
  });
});
```

```python async
def message_handler(server: WebSocketRoute, message: Union[str, bytes]):
  if message == "request":
    server.send("request2")
  else:
    server.send(message)

def handler(ws: WebSocketRoute):
  server = ws.connect_to_server()
  ws.on_message(lambda message: message_handler(server, message))

await page.route_web_socket("/ws", handler)
```

```python sync
def message_handler(server: WebSocketRoute, message: Union[str, bytes]):
  if message == "request":
    server.send("request2")
  else:
    server.send(message)

def handler(ws: WebSocketRoute):
  server = ws.connect_to_server()
  ws.on_message(lambda message: message_handler(server, message))

page.route_web_socket("/ws", handler)
```

```csharp
await page.RouteWebSocketAsync("/ws", ws => {
  var server = ws.ConnectToServer();
  ws.OnMessage(frame => {
    if (frame.Text == "request")
      server.Send("request2");
    else
      server.Send(frame.Text);
  });
});
```

After connecting to the server, all **messages are forwarded** between the page and the server by default.

However, if you call [`method: WebSocketRoute.onMessage`] on the original route, messages from the page to the server **will not be forwarded** anymore, but should instead be handled by the [`param: WebSocketRoute.onMessage.handler`].

Similarly, calling [`method: WebSocketRoute.onMessage`] on the server-side WebSocket will **stop forwarding messages** from the server to the page, and [`param: WebSocketRoute.onMessage.handler`] should take care of them.


The following example blocks some messages in both directions. Since it calls [`method: WebSocketRoute.onMessage`] in both directions, there is no automatic forwarding at all.

```js
await page.routeWebSocket('/ws', ws => {
  const server = ws.connectToServer();
  ws.onMessage(message => {
    if (message !== 'blocked-from-the-page')
      server.send(message);
  });
  server.onMessage(message => {
    if (message !== 'blocked-from-the-server')
      ws.send(message);
  });
});
```

```java
page.routeWebSocket("/ws", ws -> {
  WebSocketRoute server = ws.connectToServer();
  ws.onMessage(frame -> {
    if (!"blocked-from-the-page".equals(frame.text()))
      server.send(frame.text());
  });
  server.onMessage(frame -> {
    if (!"blocked-from-the-server".equals(frame.text()))
      ws.send(frame.text());
  });
});
```

```python async
def ws_message_handler(server: WebSocketRoute, message: Union[str, bytes]):
  if message != "blocked-from-the-page":
    server.send(message)

def server_message_handler(ws: WebSocketRoute, message: Union[str, bytes]):
  if message != "blocked-from-the-server":
    ws.send(message)

def handler(ws: WebSocketRoute):
  server = ws.connect_to_server()
  ws.on_message(lambda message: ws_message_handler(server, message))
  server.on_message(lambda message: server_message_handler(ws, message))

await page.route_web_socket("/ws", handler)
```

```python sync
def ws_message_handler(server: WebSocketRoute, message: Union[str, bytes]):
  if message != "blocked-from-the-page":
    server.send(message)

def server_message_handler(ws: WebSocketRoute, message: Union[str, bytes]):
  if message != "blocked-from-the-server":
    ws.send(message)

def handler(ws: WebSocketRoute):
  server = ws.connect_to_server()
  ws.on_message(lambda message: ws_message_handler(server, message))
  server.on_message(lambda message: server_message_handler(ws, message))

page.route_web_socket("/ws", handler)
```

```csharp
await page.RouteWebSocketAsync("/ws", ws => {
  var server = ws.ConnectToServer();
  ws.OnMessage(frame => {
    if (frame.Text != "blocked-from-the-page")
      server.Send(frame.Text);
  });
  server.OnMessage(frame => {
    if (frame.Text != "blocked-from-the-server")
      ws.Send(frame.Text);
  });
});
```



## async method: WebSocketRoute.close
* since: v1.48

Closes one side of the WebSocket connection.

### option: WebSocketRoute.close.code
* since: v1.48
- `code` <[int]>

Optional [close code](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#code).

### option: WebSocketRoute.close.reason
* since: v1.48
- `reason` <[string]>

Optional [close reason](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#reason).



## method: WebSocketRoute.connectToServer
* since: v1.48
- returns: <[WebSocketRoute]>

By default, routed WebSocket does not connect to the server, so you can mock entire WebSocket communication. This method connects to the actual WebSocket server, and returns the server-side [WebSocketRoute] instance, giving the ability to send and receive messages from the server.

Once connected to the server:
* Messages received from the server will be **automatically forwarded** to the WebSocket in the page, unless [`method: WebSocketRoute.onMessage`] is called on the server-side `WebSocketRoute`.
* Messages sent by the [`WebSocket.send()`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/send) call in the page will be **automatically forwarded** to the server, unless [`method: WebSocketRoute.onMessage`] is called on the original `WebSocketRoute`.

See examples at the top for more details.



## method: WebSocketRoute.onClose
* since: v1.48

Allows to handle [`WebSocket.close`](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close).

By default, closing one side of the connection, either in the page or on the server, will close the other side. However, when [`method: WebSocketRoute.onClose`] handler is set up, the default forwarding of closure is disabled, and handler should take care of it.

### param: WebSocketRoute.onClose.handler
* since: v1.48
* langs: js, python
- `handler` <[function]\([int]|[undefined], [string]|[undefined]\): [Promise<any>|any]>

Function that will handle WebSocket closure. Received an optional [close code](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#code) and an optional [close reason](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#reason).

### param: WebSocketRoute.onClose.handler
* since: v1.48
* langs: java
- `handler` <[function]\([null]|[int], [null]|[string]\)>

Function that will handle WebSocket closure. Received an optional [close code](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#code) and an optional [close reason](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#reason).

### param: WebSocketRoute.onClose.handler
* since: v1.48
* langs: csharp
- `handler` <[function]\([int?], [string?]\)>

Function that will handle WebSocket closure. Received an optional [close code](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#code) and an optional [close reason](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/close#reason).

## method: WebSocketRoute.onMessage
* since: v1.48

This method allows to handle messages that are sent by the WebSocket, either from the page or from the server.

When called on the original WebSocket route, this method handles messages sent from the page. You can handle this messages by responding to them with [`method: WebSocketRoute.send`], forwarding them to the server-side connection returned by [`method: WebSocketRoute.connectToServer`] or do something else.

Once this method is called, messages are not automatically forwarded to the server or to the page - you should do that manually by calling [`method: WebSocketRoute.send`]. See examples at the top for more details.

Calling this method again will override the handler with a new one.

### param: WebSocketRoute.onMessage.handler
* since: v1.48
* langs: js, python
- `handler` <[function]\([string]\): [Promise<any>|any]>

Function that will handle messages.

### param: WebSocketRoute.onMessage.handler
* since: v1.48
* langs: csharp, java
- `handler` <[function]\([WebSocketFrame]\)>

Function that will handle messages.



## method: WebSocketRoute.send
* since: v1.48

Sends a message to the WebSocket. When called on the original WebSocket, sends the message to the page. When called on the result of [`method: WebSocketRoute.connectToServer`], sends the message to the server. See examples at the top for more details.

### param: WebSocketRoute.send.message
* since: v1.48
- `message` <[string]|[Buffer]>

Message to send.



## method: WebSocketRoute.url
* since: v1.48
- returns: <[string]>

URL of the WebSocket created in the page.
