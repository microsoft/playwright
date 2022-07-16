# class: AndroidSocket
* since: v1.9
* langs: js

[AndroidSocket] is a way to communicate with a process launched on the [AndroidDevice]. Use [`method: AndroidDevice.open`] to open a socket.

## event: AndroidSocket.close
* since: v1.9

Emitted when the socket is closed.

## event: AndroidSocket.data
* since: v1.9
- argument: <[Buffer]>

Emitted when data is available to read from the socket.

## async method: AndroidSocket.close
* since: v1.9

Closes the socket.

## async method: AndroidSocket.write
* since: v1.9

Writes some [`param: data`] to the socket.

### param: AndroidSocket.write.data
* since: v1.9
- `data` <[Buffer]>

Data to write.
