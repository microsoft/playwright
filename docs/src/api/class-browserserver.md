# class: BrowserServer
* since: v1.8
* langs: js

## event: BrowserServer.close
* since: v1.8

Emitted when the browser server closes.

## async method: BrowserServer.close
* since: v1.8

Closes the browser gracefully and makes sure the process is terminated.

## async method: BrowserServer.kill
* since: v1.8

Kills the browser process and waits for the process to exit.

## method: BrowserServer.process
* since: v1.8
- returns: <[ChildProcess]>

Spawned browser application process.

## method: BrowserServer.wsEndpoint
* since: v1.8
- returns: <[string]>

Browser websocket url.

Browser websocket endpoint which can be used as an argument to [`method: BrowserType.connect`] to establish connection
to the browser.

Note that if the listen `host` option in `launchServer` options is not specified, localhost will be output anyway, even if the actual listening address is an unspecified address.
