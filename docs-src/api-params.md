## navigation-wait-until
- `waitUntil` <"load"|"domcontentloaded"|"networkidle"> When to consider operation succeeded, defaults to `load`. Events can be either:
  - `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
  - `'load'` - consider operation to be finished when the `load` event is fired.
  - `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.

## navigation-timeout
- `timeout` <[number]> Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultNavigationTimeout(timeout)](#browsercontextsetdefaultnavigationtimeouttimeout), [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout), [page.setDefaultNavigationTimeout(timeout)](#pagesetdefaultnavigationtimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.

## wait-for-timeout
- `timeout` <[number]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout).

## input-timeout
- `timeout` <[number]> Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by using the [browserContext.setDefaultTimeout(timeout)](#browsercontextsetdefaulttimeouttimeout) or [page.setDefaultTimeout(timeout)](#pagesetdefaulttimeouttimeout) methods.

## input-no-wait-after
- `noWaitAfter` <[boolean]> Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating to inaccessible pages. Defaults to `false`.

## input-force
- `force` <[boolean]> Whether to bypass the [actionability](./actionability.md) checks. Defaults to `false`.

## input-selector
- `selector` <[string]> A selector to search for element. If there are multiple elements satisfying the selector, the first will be used. See [working with selectors](#working-with-selectors) for more details.

## input-position
- `position` <[Object]> A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the element.
  - `x` <[number]>
  - `y` <[number]>

## input-modifiers
- `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">> Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current modifiers back. If not specified, currently pressed modifiers are used.

## input-button
- `button` <"left"|"right"|"middle"> Defaults to `left`.

## input-files
- `files` <[string]|[Array]<[string]>|[Object]|[Array]<[Object]>>
  - `name` <[string]> [File] name **required**
  - `mimeType` <[string]> [File] type **required**
  - `buffer` <[Buffer]> File content **required**

## input-down-up-delay
- `delay` <[number]> Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.

## input-click-count
- `clickCount` <[number]> defaults to 1. See [UIEvent.detail].

## query-selector
- `selector` <[string]> A selector to query for. See [working with selectors](#working-with-selectors) for more details.

## wait-for-selector-state
- `state` <"attached"|"detached"|"visible"|"hidden"> Defaults to `'visible'`. Can be either:
  - `'attached'` - wait for element to be present in DOM.
  - `'detached'` - wait for element to not be present in DOM.
  - `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without any content or with `display:none` has an empty bounding box and is not considered visible.
  - `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`. This is opposite to the `'visible'` option.

## context-storage-state
- `storageState` <[Object]> Populates context with given storage state. This method can be used to initialize context with logged-in information obtained via [browserContext.storageState()](#browsercontextstoragestate).
  - `cookies` <[Array]<[Object]>> Optional cookies to set for context
    - `name` <[string]> **required**
    - `value` <[string]> **required**
    - `url` <[string]> Optional either url or domain / path are required
    - `domain` <[string]> Optional either url or domain / path are required
    - `path` <[string]> Optional either url or domain / path are required
    - `expires` <[number]> Optional Unix time in seconds.
    - `httpOnly` <[boolean]> Optional httpOnly flag
    - `secure` <[boolean]> Optional secure flag
    - `sameSite` <"Strict"|"Lax"|"None"> Optional sameSite flag
  - `origins` <[Array]<[Object]>> Optional localStorage to set for context
    - `origin` <[string]>
    - `localStorage` <[Array]<[Object]>>
      - `name` <[string]>
      - `value` <[string]>

## shared-context-params
- `acceptDownloads` <[boolean]> Whether to automatically download all the attachments. Defaults to `false` where all the downloads are canceled.
- `ignoreHTTPSErrors` <[boolean]> Whether to ignore HTTPS errors during navigation. Defaults to `false`.
- `bypassCSP` <[boolean]> Toggles bypassing page's Content-Security-Policy.
- `viewport` <[null]|[Object]> Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.
  - `width` <[number]> page width in pixels.
  - `height` <[number]> page height in pixels.
- `userAgent` <[string]> Specific user agent to use in this context.
- `deviceScaleFactor` <[number]> Specify device scale factor (can be thought of as dpr). Defaults to `1`.
- `isMobile` <[boolean]> Whether the `meta viewport` tag is taken into account and touch events are enabled. Defaults to `false`. Not supported in Firefox.
- `hasTouch` <[boolean]> Specifies if viewport supports touch events. Defaults to false.
- `javaScriptEnabled` <[boolean]> Whether or not to enable JavaScript in the context. Defaults to `true`.
- `timezoneId` <[string]> Changes the timezone of the context. See [ICU’s `metaZones.txt`](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1) for a list of supported timezone IDs.
- `geolocation` <[Object]>
  - `latitude` <[number]> Latitude between -90 and 90.
  - `longitude` <[number]> Longitude between -180 and 180.
  - `accuracy` <[number]> Non-negative accuracy value. Defaults to `0`.
- `locale` <[string]> Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language` request header value as well as number and date formatting rules.
- `permissions` <[Array]<[string]>> A list of permissions to grant to all pages in this context. See [browserContext.grantPermissions](#browsercontextgrantpermissionspermissions-options) for more details.
- `extraHTTPHeaders` <[Object]<[string], [string]>> An object containing additional HTTP headers to be sent with every request. All header values must be strings.
- `offline` <[boolean]> Whether to emulate network being offline. Defaults to `false`.
- `httpCredentials` <[Object]> Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
  - `username` <[string]>
  - `password` <[string]>
- `colorScheme` <"light"|"dark"|"no-preference"> Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. See [page.emulateMedia(options)](#pageemulatemediaoptions) for more details. Defaults to '`light`'.
- `logger` <[Logger]> Logger sink for Playwright logging.
- `videosPath` <[string]> **NOTE** Use `recordVideo` instead, it takes precedence over `videosPath`. Enables video recording for all pages to `videosPath` directory. If not specified, videos are not recorded. Make sure to await [`browserContext.close`](#browsercontextclose) for videos to be saved.
- `videoSize` <[Object]> **NOTE** Use `recordVideo` instead, it takes precedence over `videoSize`. Specifies dimensions of the automatically recorded video. Can only be used if `videosPath` is set. If not specified the size will be equal to `viewport`. If `viewport` is not configured explicitly the video size defaults to 1280x720. Actual picture of the page will be scaled down if necessary to fit specified size.
  - `width` <[number]> Video frame width.
  - `height` <[number]> Video frame height.
- `recordHar` <[Object]> Enables [HAR](http://www.softwareishard.com/blog/har-12-spec) recording for all pages into `recordHar.path` file. If not specified, the HAR is not recorded. Make sure to await [`browserContext.close`](#browsercontextclose) for the HAR to be saved.
  - `omitContent` <[boolean]> Optional setting to control whether to omit request content from the HAR. Defaults to `false`.
  - `path` <[string]> Path on the filesystem to write the HAR file to.
- `recordVideo` <[Object]> Enables video recording for all pages into `recordVideo.dir` directory. If not specified videos are not recorded. Make sure to await [`browserContext.close`](#browsercontextclose) for videos to be saved.
  - `dir` <[string]> Path to the directory to put videos into.
  - `size` <[Object]> Optional dimensions of the recorded videos. If not specified the size will be equal to `viewport`. If `viewport` is not configured explicitly the video size defaults to 1280x720. Actual picture of each page will be scaled down if necessary to fit the specified size.
    - `width` <[number]> Video frame width.
    - `height` <[number]> Video frame height.

## context-proxy-params
- `proxy` <[Object]> Network proxy settings to use with this context. Note that browser needs to be launched with the global proxy for this option to work. If all contexts override the proxy, global proxy will be never used and can be any string, for example `launch({ proxy: { server: 'per-context' } })`.
  - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
  - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
  - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
  - `password` <[string]> Optional password to use if HTTP proxy requires authentication.
