# class: WebSocketFrame
* langs: csharp, java

The [WebSocketFrame] class represents frames sent over [WebSocket] connections in the page. Frame payload is returned by either [`method: WebSocketFrame.text`] or [`method: WebSocketFrame.binary`] method depending on the its type.

## method: WebSocketFrame.binary
- returns: <[null]|[Buffer]>

Returns binary payload.

## method: WebSocketFrame.text
- returns: <[null]|[string]>

Returns text payload.
