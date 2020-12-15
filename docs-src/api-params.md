## navigation-wait-until

- `waitUntil` <"load"|"domcontentloaded"|"networkidle">
  - `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
  - `'load'` - consider operation to be finished when the `load` event is fired.
  - `'networkidle'` - consider operation to be finished when there are no network connections for at least `500` ms.

When to consider operation succeeded, defaults to `load`. Events can be either:

## navigation-timeout

- `timeout` <[number]>

Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout.
The default value can be changed by using the
[browserContext.setDefaultNavigationTimeout()](),
[browserContext.setDefaultTimeout()](),
[page.setDefaultNavigationTimeout()]() or
[page.setDefaultTimeout()]() methods.

## wait-for-timeout

- `timeout` <[number]>

maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default
value can be changed by using the [browserContext.setDefaultTimeout()]().

## input-timeout

- `timeout` <[number]>

Maximum time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout. The default value can be changed by
using the [browserContext.setDefaultTimeout()]() or
[page.setDefaultTimeout()]() methods.

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
[working with selectors](#working-with-selectors) for more details.

## input-position

- `position` <[Object]>
  - `x` <[number]>
  - `y` <[number]>

A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the
element.

## input-modifiers

- `modifiers` <[Array]<"Alt"|"Control"|"Meta"|"Shift">>

Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current
modifiers back. If not specified, currently pressed modifiers are used.

## input-button

- `button` <"left"|"right"|"middle">

Defaults to `left`.

## input-files

- `files` <[string]|[Array]<[string]>|[Object]|[Array]<[Object]>>
  - `name` <[string]> [File] name **required**
  - `mimeType` <[string]> [File] type **required**
  - `buffer` <[Buffer]> File content **required**

## input-down-up-delay

- `delay` <[number]>

Time to wait between `mousedown` and `mouseup` in milliseconds. Defaults to 0.

## input-click-count

- `clickCount` <[number]>

defaults to 1. See [UIEvent.detail].

## query-selector

- `selector` <[string]>

A selector to query for. See [working with selectors](#working-with-selectors) for more details.

## wait-for-selector-state

- `state` <"attached"|"detached"|"visible"|"hidden">
  - `'attached'` - wait for element to be present in DOM.
  - `'detached'` - wait for element to not be present in DOM.
  - `'visible'` - wait for element to have non-empty bounding box and no `visibility:hidden`. Note that element without
    any content or with `display:none` has an empty bounding box and is not considered visible.
  - `'hidden'` - wait for element to be either detached from DOM, or have an empty bounding box or `visibility:hidden`.
    This is opposite to the `'visible'` option.

Defaults to `'visible'`. Can be either:

## context-option-storage-state

- `storageState` <[string]|[Object]>
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

Populates context with given storage state. This method can be used to initialize context with logged-in information
obtained via [browserContext.storageState()](). Either a path to the file with saved storage, or an object with the following fields:

## context-option-acceptdownloads

- `acceptDownloads` <[boolean]>

Whether to automatically download all the attachments. Defaults to `false` where all the downloads are canceled.

## context-option-ignorehttpserrors

- `ignoreHTTPSErrors` <[boolean]>

Whether to ignore HTTPS errors during navigation. Defaults to `false`.

## context-option-bypasscsp

- `bypassCSP` <[boolean]>

Toggles bypassing page's Content-Security-Policy.

## context-option-viewport

- `viewport` <[null]|[Object]>
  - `width` <[number]> page width in pixels.
  - `height` <[number]> page height in pixels.

Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `null` disables the default viewport.

## context-option-useragent

- `userAgent` <[string]>

Specific user agent to use in this context.

## context-option-devicescalefactor

- `deviceScaleFactor` <[number]>

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

Changes the timezone of the context. See [ICU’s `metaZones.txt`](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1)
for a list of supported timezone IDs.

## context-option-geolocation

- `geolocation` <[Object]>
  - `latitude` <[number]> Latitude between -90 and 90.
  - `longitude` <[number]> Longitude between -180 and 180.
  - `accuracy` <[number]> Non-negative accuracy value. Defaults to `0`.

## context-option-locale

- `locale` <[string]>

Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language`
request header value as well as number and date formatting rules.

## context-option-permissions

- `permissions` <[Array]<[string]>>

A list of permissions to grant to all pages in this context. See
[browserContext.grantPermissions()]() for more details.

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

- `colorScheme` <"light"|"dark"|"no-preference">

Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. See
[page.emulateMedia()]() for more details. Defaults to '`light`'.

## context-option-logger

- `logger` <[Logger]>

Logger sink for Playwright logging.

## context-option-videospath

- `videosPath` <[string]>

**NOTE** Use `recordVideo` instead, it takes precedence over `videosPath`. Enables video recording for all pages to
`videosPath` directory. If not specified, videos are not recorded. Make sure to await
[browserContext.close()]() for videos to be saved.

## context-option-videosize

- `videoSize` <[Object]>
  - `width` <[number]> Video frame width.
  - `height` <[number]> Video frame height.

**NOTE** Use `recordVideo` instead, it takes precedence over `videoSize`. Specifies dimensions of the automatically
recorded video. Can only be used if `videosPath` is set. If not specified the size will be equal to `viewport`. If
`viewport` is not configured explicitly the video size defaults to 1280x720. Actual picture of the page will be scaled
down if necessary to fit specified size.

## context-option-recordhar

- `recordHar` <[Object]>
  - `omitContent` <[boolean]> Optional setting to control whether to omit request content from the HAR. Defaults to
    `false`.
  - `path` <[string]> Path on the filesystem to write the HAR file to.

Enables [HAR](http://www.softwareishard.com/blog/har-12-spec) recording for all pages into `recordHar.path` file. If not
specified, the HAR is not recorded. Make sure to await [browserContext.close()]() for the HAR to be
saved.

## context-option-recordvideo

- `recordVideo` <[Object]>
  - `dir` <[string]> Path to the directory to put videos into.
  - `size` <[Object]> Optional dimensions of the recorded videos. If not specified the size will be equal to `viewport`.
    If `viewport` is not configured explicitly the video size defaults to 1280x720. Actual picture of each page will be
    scaled down if necessary to fit the specified size.
    - `width` <[number]> Video frame width.
    - `height` <[number]> Video frame height.

Enables video recording for all pages into `recordVideo.dir` directory. If not specified videos are not recorded. Make
sure to await [browserContext.close()]() for videos to be saved.

## context-option-proxy

- `proxy` <[Object]>
  - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example
    `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
  - `bypass` <[string]> Optional coma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
  - `username` <[string]> Optional username to use if HTTP proxy requires authentication.
  - `password` <[string]> Optional password to use if HTTP proxy requires authentication.

Network proxy settings to use with this context. Note that browser needs to be launched with the global proxy for this
option to work. If all contexts override the proxy, global proxy will be never used and can be any string, for example
`launch({ proxy: { server: 'per-context' } })`.

## shared-context-params-list
- %%-context-option-acceptdownloads-%%
- %%-context-option-ignorehttpserrors-%%
- %%-context-option-bypasscsp-%%
- %%-context-option-viewport-%%
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
- %%-context-option-logger-%%
- %%-context-option-videospath-%%
- %%-context-option-videosize-%%
- %%-context-option-recordhar-%%
- %%-context-option-recordvideo-%%
