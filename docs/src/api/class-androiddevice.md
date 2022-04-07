# class: AndroidDevice
* langs: js

[AndroidDevice] represents a connected device, either real hardware or emulated. Devices can be obtained using [`method: Android.devices`].

## event: AndroidDevice.webView
- argument: <[AndroidWebView]>

Emitted when a new WebView instance is detected.

## async method: AndroidDevice.close

Disconnects from the device.

## async method: AndroidDevice.drag

Drags the widget defined by [`param: selector`] towards [`param: dest`] point.

### param: AndroidDevice.drag.selector
- `selector` <[AndroidSelector]>

Selector to drag.

### param: AndroidDevice.drag.dest
- `dest` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

Point to drag to.

### option: AndroidDevice.drag.speed
- `speed` <[float]>

Optional speed of the drag in pixels per second.

### option: AndroidDevice.drag.timeout = %%-android-timeout-%%

## async method: AndroidDevice.fill

Fills the specific [`param: selector`] input box with [`param: text`].

### param: AndroidDevice.fill.selector
- `selector` <[AndroidSelector]>

Selector to fill.

### param: AndroidDevice.fill.text
- `text` <[string]>

Text to be filled in the input box.

### option: AndroidDevice.fill.timeout = %%-android-timeout-%%

## async method: AndroidDevice.fling

Flings the widget defined by [`param: selector`] in  the specified [`param: direction`].

### param: AndroidDevice.fling.selector
- `selector` <[AndroidSelector]>

Selector to fling.

### param: AndroidDevice.fling.direction
- `direction` <[AndroidFlingDirection]<"down"|"up"|"left"|"right">>

Fling direction.

### option: AndroidDevice.fling.speed
- `speed` <[float]>

Optional speed of the fling in pixels per second.

### option: AndroidDevice.fling.timeout = %%-android-timeout-%%

## async method: AndroidDevice.info
- returns: <[AndroidElementInfo]>

Returns information about a widget defined by [`param: selector`].

### param: AndroidDevice.info.selector
- `selector` <[AndroidSelector]>

Selector to return information about.

## property: AndroidDevice.input
- type: <[AndroidInput]>

## async method: AndroidDevice.installApk

Installs an apk on the device.

### param: AndroidDevice.installApk.file
- `file` <[string]|[Buffer]>

Either a path to the apk file, or apk file content.

### option: AndroidDevice.installApk.args
- `args` <[Array]<[string]>>

Optional arguments to pass to the `shell:cmd package install` call. Defaults to `-r -t -S`.

## async method: AndroidDevice.launchBrowser
- returns: <[BrowserContext]>

Launches Chrome browser on the device, and returns its persistent context.

### option: AndroidDevice.launchBrowser.pkg
- `command` <[string]>

Optional package name to launch instead of default Chrome for Android.

### option: AndroidDevice.launchBrowser.-inline- = %%-shared-context-params-list-%%

## async method: AndroidDevice.longTap

Performs a long tap on the widget defined by [`param: selector`].

### param: AndroidDevice.longTap.selector
- `selector` <[AndroidSelector]>

Selector to tap on.

### option: AndroidDevice.longTap.timeout = %%-android-timeout-%%

## method: AndroidDevice.model
- returns: <[string]>

Device model.

## async method: AndroidDevice.open
- returns: <[AndroidSocket]>

Launches a process in the shell on the device and returns a socket to communicate with the launched process.

### param: AndroidDevice.open.command
- `command` <[string]> Shell command to execute.


## async method: AndroidDevice.pinchClose

Pinches the widget defined by [`param: selector`] in the closing direction.

### param: AndroidDevice.pinchClose.selector
- `selector` <[AndroidSelector]>

Selector to pinch close.

### param: AndroidDevice.pinchClose.percent
- `percent` <[float]>

The size of the pinch as a percentage of the widget's size.

### option: AndroidDevice.pinchClose.speed
- `speed` <[float]>

Optional speed of the pinch in pixels per second.

### option: AndroidDevice.pinchClose.timeout = %%-android-timeout-%%

## async method: AndroidDevice.pinchOpen

Pinches the widget defined by [`param: selector`] in the open direction.

### param: AndroidDevice.pinchOpen.selector
- `selector` <[AndroidSelector]>

Selector to pinch open.

### param: AndroidDevice.pinchOpen.percent
- `percent` <[float]>

The size of the pinch as a percentage of the widget's size.

### option: AndroidDevice.pinchOpen.speed
- `speed` <[float]>

Optional speed of the pinch in pixels per second.

### option: AndroidDevice.pinchOpen.timeout = %%-android-timeout-%%

## async method: AndroidDevice.press

Presses the specific [`param: key`] in the widget defined by [`param: selector`].

### param: AndroidDevice.press.selector
- `selector` <[AndroidSelector]>

Selector to press the key in.

### param: AndroidDevice.press.key
- `key` <[AndroidKey]>

The key to press.

### option: AndroidDevice.press.timeout = %%-android-timeout-%%

## async method: AndroidDevice.push

Copies a file to the device.

### param: AndroidDevice.push.file
- `file` <[string]|[Buffer]>

Either a path to the file, or file content.

### param: AndroidDevice.push.path
- `path` <[string]>

Path to the file on the device.

### option: AndroidDevice.push.mode
- `mode` <[int]>

Optional file mode, defaults to `644` (`rw-r--r--`).

## async method: AndroidDevice.screenshot
- returns: <[Buffer]>

Returns the buffer with the captured screenshot of the device.

### option: AndroidDevice.screenshot.path
- `path` <[path]>

The file path to save the image to. If [`option: path`] is a
relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be
saved to the disk.

## async method: AndroidDevice.scroll

Scrolls the widget defined by [`param: selector`] in  the specified [`param: direction`].

### param: AndroidDevice.scroll.selector
- `selector` <[AndroidSelector]>

Selector to scroll.

### param: AndroidDevice.scroll.direction
- `direction` <[AndroidScrollDirection]<"down"|"up"|"left"|"right">>

Scroll direction.

### param: AndroidDevice.scroll.percent
- `percent` <[float]>

Distance to scroll as a percentage of the widget's size.

### option: AndroidDevice.scroll.speed
- `speed` <[float]>

Optional speed of the scroll in pixels per second.

### option: AndroidDevice.scroll.timeout = %%-android-timeout-%%

## method: AndroidDevice.serial
- returns: <[string]>

Device serial number.

## method: AndroidDevice.setDefaultTimeout

This setting will change the default maximum time for all the methods accepting [`param: timeout`] option.

### param: AndroidDevice.setDefaultTimeout.timeout
- `timeout` <[float]>

Maximum time in milliseconds

## async method: AndroidDevice.shell
- returns: <[Buffer]>

Executes a shell command on the device and returns its output.

### param: AndroidDevice.shell.command
- `command` <[string]>

Shell command to execute.


## async method: AndroidDevice.swipe

Swipes the widget defined by [`param: selector`] in  the specified [`param: direction`].

### param: AndroidDevice.swipe.selector
- `selector` <[AndroidSelector]>

Selector to swipe.

### param: AndroidDevice.swipe.direction
- `direction` <[AndroidSwipeDirection]<"down"|"up"|"left"|"right">>

Swipe direction.

### param: AndroidDevice.swipe.percent
- `percent` <[float]>

Distance to swipe as a percentage of the widget's size.

### option: AndroidDevice.swipe.speed
- `speed` <[float]>

Optional speed of the swipe in pixels per second.

### option: AndroidDevice.swipe.timeout = %%-android-timeout-%%

## async method: AndroidDevice.tap

Taps on the widget defined by [`param: selector`].

### param: AndroidDevice.tap.selector
- `selector` <[AndroidSelector]>

Selector to tap on.

### option: AndroidDevice.tap.duration
- `duration` <[float]>

Optional duration of the tap in milliseconds.

### option: AndroidDevice.tap.timeout = %%-android-timeout-%%

## async method: AndroidDevice.wait

Waits for the specific [`param: selector`] to either appear or disappear, depending on the [`option: state`].

### param: AndroidDevice.wait.selector
- `selector` <[AndroidSelector]>

Selector to wait for.

### option: AndroidDevice.wait.state
- `state` <[AndroidDeviceState]<"gone">>

Optional state. Can be either:
* default - wait for element to be present.
* `'gone'` - wait for element to not be present.

### option: AndroidDevice.wait.timeout = %%-android-timeout-%%

## async method: AndroidDevice.waitForEvent
- returns: <[any]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy value.

### param: AndroidDevice.waitForEvent.event = %%-wait-for-event-event-%%

### param: AndroidDevice.waitForEvent.optionsOrPredicate
- `optionsOrPredicate` ?<[function]|[Object]>
  - `predicate` <[function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` ?<[float]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to
    disable timeout. The default value can be changed by using the [`method: AndroidDevice.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

## async method: AndroidDevice.webView
- returns: <[AndroidWebView]>

This method waits until [AndroidWebView] matching the [`option: selector`] is opened and returns it. If there is already an open [AndroidWebView] matching the [`option: selector`], returns immediately.

### param: AndroidDevice.webView.selector
- `selector` <[Object]>
  - `pkg` <[string]> Package identifier.

### option: AndroidDevice.webView.timeout = %%-android-timeout-%%

## method: AndroidDevice.webViews
- returns: <[Array]<[AndroidWebView]>>

Currently open WebViews.
