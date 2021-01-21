# class: BrowserServer
* langs: js

## event: BrowserServer.close

Emitted when the browser server closes.

## async method: BrowserServer.close

Closes the browser gracefully and makes sure the process is terminated.

## async method: BrowserServer.kill

Kills the browser process and waits for the process to exit.

## method: BrowserServer.process
- returns: <[ChildProcess]>

Spawned browser application process.

## method: BrowserServer.wsEndpoint
- returns: <[string]>

Browser websocket url.

Browser websocket endpoint which can be used as an argument to [`method: BrowserType.connect`] to establish connection
to the browser.
