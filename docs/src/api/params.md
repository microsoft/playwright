## navigation-wait-until
- `waitUntil` <[WaitUntilState]<"load"|"domcontentloaded"|"networkidle">>

When to consider operation succeeded, defaults to `load`. Events can be either:
* `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
* `'load'` - consider operation to be finished when the `load` event is fired.
* `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.

## navigation-timeout
- `timeout` <[float]>

Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout.
The default value can be changed by using the
[`method: BrowserContext.setDefaultNavigationTimeout`],
[`method: BrowserContext.setDefaultTimeout`],
[`method: Page.setDefaultNavigationTimeout`] or
[`method: Page.setDefaultTimeout`] methods.

## wait-for-timeout
- `timeout` <[float]>

maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default
value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

## input-timeout
- `timeout` <[float]>

Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by
using the [`method: BrowserContext.setDefaultTimeout`] or
[`method: Page.setDefaultTimeout`] methods.

## input-no-wait-after
- `noWaitAfter` <[boolean]>

Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can
opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating
to inaccessible pages. Defaults to `false`.

## input-force
- `force` <[boolean]>

Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.

## input-selector
- `selector` <[string]>

A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See
[working with selectors](./selectors.md) for more details.

## input-position
- `position` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the
element.

## input-modifiers
- `modifiers` <[Array]<[KeyboardModifier]<"Alt"|"Control"|"Meta"|"Shift">>>

Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current
modifiers back. If not specified, currently pressed modifiers are used.

## input-button
- `button` <[MouseButton]<"left"|"right"|"middle">>

Defaults to `left`.

## input-files
- `files` <[path]|[Array]<[path]>|[Object]|[Array]<[Object]>>
  - `name` <[string]> File name
  - `mimeType` <[string]> File type
  - `buffer` <[Buffer]> File content

## input-down-up-delay
- `delay` <[float]>

Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.

## input-click-count
- `clickCount` <[int]>

defaults to 1. See [UIEvent.detail].

## input-trial
- `trial` <[boolean]>

When set, this method only performs the [actionability](./actionability.md) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

## query-selector
- `selector` <[string]>

A selector to query for. See [working with selectors](./selectors.md) for more details.

## wait-for-selector-state
- `state` <[WaitForSelectorState]<"attached"|"detached"|"visible"|"hidden">>

Defaults to `'visible'`. Can be either:
* `'attached'` - wait for element to be present in DOM.
* `'detached'` - wait for element to not be present in DOM.
* `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without
  any content or with `display:none` has an empty bounding box and is not considered visible.
* `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`.
  This is opposite to the `'visible'` option.

## js-python-wait-for-function-polling
* langs: js, python
- `polling` <[float]|"raf">

If [`option: polling`] is `'raf'`, then [`param: expression`] is constantly executed in `requestAnimationFrame`
callback. If [`option: polling`] is a number, then it is treated as an interval in milliseconds at which the function
would be executed. Defaults to `raf`.

## csharp-java-wait-for-function-polling
* langs: csharp, java
- `pollingInterval` <[float]>

If specified, then it is treated as an interval in milliseconds at which the function would be executed. By default if the option is not specified [`param: expression`] is executed in `requestAnimationFrame` callback.

## browser-option-ignoredefaultargs
* langs: js, python
- `ignoreDefaultArgs` <[boolean]|[Array]<[string]>>

If `true`, Playwright does not pass its own configurations args and only uses the ones from [`option: args`]. If an
array is given, then filters out the given default arguments. Dangerous option; use with care. Defaults to `false`.

## csharp-java-browser-option-ignoredefaultargs
* langs: csharp, java
- `ignoreDefaultArgs` <[Array]<[string]>>

If `true`, Playwright does not pass its own configurations args and only uses the ones from [`option: args`].
Dangerous option; use with care.

## csharp-java-browser-option-ignorealldefaultargs
* langs: csharp, java
- `ignoreAllDefaultArgs` <[boolean]>

If `true`, Playwright does not pass its own configurations args and only uses the ones from [`option: args`].
Dangerous option; use with care. Defaults to `false`.

## browser-option-proxy
- `proxy` <[Object]>
  - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example
    `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP
    proxy.
  - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org,
    .domain.com"`.
  - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
  - `password` <[string]> Optional password to use if HTTP proxy requires authentication.

Network proxy settings.

## csharp-java-browser-option-env
* langs: csharp, java
- `env` <[Object]<[string], [string]>>

Specify environment variables that will be visible to the browser. Defaults to `process.env`.

## js-python-browser-option-env
* langs: js, python
- `env` <[Object]<[string], [string]|[float]|[boolean]>>

Specify environment variables that will be visible to the browser. Defaults to `process.env`.

## js-python-context-option-storage-state
* langs: js, python
- `storageState` <[path]|[Object]>
  - `cookies` <[Array]<[Object]>> Optional cookies to set for context
    - `name` <[string]>
    - `value` <[string]>
    - `url` <[string]> Optional either url or domain / path are required
    - `domain` <[string]> Optional either url or domain / path are required
    - `path` <[string]> Optional either url or domain / path are required
    - `expires` <[float]> Optional Unix time in seconds.
    - `httpOnly` <[boolean]> Optional httpOnly flag
    - `secure` <[boolean]> Optional secure flag
    - `sameSite` <[SameSiteAttribute]<"Strict"|"Lax"|"None">> Optional sameSite flag
  - `origins` <[Array]<[Object]>> Optional localStorage to set for context
    - `origin` <[string]>
    - `localStorage` <[Array]<[Object]>>
      - `name` <[string]>
      - `value` <[string]>

Populates context with given storage state. This option can be used to initialize context with logged-in information
obtained via [`method: BrowserContext.storageState`]. Either a path to the file with saved storage, or an object with the following fields:

## csharp-java-context-option-storage-state
* langs: csharp, java
- `storageState` <[string]>

Populates context with given storage state. This option can be used to initialize context with logged-in information
obtained via [`method: BrowserContext.storageState`].

## csharp-java-context-option-storage-state-path
* langs: csharp, java
- `storageStatePath` <[path]>

Populates context with given storage state. This option can be used to initialize context with logged-in information
obtained via [`method: BrowserContext.storageState`]. Path to the file with saved storage state.

## context-option-acceptdownloads
- `acceptDownloads` <[boolean]>

Whether to automatically download all the attachments. Defaults to `false` where all the downloads are canceled.

## context-option-ignorehttpserrors
- `ignoreHTTPSErrors` <[boolean]>

Whether to ignore HTTPS errors during navigation. Defaults to `false`.

## context-option-bypasscsp
- `bypassCSP` <[boolean]>

Toggles bypassing page's Content-Security-Policy.

## context-option-baseURL
- `baseURL` <[string]>

When using [`method: Page.goto`], [`method: Page.route`], [`method: Page.waitForURL`], [`method: Page.waitForRequest`], or [`method: Page.waitForResponse`] it takes the base URL in consideration by using the [`URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor for building the corresponding URL. Examples:
* baseURL: `http://localhost:3000` and navigating to `/bar.html` results in `http://localhost:3000/bar.html`
* baseURL: `http://localhost:3000/foo/` and navigating to `./bar.html` results in `http://localhost:3000/foo/bar.html`

## context-option-viewport
* langs: js, java
  - alias-java: viewportSize
- `viewport` <[null]|[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

Emulates consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.

## csharp-context-option-viewport
* langs: csharp
  - alias-csharp: viewportSize
- `viewport` <[null]|[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

Emulates consistent viewport for each page. Defaults to an 1280x720 viewport. Use `ViewportSize.NoViewport` to disable the default viewport.

## context-option-screen
* langs:
  - alias-java: screenSize
  - alias-csharp: screenSize
- `screen` <[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

Emulates consistent window screen size available inside web page via `window.screen`. Is only used when the
[`option: viewport`] is set.

## evaluate-expression
- `expression` <[string]>

JavaScript expression to be evaluated in the browser context. If it looks like
a function declaration, it is interpreted as a function. Otherwise, evaluated
as an expression.

## js-evaluate-pagefunction
* langs: js
- `pageFunction` <[function]|[string]>

Function to be evaluated in the page context.

## js-evalonselector-pagefunction
* langs: js
- `pageFunction` <[function]\([Element]\)>

Function to be evaluated in the page context.

## js-evalonselectorall-pagefunction
* langs: js
- `pageFunction` <[function]\([Array]<[Element]>\)>

Function to be evaluated in the page context.

## js-worker-evaluate-workerfunction
* langs: js
- `pageFunction` <[function]|[string]>

Function to be evaluated in the worker context.

## js-electron-evaluate-workerfunction
* langs: js
- `pageFunction` <[function]|[Electron]>

Function to be evaluated in the worker context.

## python-context-option-viewport
* langs: python
- `viewport` <[null]|[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `no_viewport` disables the fixed viewport.

## python-context-option-no-viewport
* langs: python
- `noViewport` <[boolean]>

Does not enforce fixed viewport, allows resizing window in the headed mode.

## context-option-useragent
- `userAgent` <[string]>

Specific user agent to use in this context.

## context-option-devicescalefactor
- `deviceScaleFactor` <[float]>

Specify device scale factor (can be thought of as dpr). Defaults to `1`.

## context-option-ismobile
- `isMobile` <[boolean]>

Whether the `meta viewport` tag is taken into account and touch events are enabled. Defaults to `false`. Not supported
in Firefox.

## context-option-hastouch
- `hasTouch` <[boolean]>

Specifies if viewport supports touch events. Defaults to false.

## context-option-javascriptenabled
- `javaScriptEnabled` <[boolean]>

Whether or not to enable JavaScript in the context. Defaults to `true`.

## context-option-timezoneid
- `timezoneId` <[string]>

Changes the timezone of the context. See [ICU's metaZones.txt](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1)
for a list of supported timezone IDs.

## context-option-geolocation
- `geolocation` <[Object]>
  - `latitude` <[float]> Latitude between -90 and 90.
  - `longitude` <[float]> Longitude between -180 and 180.
  - `accuracy` <[float]> Non-negative accuracy value. Defaults to `0`.

## context-option-locale
- `locale` <[string]>

Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language`
request header value as well as number and date formatting rules.

## context-option-permissions
- `permissions` <[Array]<[string]>>

A list of permissions to grant to all pages in this context. See
[`method: BrowserContext.grantPermissions`] for more details.

## context-option-extrahttpheaders
- `extraHTTPHeaders` <[Object]<[string], [string]>>

An object containing additional HTTP headers to be sent with every request. All header values must be strings.

## context-option-offline
- `offline` <[boolean]>

Whether to emulate network being offline. Defaults to `false`.

## context-option-httpcredentials
- `httpCredentials` <[Object]>
  - `username` <[string]>
  - `password` <[string]>

Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).

## context-option-colorscheme
- `colorScheme` <[ColorScheme]<"light"|"dark"|"no-preference">>

Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. See
[`method: Page.emulateMedia`] for more details. Defaults to `'light'`.

## context-option-reducedMotion
- `reducedMotion` <[ReducedMotion]<"reduce"|"no-preference">>

Emulates `'prefers-reduced-motion'` media feature, supported values are `'reduce'`, `'no-preference'`. See [`method: Page.emulateMedia`] for more details. Defaults
to `'no-preference'`.

## context-option-logger
* langs: js
- `logger` <[Logger]>

Logger sink for Playwright logging.

## context-option-videospath
* langs: js
- `videosPath` <[path]>

**DEPRECATED** Use [`option: recordVideo`] instead.

## context-option-videosize
* langs: js
- `videoSize` <[Object]>
  - `width` <[int]> Video frame width.
  - `height` <[int]> Video frame height.

**DEPRECATED** Use [`option: recordVideo`] instead.

## context-option-recordhar
* langs: js
- `recordHar` <[Object]>
  - `omitContent` <[boolean]> Optional setting to control whether to omit request content from the HAR. Defaults to
    `false`.
  - `path` <[path]> Path on the filesystem to write the HAR file to.

Enables [HAR](http://www.softwareishard.com/blog/har-12-spec) recording for all pages into `recordHar.path` file. If not
specified, the HAR is not recorded. Make sure to await [`method: BrowserContext.close`] for the HAR to be
saved.

## context-option-recordhar-path
* langs: csharp, java, python
  - alias-python: record_har_path
- `recordHarPath` <[path]>

Enables [HAR](http://www.softwareishard.com/blog/har-12-spec) recording for all pages into the
specified HAR file on the filesystem. If not specified, the HAR is not recorded. Make sure to
call [`method: BrowserContext.close`] for the HAR to be saved.

## context-option-recordhar-omit-content
* langs: csharp, java, python
  - alias-python: record_har_omit_content
- `recordHarOmitContent` <[boolean]>

Optional setting to control whether to omit request content from the HAR. Defaults to `false`.

## context-option-recordvideo
* langs: js
- `recordVideo` <[Object]>
  - `dir` <[path]> Path to the directory to put videos into.
  - `size` <[Object]> Optional dimensions of the recorded videos. If not specified the size will be equal to `viewport`
    scaled down to fit into 800x800. If `viewport` is not configured explicitly the video size defaults to 800x450.
    Actual picture of each page will be scaled down if necessary to fit the specified size.
    - `width` <[int]> Video frame width.
    - `height` <[int]> Video frame height.

Enables video recording for all pages into `recordVideo.dir` directory. If not specified videos are not recorded. Make
sure to await [`method: BrowserContext.close`] for videos to be saved.

## context-option-recordvideo-dir
* langs: csharp, java, python
  - alias-python: record_video_dir
- `recordVideoDir` <[path]>

Enables video recording for all pages into the specified directory. If not specified videos are
not recorded. Make sure to call [`method: BrowserContext.close`] for videos to be saved.

## context-option-recordvideo-size
* langs: csharp, java, python
  - alias-python: record_video_size
- `recordVideoSize` <[Object]>
  If `viewport` is not configured explicitly the video size defaults to 800x450. Actual picture of each page will be
  scaled down if necessary to fit the specified size.
  - `width` <[int]> Video frame width.
  - `height` <[int]> Video frame height.

Dimensions of the recorded videos. If not specified the size will be equal to `viewport`
scaled down to fit into 800x800. If `viewport` is not configured explicitly the video size defaults to 800x450.
Actual picture of each page will be scaled down if necessary to fit the specified size.

## context-option-proxy
- `proxy` <[Object]>
  - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example
    `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
  - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
  - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
  - `password` <[string]> Optional password to use if HTTP proxy requires authentication.

Network proxy settings to use with this context.

:::note
For Chromium on Windows the browser needs to be launched with the global proxy for this option to work. If all
contexts override the proxy, global proxy will be never used and can be any string, for example
`launch({ proxy: { server: 'http://per-context' } })`.
:::

## select-options-values
* langs: java, js, csharp
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>>
  - `value` <[string]> Matches by `option.value`. Optional.
  - `label` <[string]> Matches by `option.label`. Optional.
  - `index` <[int]> Matches by the index. Optional.

Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the
first option matching one of the passed options is selected. String values are equivalent to `{value:'string'}`. Option
is considered matching if all specified properties match.

## wait-for-navigation-url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while waiting for the navigation.

## wait-for-event-event
* langs: js, python, java
- `event` <[string]>

Event name, same one typically passed into `*.on(event)`.

## wait-for-load-state-state
- `state` <[LoadState]<"load"|"domcontentloaded"|"networkidle">>

Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the
method resolves immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - wait until there are no network connections for at least `500` ms.

## screenshot-type
- `type` <[ScreenshotType]<"png"|"jpeg">>

Specify screenshot type, defaults to `png`.

## java-wait-for-event-callback
* langs: java
- `callback` <[Runnable]>

Callback that performs the action triggering the event.

## csharp-wait-for-event-action
* langs: csharp
- `action` <[Func<Task>]>

Action that triggers the event.

## python-select-options-element
* langs: python
- `element` <[ElementHandle]|[Array]<[ElementHandle]>>

Option elements to select. Optional.

## python-select-options-index
* langs: python
- `index` <[int]|[Array]<[int]>>

Options to select by index. Optional.

## python-select-options-value
* langs: python
- `value` <[string]|[Array]<[string]>>

Options to select by value. If the `<select>` has the `multiple` attribute, all given options are selected, otherwise
only the first option matching one of the passed options is selected. Optional.

## python-select-options-label
* langs: python
- `label` <[string]|[Array]<[string]>>

Options to select by label. If the `<select>` has the `multiple` attribute, all given options are selected, otherwise
only the first option matching one of the passed options is selected. Optional.

## wait-for-event-predicate
- `predicate` <[function]>

Receives the event data and resolves to truthy value when the waiting should resolve.

## wait-for-event-timeout
* langs: csharp, java, python
- `timeout` <[float]>

Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.
The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

## android-timeout
* langs: js
- `timeout` <[float]>

Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by
using the [`method: AndroidDevice.setDefaultTimeout`] method.

## shared-context-params-list
- %%-context-option-acceptdownloads-%%
- %%-context-option-ignorehttpserrors-%%
- %%-context-option-bypasscsp-%%
- %%-context-option-baseURL-%%
- %%-context-option-viewport-%%
- %%-csharp-context-option-viewport-%%
- %%-python-context-option-viewport-%%
- %%-context-option-screen-%%
- %%-python-context-option-no-viewport-%%
- %%-context-option-useragent-%%
- %%-context-option-devicescalefactor-%%
- %%-context-option-ismobile-%%
- %%-context-option-hastouch-%%
- %%-context-option-javascriptenabled-%%
- %%-context-option-timezoneid-%%
- %%-context-option-geolocation-%%
- %%-context-option-locale-%%
- %%-context-option-permissions-%%
- %%-context-option-extrahttpheaders-%%
- %%-context-option-offline-%%
- %%-context-option-httpcredentials-%%
- %%-context-option-colorscheme-%%
- %%-context-option-reducedMotion-%%
- %%-context-option-logger-%%
- %%-context-option-videospath-%%
- %%-context-option-videosize-%%
- %%-context-option-recordhar-%%
- %%-context-option-recordhar-path-%%
- %%-context-option-recordhar-omit-content-%%
- %%-context-option-recordvideo-%%
- %%-context-option-recordvideo-dir-%%
- %%-context-option-recordvideo-size-%%

## browser-option-args
- `args` <[Array]<[string]>>

Additional arguments to pass to the browser instance. The list of Chromium flags can be found
[here](http://peter.sh/experiments/chromium-command-line-switches/).

## browser-option-channel
- `channel` <[string]>

Browser distribution channel.  Supported values are "chrome", "chrome-beta", "chrome-dev", "chrome-canary", "msedge", "msedge-beta", "msedge-dev", "msedge-canary". Read more about using [Google Chrome and Microsoft Edge](./browsers.md#google-chrome--microsoft-edge).

## browser-option-chromiumsandbox
- `chromiumSandbox` <[boolean]>

Enable Chromium sandboxing. Defaults to `false`.


## browser-option-downloadspath
- `downloadsPath` <[path]>

If specified, accepted downloads are downloaded into this directory. Otherwise, temporary directory is created and is
deleted when browser is closed.

## browser-option-executablepath
- `executablePath` <[path]>

Path to a browser executable to run instead of the bundled one. If [`option: executablePath`] is a relative path, then
it is resolved relative to the current working directory. Note that Playwright only works with the bundled Chromium,
Firefox or WebKit, use at your own risk.

## browser-option-handlesigint
- `handleSIGINT` <[boolean]>

Close the browser process on Ctrl-C. Defaults to `true`.

## browser-option-handlesigterm
- `handleSIGTERM` <[boolean]>

Close the browser process on SIGTERM. Defaults to `true`.

## browser-option-handlesighup
- `handleSIGHUP` <[boolean]>

Close the browser process on SIGHUP. Defaults to `true`.

## browser-option-headless
- `headless` <[boolean]>

Whether to run browser in headless mode. More details for
[Chromium](https://developers.google.com/web/updates/2017/04/headless-chrome) and
[Firefox](https://developer.mozilla.org/en-US/docs/Mozilla/Firefox/Headless_mode). Defaults to `true` unless the
[`option: devtools`] option is `true`.

## js-python-browser-option-firefoxuserprefs
* langs: js, python
- `firefoxUserPrefs` <[Object]<[string], [string]|[float]|[boolean]>>

Firefox user preferences. Learn more about the Firefox user preferences at
[`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).

## csharp-java-browser-option-firefoxuserprefs
* langs: csharp, java
- `firefoxUserPrefs` <[Object]<[string], [any]>>

Firefox user preferences. Learn more about the Firefox user preferences at
[`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).

## browser-option-logger
* langs: js
- `logger` <[Logger]>

Logger sink for Playwright logging.

## browser-option-timeout
- `timeout` <[float]>

Maximum time in milliseconds to wait for the browser instance to start. Defaults to `30000` (30 seconds). Pass `0` to
disable timeout.

## browser-option-tracesdir
- `tracesDir` <[path]>

If specified, traces are saved into this directory.

## browser-option-devtools
- `devtools` <[boolean]>

**Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the
[`option: headless`] option will be set `false`.

## browser-option-slowmo
- `slowMo` <[float]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.

## shared-browser-options-list
- %%-browser-option-args-%%
- %%-browser-option-channel-%%
- %%-browser-option-chromiumsandbox-%%
- %%-browser-option-devtools-%%
- %%-browser-option-downloadspath-%%
- %%-csharp-java-browser-option-env-%%
- %%-js-python-browser-option-env-%%
- %%-browser-option-executablepath-%%
- %%-browser-option-handlesigint-%%
- %%-browser-option-handlesigterm-%%
- %%-browser-option-handlesighup-%%
- %%-browser-option-headless-%%
- %%-browser-option-ignoredefaultargs-%%
- %%-browser-option-proxy-%%
- %%-browser-option-timeout-%%
- %%-browser-option-tracesdir-%%
