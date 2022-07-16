# class: WebSocketFrame
* since: v1.9
* langs: csharp, java

The [WebSocketFrame] class represents frames sent over [WebSocket] connections in the page. Frame payload is returned by either [`method: WebSocketFrame.text`] or [`method: WebSocketFrame.binary`] method depending on the its type.

## method: WebSocketFrame.binary
* since: v1.9
- returns: <[null]|[Buffer]>

Returns binary payload.

## method: WebSocketFrame.text
* since: v1.9
- returns: <[null]|[string]>

Returns text payload.
