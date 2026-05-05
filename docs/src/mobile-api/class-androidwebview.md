# class: AndroidWebView
* since: v1.9
* langs: js

[AndroidWebView] represents a WebView open on the [AndroidDevice]. WebView is usually obtained using [`method: AndroidDevice.webView`].

## event: AndroidWebView.close
* since: v1.9

Emitted when the WebView is closed.

## async method: AndroidWebView.page
* since: v1.9
- returns: <[Page]>

Connects to the WebView and returns a regular Playwright [Page] to interact with.

## method: AndroidWebView.pid
* since: v1.9
- returns: <[int]>

WebView process PID.

## method: AndroidWebView.pkg
* since: v1.9
- returns: <[string]>

WebView package identifier.
