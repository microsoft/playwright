# class: WebSocket

The [WebSocket] class represents websocket connections in the page.

## event: WebSocket.close
- type: <[WebSocket]>

Fired when the websocket closes.

## event: WebSocket.framereceived
- type: <[Object]>
  - `payload` <[string]|[Buffer]> frame payload

Fired when the websocket recieves a frame.

## event: WebSocket.framesent
- type: <[Object]>
  - `payload` <[string]|[Buffer]> frame payload

Fired when the websocket sends a frame.

## event: WebSocket.socketerror
- type: <[String]>

Fired when the websocket has an error.

## method: WebSocket.isClosed
- returns: <[boolean]>

Indicates that the web socket has been closed.

## method: WebSocket.url
- returns: <[string]>

Contains the URL of the WebSocket.

## async method: WebSocket.waitForEvent
* langs:
  - alias-python: expect_event
- returns: <[any]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy
value. Will throw an error if the webSocket is closed before the event is fired. Returns the event data value.

### param: WebSocket.waitForEvent.event
- `event` <[string]>

Event name, same one would pass into `webSocket.on(event)`.

### param: WebSocket.waitForEvent.optionsOrPredicate
* langs: js
- `optionsOrPredicate` <[function]|[Object]>
  - `predicate` <[function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[float]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.
