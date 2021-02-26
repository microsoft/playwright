# class: AndroidSocket
* langs: js

[AndroidSocket] is a way to communicate with a process launched on the [AndroidDevice]. Use [`method: AndroidDevice.open`] to open a socket.

## event: AndroidSocket.close

Emitted when the socket is closed.

## event: AndroidSocket.data
- argument: <[Buffer]>

Emitted when data is available to read from the socket.

## async method: AndroidSocket.close

Closes the socket.

## async method: AndroidSocket.write

Writes some [`param: data`] to the socket.

### param: AndroidSocket.write.data
- `data` <[Buffer]>

Data to write.
