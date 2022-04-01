# class: AndroidWebView
* langs: js

[AndroidWebView] represents a WebView open on the [AndroidDevice]. WebView is usually obtained using [`method: AndroidDevice.webView`].

## event: AndroidWebView.close

Emitted when the WebView is closed.

## async method: AndroidWebView.page
- returns: <[Page]>

Connects to the WebView and returns a regular Playwright [Page] to interact with.

## method: AndroidWebView.pid
- returns: <[int]>

WebView process PID.

## method: AndroidWebView.pkg
- returns: <[string]>

WebView package identifier.

## method: AndroidWebView.socketName
- returns: <[string]>

WebView socket name.