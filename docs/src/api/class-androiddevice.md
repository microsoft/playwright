# class: AndroidDevice
* since: v1.9
* langs: js

[AndroidDevice] represents a connected device, either real hardware or emulated. Devices can be obtained using [`method: Android.devices`].

## event: AndroidDevice.close
* since: v1.28
- argument: <[AndroidDevice]>

Emitted when the device connection gets closed.

## event: AndroidDevice.webView
* since: v1.9
- argument: <[AndroidWebView]>

Emitted when a new WebView instance is detected.

## async method: AndroidDevice.close
* since: v1.9

Disconnects from the device.

## async method: AndroidDevice.drag
* since: v1.9

Drags the widget defined by [`param: selector`] towards [`param: dest`] point.

### param: AndroidDevice.drag.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to drag.

### param: AndroidDevice.drag.dest
* since: v1.9
- `dest` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

Point to drag to.

### option: AndroidDevice.drag.speed
* since: v1.9
- `speed` <[float]>

Optional speed of the drag in pixels per second.

### option: AndroidDevice.drag.timeout = %%-android-timeout-%%
* since: v1.9

## async method: AndroidDevice.fill
* since: v1.9

Fills the specific [`param: selector`] input box with [`param: text`].

### param: AndroidDevice.fill.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to fill.

### param: AndroidDevice.fill.text
* since: v1.9
- `text` <[string]>

Text to be filled in the input box.

### option: AndroidDevice.fill.timeout = %%-android-timeout-%%
* since: v1.9

## async method: AndroidDevice.fling
* since: v1.9

Flings the widget defined by [`param: selector`] in  the specified [`param: direction`].

### param: AndroidDevice.fling.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to fling.

### param: AndroidDevice.fling.direction
* since: v1.9
- `direction` <[AndroidFlingDirection]<"down"|"up"|"left"|"right">>

Fling direction.

### option: AndroidDevice.fling.speed
* since: v1.9
- `speed` <[float]>

Optional speed of the fling in pixels per second.

### option: AndroidDevice.fling.timeout = %%-android-timeout-%%
* since: v1.9

## async method: AndroidDevice.info
* since: v1.9
- returns: <[AndroidElementInfo]>

Returns information about a widget defined by [`param: selector`].

### param: AndroidDevice.info.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to return information about.

## property: AndroidDevice.input
* since: v1.9
- type: <[AndroidInput]>

## async method: AndroidDevice.installApk
* since: v1.9

Installs an apk on the device.

### param: AndroidDevice.installApk.file
* since: v1.9
- `file` <[string]|[Buffer]>

Either a path to the apk file, or apk file content.

### option: AndroidDevice.installApk.args
* since: v1.9
- `args` <[Array]<[string]>>

Optional arguments to pass to the `shell:cmd package install` call. Defaults to `-r -t -S`.

## async method: AndroidDevice.launchBrowser
* since: v1.9
- returns: <[BrowserContext]>

Launches Chrome browser on the device, and returns its persistent context.

### option: AndroidDevice.launchBrowser.pkg
* since: v1.9
- `pkg` <[string]>

Optional package name to launch instead of default Chrome for Android.

### option: AndroidDevice.launchBrowser.-inline- = %%-shared-context-params-list-v1.8-%%
* since: v1.9

### option: AndroidDevice.launchBrowser.proxy = %%-browser-option-proxy-%%
* since: v1.29

### option: AndroidDevice.launchBrowser.args = %%-browser-option-args-%%
* since: v1.29

## async method: AndroidDevice.longTap
* since: v1.9

Performs a long tap on the widget defined by [`param: selector`].

### param: AndroidDevice.longTap.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to tap on.

### option: AndroidDevice.longTap.timeout = %%-android-timeout-%%
* since: v1.9

## method: AndroidDevice.model
* since: v1.9
- returns: <[string]>

Device model.

## async method: AndroidDevice.open
* since: v1.9
- returns: <[AndroidSocket]>

Launches a process in the shell on the device and returns a socket to communicate with the launched process.

### param: AndroidDevice.open.command
* since: v1.9
- `command` <[string]>

Shell command to execute.

## async method: AndroidDevice.pinchClose
* since: v1.9

Pinches the widget defined by [`param: selector`] in the closing direction.

### param: AndroidDevice.pinchClose.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to pinch close.

### param: AndroidDevice.pinchClose.percent
* since: v1.9
- `percent` <[float]>

The size of the pinch as a percentage of the widget's size.

### option: AndroidDevice.pinchClose.speed
* since: v1.9
- `speed` <[float]>

Optional speed of the pinch in pixels per second.

### option: AndroidDevice.pinchClose.timeout = %%-android-timeout-%%
* since: v1.9

## async method: AndroidDevice.pinchOpen
* since: v1.9

Pinches the widget defined by [`param: selector`] in the open direction.

### param: AndroidDevice.pinchOpen.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to pinch open.

### param: AndroidDevice.pinchOpen.percent
* since: v1.9
- `percent` <[float]>

The size of the pinch as a percentage of the widget's size.

### option: AndroidDevice.pinchOpen.speed
* since: v1.9
- `speed` <[float]>

Optional speed of the pinch in pixels per second.

### option: AndroidDevice.pinchOpen.timeout = %%-android-timeout-%%
* since: v1.9

## async method: AndroidDevice.press
* since: v1.9

Presses the specific [`param: key`] in the widget defined by [`param: selector`].

### param: AndroidDevice.press.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to press the key in.

### param: AndroidDevice.press.key
* since: v1.9
- `key` <[AndroidKey]>

The key to press.

### option: AndroidDevice.press.timeout = %%-android-timeout-%%
* since: v1.9

## async method: AndroidDevice.push
* since: v1.9

Copies a file to the device.

### param: AndroidDevice.push.file
* since: v1.9
- `file` <[string]|[Buffer]>

Either a path to the file, or file content.

### param: AndroidDevice.push.path
* since: v1.9
- `path` <[string]>

Path to the file on the device.

### option: AndroidDevice.push.mode
* since: v1.9
- `mode` <[int]>

Optional file mode, defaults to `644` (`rw-r--r--`).

## async method: AndroidDevice.screenshot
* since: v1.9
- returns: <[Buffer]>

Returns the buffer with the captured screenshot of the device.

### option: AndroidDevice.screenshot.path
* since: v1.9
- `path` <[path]>

The file path to save the image to. If [`option: path`] is a
relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be
saved to the disk.

## async method: AndroidDevice.scroll
* since: v1.9

Scrolls the widget defined by [`param: selector`] in  the specified [`param: direction`].

### param: AndroidDevice.scroll.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to scroll.

### param: AndroidDevice.scroll.direction
* since: v1.9
- `direction` <[AndroidScrollDirection]<"down"|"up"|"left"|"right">>

Scroll direction.

### param: AndroidDevice.scroll.percent
* since: v1.9
- `percent` <[float]>

Distance to scroll as a percentage of the widget's size.

### option: AndroidDevice.scroll.speed
* since: v1.9
- `speed` <[float]>

Optional speed of the scroll in pixels per second.

### option: AndroidDevice.scroll.timeout = %%-android-timeout-%%
* since: v1.9

## method: AndroidDevice.serial
* since: v1.9
- returns: <[string]>

Device serial number.

## method: AndroidDevice.setDefaultTimeout
* since: v1.9

This setting will change the default maximum time for all the methods accepting [`param: timeout`] option.

### param: AndroidDevice.setDefaultTimeout.timeout
* since: v1.9
- `timeout` <[float]>

Maximum time in milliseconds

## async method: AndroidDevice.shell
* since: v1.9
- returns: <[Buffer]>

Executes a shell command on the device and returns its output.

### param: AndroidDevice.shell.command
* since: v1.9
- `command` <[string]>

Shell command to execute.

## async method: AndroidDevice.swipe
* since: v1.9

Swipes the widget defined by [`param: selector`] in  the specified [`param: direction`].

### param: AndroidDevice.swipe.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to swipe.

### param: AndroidDevice.swipe.direction
* since: v1.9
- `direction` <[AndroidSwipeDirection]<"down"|"up"|"left"|"right">>

Swipe direction.

### param: AndroidDevice.swipe.percent
* since: v1.9
- `percent` <[float]>

Distance to swipe as a percentage of the widget's size.

### option: AndroidDevice.swipe.speed
* since: v1.9
- `speed` <[float]>

Optional speed of the swipe in pixels per second.

### option: AndroidDevice.swipe.timeout = %%-android-timeout-%%
* since: v1.9

## async method: AndroidDevice.tap
* since: v1.9

Taps on the widget defined by [`param: selector`].

### param: AndroidDevice.tap.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to tap on.

### option: AndroidDevice.tap.duration
* since: v1.9
- `duration` <[float]>

Optional duration of the tap in milliseconds.

### option: AndroidDevice.tap.timeout = %%-android-timeout-%%
* since: v1.9

## async method: AndroidDevice.wait
* since: v1.9

Waits for the specific [`param: selector`] to either appear or disappear, depending on the [`option: state`].

### param: AndroidDevice.wait.selector
* since: v1.9
- `selector` <[AndroidSelector]>

Selector to wait for.

### option: AndroidDevice.wait.state
* since: v1.9
- `state` <[AndroidDeviceState]<"gone">>

Optional state. Can be either:
* default - wait for element to be present.
* `'gone'` - wait for element to not be present.

### option: AndroidDevice.wait.timeout = %%-android-timeout-%%
* since: v1.9

## async method: AndroidDevice.waitForEvent
* since: v1.9
- returns: <[any]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy value.

### param: AndroidDevice.waitForEvent.event = %%-wait-for-event-event-%%
* since: v1.9

### param: AndroidDevice.waitForEvent.optionsOrPredicate
* since: v1.9
- `optionsOrPredicate` ?<[function]|[Object]>
  - `predicate` <[function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` ?<[float]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to
    disable timeout. The default value can be changed by using the [`method: AndroidDevice.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

## async method: AndroidDevice.webView
* since: v1.9
- returns: <[AndroidWebView]>

This method waits until [AndroidWebView] matching the [`param: selector`] is opened and returns it. If there is already an open [AndroidWebView] matching the [`param: selector`], returns immediately.

### param: AndroidDevice.webView.selector
* since: v1.9
- `selector` <[Object]>
  - `pkg` ?<[string]> Optional Package identifier.
  - `socketName` ?<[string]> Optional webview socket name.

### option: AndroidDevice.webView.timeout = %%-android-timeout-%%
* since: v1.9

## method: AndroidDevice.webViews
* since: v1.9
- returns: <[Array]<[AndroidWebView]>>

Currently open WebViews.
