## navigation-wait-until
- `waitUntil` <[WaitUntilState]<"load"|"domcontentloaded"|"networkidle"|"commit">>

When to consider operation succeeded, defaults to `load`. Events can be either:
* `'domcontentloaded'` - consider operation to be finished when the `DOMContentLoaded` event is fired.
* `'load'` - consider operation to be finished when the `load` event is fired.
* `'networkidle'` - **DISCOURAGED** consider operation to be finished when there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.
* `'commit'` - consider operation to be finished when network response is received and the document started loading.

## navigation-timeout
* langs: python, java, csharp
- `timeout` <[float]>

Maximum operation time in milliseconds, defaults to 30 seconds, pass `0` to disable timeout.
The default value can be changed by using the
[`method: BrowserContext.setDefaultNavigationTimeout`],
[`method: BrowserContext.setDefaultTimeout`],
[`method: Page.setDefaultNavigationTimeout`] or
[`method: Page.setDefaultTimeout`] methods.

## navigation-timeout-js
* langs: js
- `timeout` <[float]>

Maximum operation time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `navigationTimeout` option in the config, or by using the [`method: BrowserContext.setDefaultNavigationTimeout`],
[`method: BrowserContext.setDefaultTimeout`],
[`method: Page.setDefaultNavigationTimeout`] or
[`method: Page.setDefaultTimeout`] methods.

## wait-for-function-timeout
* langs: python, java, csharp
- `timeout` <[float]>

Maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default
value can be changed by using the [`method: BrowserContext.setDefaultTimeout`] or [`method: Page.setDefaultTimeout`] methods.

## wait-for-function-timeout-js
* langs: js
- `timeout` <[float]>

Maximum time to wait for in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [`method: BrowserContext.setDefaultTimeout`] or [`method: Page.setDefaultTimeout`] methods.

## input-strict
- `strict` <[boolean]>

When true, the call requires selector to resolve to a single element. If given selector resolves to more
than one element, the call throws an exception.

## input-timeout
* langs: python, java, csharp
- `timeout` <[float]>

Maximum time in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout. The default value can be changed by
using the [`method: BrowserContext.setDefaultTimeout`] or
[`method: Page.setDefaultTimeout`] methods.

## input-timeout-js
* langs: js
- `timeout` <[float]>

Maximum time in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [`method: BrowserContext.setDefaultTimeout`] or
[`method: Page.setDefaultTimeout`] methods.

## input-no-wait-after
* deprecated: This option will default to `true` in the future.
- `noWaitAfter` <[boolean]>

Actions that initiate navigations are waiting for these navigations to happen and for pages to start loading. You can
opt out of waiting via setting this flag. You would only need this option in the exceptional cases such as navigating
to inaccessible pages. Defaults to `false`.

## input-no-wait-after-removed
* deprecated: This option has no effect.
- `noWaitAfter` <[boolean]>

This option has no effect.

## input-force
- `force` <[boolean]>

Whether to bypass the [actionability](../actionability.md) checks. Defaults to `false`.

## input-selector
- `selector` <[string]>

A selector to search for an element. If there are multiple elements satisfying the selector, the first will be used.

## input-source
- `source` <[string]>

A selector to search for an element to drag. If there are multiple elements satisfying the selector, the first will be used.

## input-target
- `target` <[string]>

A selector to search for an element to drop onto. If there are multiple elements satisfying the selector, the first will be used.

## input-position
- `position` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

A point to use relative to the top-left corner of element padding box. If not specified, uses some visible point of the
element.

## input-modifiers
- `modifiers` <[Array]<[KeyboardModifier]<"Alt"|"Control"|"ControlOrMeta"|"Meta"|"Shift">>>

Modifier keys to press. Ensures that only these modifiers are pressed during the operation, and then restores current
modifiers back. If not specified, currently pressed modifiers are used. "ControlOrMeta" resolves to "Control" on Windows
and Linux and to "Meta" on macOS.

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

When set, this method only performs the [actionability](../actionability.md) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it.

## input-trial-with-modifiers
- `trial` <[boolean]>

When set, this method only performs the [actionability](../actionability.md) checks and skips the action. Defaults to `false`. Useful to wait until the element is ready for the action without performing it. Note that keyboard `modifiers` will be pressed regardless of `trial` to allow testing elements which are only visible when those keys are pressed.

## input-source-position
- `sourcePosition` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

Clicks on the source element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.

## input-target-position
- `targetPosition` <[Object]>
  - `x` <[float]>
  - `y` <[float]>

Drops on the target element at this point relative to the top-left corner of the element's padding box. If not specified, some visible point of the element is used.

## input-checked
* langs:
  - alias-csharp: checkedState
- `checked` <[boolean]>

Whether to check or uncheck the checkbox.

## query-selector
- `selector` <[string]>

A selector to query for.

## find-selector
- `selector` <[string]>

A selector to use when resolving DOM element.

## find-selector-or-locator
- `selectorOrLocator` <[string]|[Locator]>

A selector or locator to use when resolving DOM element.

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
  - `bypass` ?<[string]> Optional comma-separated domains to bypass proxy, for example `".com, chromium.org,
    .domain.com"`.
  - `username` ?<[string]> Optional username to use if HTTP proxy requires authentication.
  - `password` ?<[string]> Optional password to use if HTTP proxy requires authentication.

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
  - `cookies` <[Array]<[Object]>> Cookies to set for context
    - `name` <[string]>
    - `value` <[string]>
    - `domain` <[string]> Domain and path are required. For the cookie to apply to all subdomains as well, prefix domain with a dot, like this: ".example.com"
    - `path` <[string]> Domain and path are required
    - `expires` <[float]> Unix time in seconds.
    - `httpOnly` <[boolean]>
    - `secure` <[boolean]>
    - `sameSite` <[SameSiteAttribute]<"Strict"|"Lax"|"None">> sameSite flag
  - `origins` <[Array]<[Object]>>
    - `origin` <[string]>
    - `localStorage` <[Array]<[Object]>> localStorage to set for context
      - `name` <[string]>
      - `value` <[string]>

Learn more about [storage state and auth](../auth.md).

Populates context with given storage state. This option can be used to initialize context with logged-in information obtained via [`method: BrowserContext.storageState`].

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

## storagestate-option-path
- `path` <[path]>

The file path to save the storage state to. If [`option: path`] is a relative path, then it is resolved relative to
current working directory. If no path is provided, storage
state is still returned, but won't be saved to the disk.

## context-option-acceptdownloads
- `acceptDownloads` <[boolean]>

Whether to automatically download all the attachments. Defaults to `true` where all the downloads are accepted.

## context-option-ignorehttpserrors
- `ignoreHTTPSErrors` <[boolean]>

Whether to ignore HTTPS errors when sending network requests. Defaults to `false`.

## context-option-bypasscsp
- `bypassCSP` <[boolean]>

Toggles bypassing page's Content-Security-Policy. Defaults to `false`.

## context-option-baseURL
- `baseURL` <[string]>

When using [`method: Page.goto`], [`method: Page.route`], [`method: Page.waitForURL`], [`method: Page.waitForRequest`], or [`method: Page.waitForResponse`] it takes the base URL in consideration by using the [`URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor for building the corresponding URL. Unset by default. Examples:
* baseURL: `http://localhost:3000` and navigating to `/bar.html` results in `http://localhost:3000/bar.html`
* baseURL: `http://localhost:3000/foo/` and navigating to `./bar.html` results in `http://localhost:3000/foo/bar.html`
* baseURL: `http://localhost:3000/foo` (without trailing slash) and navigating to `./bar.html` results in `http://localhost:3000/bar.html`

## context-option-viewport
* langs: js, java
  - alias-java: viewportSize
- `viewport` <[null]|[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

Emulates consistent viewport for each page. Defaults to an 1280x720 viewport.
Use `null` to disable the consistent viewport emulation. Learn more about [viewport emulation](../emulation#viewport).

:::note
The `null` value opts out from the default presets, makes viewport depend on the
host window size defined by the operating system. It makes the execution of the
tests non-deterministic.
:::

## csharp-context-option-viewport
* langs: csharp
  - alias-csharp: viewportSize
- `viewport` <[null]|[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

Emulates consistent viewport for each page. Defaults to an 1280x720 viewport.
Use `ViewportSize.NoViewport` to disable the consistent viewport emulation. Learn more about [viewport emulation](../emulation.md#viewport).

:::note
The `ViewportSize.NoViewport` value opts out from the default presets,
makes viewport depend on the host window size defined by the operating system.
It makes the execution of the tests non-deterministic.
:::

## context-option-screen
* langs:
  - alias-java: screenSize
  - alias-csharp: screenSize
- `screen` <[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

Emulates consistent window screen size available inside web page via `window.screen`. Is only used when the
[`option: viewport`] is set.

## fetch-param-url
- `url` <[string]>

Target URL.

## js-fetch-option-params
* langs: js
- `params` <[Object]<[string], [string]|[float]|[boolean]>|[URLSearchParams]|[string]>

Query parameters to be sent with the URL.

## python-fetch-option-params
* langs: python
- `params` <[Object]<[string], [string]|[float]|[boolean]>|[string]>

Query parameters to be sent with the URL.

## csharp-fetch-option-params
* langs: csharp
- `params` <[Object]<[string], [Serializable]>>

Query parameters to be sent with the URL.

## csharp-fetch-option-paramsString
* langs: csharp
- `paramsString` <[string]>

Query parameters to be sent with the URL.

## java-fetch-params
* langs: java
- `options` ?<[RequestOptions]>

Optional request parameters.

## js-python-csharp-fetch-option-headers
* langs: js, python, csharp
- `headers` <[Object]<[string], [string]>>

Allows to set HTTP headers. These headers will apply to the fetched request as well as any redirects initiated by it.

## js-python-csharp-fetch-option-timeout
* langs: js, python, csharp
- `timeout` <[float]>

Request timeout in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to disable timeout.

## js-python-csharp-fetch-option-failonstatuscode
* langs: js, python, csharp
- `failOnStatusCode` <[boolean]>

Whether to throw on response codes other than 2xx and 3xx. By default response object is returned
for all status codes.

## js-fetch-option-form
* langs: js
- `form` <[Object]<[string], [string]|[float]|[boolean]>|[FormData]>

Provides an object that will be serialized as html form using `application/x-www-form-urlencoded` encoding and sent as
this request body. If this parameter is specified `content-type` header will be set to `application/x-www-form-urlencoded`
unless explicitly provided.

## python-fetch-option-form
* langs: python
- `form` <[Object]<[string], [string]|[float]|[boolean]>>

Provides an object that will be serialized as html form using `application/x-www-form-urlencoded` encoding and sent as
this request body. If this parameter is specified `content-type` header will be set to `application/x-www-form-urlencoded`
unless explicitly provided.

## csharp-fetch-option-form
* langs: csharp
- `form` <[FormData]>

Provides an object that will be serialized as html form using `application/x-www-form-urlencoded` encoding and sent as
this request body. If this parameter is specified `content-type` header will be set to `application/x-www-form-urlencoded`
unless explicitly provided.

An instance of [FormData] can be created via [`method: APIRequestContext.createFormData`].

## js-fetch-option-multipart
* langs: js
- `multipart` <[FormData]|[Object]<[string], [string]|[float]|[boolean]|[ReadStream]|[Object]>>
  - `name` <[string]> File name
  - `mimeType` <[string]> File type
  - `buffer` <[Buffer]> File content

Provides an object that will be serialized as html form using `multipart/form-data` encoding and sent as
this request body. If this parameter is specified `content-type` header will be set to `multipart/form-data`
unless explicitly provided. File values can be passed either as [`fs.ReadStream`](https://nodejs.org/api/fs.html#fs_class_fs_readstream)
or as file-like object containing file name, mime-type and its content.

## python-fetch-option-multipart
* langs: python
- `multipart` <[Object]<[string], [string]|[float]|[boolean]|[ReadStream]|[Object]>>
  - `name` <[string]> File name
  - `mimeType` <[string]> File type
  - `buffer` <[Buffer]> File content

Provides an object that will be serialized as html form using `multipart/form-data` encoding and sent as
this request body. If this parameter is specified `content-type` header will be set to `multipart/form-data`
unless explicitly provided. File values can be passed as file-like object containing file name, mime-type and its content.

## csharp-fetch-option-multipart
* langs: csharp
- `multipart` <[FormData]>

Provides an object that will be serialized as html form using `multipart/form-data` encoding and sent as
this request body. If this parameter is specified `content-type` header will be set to `multipart/form-data`
unless explicitly provided. File values can be passed as file-like object containing file name, mime-type and its content.

An instance of [FormData] can be created via [`method: APIRequestContext.createFormData`].

## js-python-csharp-fetch-option-data
* langs: js, python, csharp
- `data` <[string]|[Buffer]|[Serializable]>

Allows to set post data of the request. If the data parameter is an object, it will be serialized to json string
and `content-type` header will be set to `application/json` if not explicitly set. Otherwise the `content-type` header will be
set to `application/octet-stream` if not explicitly set.

## js-python-csharp-fetch-option-ignorehttpserrors
* langs: js, python, csharp
- `ignoreHTTPSErrors` <[boolean]>

Whether to ignore HTTPS errors when sending network requests. Defaults to `false`.

## js-python-csharp-fetch-option-maxredirects
* langs: js, python, csharp
- `maxRedirects` <[int]>

Maximum number of request redirects that will be followed automatically. An error will be thrown if the number is exceeded.
Defaults to `20`. Pass `0` to not follow redirects.

## js-python-csharp-fetch-option-maxretries
* langs: js, python, csharp
- `maxRetries` <[int]>

Maximum number of times network errors should be retried. Currently only `ECONNRESET` error is retried. Does not retry based on HTTP response codes. An error will be thrown if the limit is exceeded. Defaults to `0` - no retries.

## evaluate-expression
- `expression` <[string]>

JavaScript expression to be evaluated in the browser context. If the expression evaluates
to a function, the function is automatically invoked.

## js-evaluate-pagefunction
* langs: js
- `pageFunction` <[function]|[string]>

Function to be evaluated in the page context.

## js-evalonselector-pagefunction
* langs: js
- `pageFunction` <[function]\([Element]\)|[string]>

Function to be evaluated in the page context.

## js-evalonselectorall-pagefunction
* langs: js
- `pageFunction` <[function]\([Array]<[Element]>\)|[string]>

Function to be evaluated in the page context.

## js-worker-evaluate-workerfunction
* langs: js
- `pageFunction` <[function]|[string]>

Function to be evaluated in the worker context.

## js-electron-evaluate-workerfunction
* langs: js
- `pageFunction` <[function]|[Electron]>

Function to be evaluated in the main Electron process.

## python-context-option-viewport
* langs: python
- `viewport` <[null]|[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

Sets a consistent viewport for each page. Defaults to an 1280x720 viewport. `no_viewport` disables the fixed viewport. Learn more about [viewport emulation](../emulation.md#viewport).

## python-context-option-no-viewport
* langs: python
- `noViewport` <[boolean]>

Does not enforce fixed viewport, allows resizing window in the headed mode.

## context-option-clientCertificates
- `clientCertificates` <[Array]<[Object]>>
  - `origin` <[string]> Exact origin that the certificate is valid for. Origin includes `https` protocol, a hostname and optionally a port.
  - `certPath` ?<[path]> Path to the file with the certificate in PEM format.
  - `cert` ?<[Buffer]> Direct value of the certificate in PEM format.
  - `keyPath` ?<[path]> Path to the file with the private key in PEM format.
  - `key` ?<[Buffer]> Direct value of the private key in PEM format.
  - `pfxPath` ?<[path]> Path to the PFX or PKCS12 encoded private key and certificate chain.
  - `pfx` ?<[Buffer]> Direct value of the PFX or PKCS12 encoded private key and certificate chain.
  - `passphrase` ?<[string]> Passphrase for the private key (PEM or PFX).

TLS Client Authentication allows the server to request a client certificate and verify it.

**Details**

An array of client certificates to be used. Each certificate object must have either both `certPath` and `keyPath`, a single `pfxPath`, or their corresponding direct value equivalents (`cert` and `key`, or `pfx`). Optionally, `passphrase` property should be provided if the certificate is encrypted. The `origin` property should be provided with an exact match to the request origin that the certificate is valid for.

:::note
When using WebKit on macOS, accessing `localhost` will not pick up client certificates. You can make it work by replacing `localhost` with `local.playwright`.
:::

## context-option-useragent
- `userAgent` <[string]>

Specific user agent to use in this context.

## context-option-devicescalefactor
- `deviceScaleFactor` <[float]>

Specify device scale factor (can be thought of as dpr). Defaults to `1`. Learn more about [emulating devices with device scale factor](../emulation.md#devices).

## context-option-ismobile
- `isMobile` <[boolean]>

Whether the `meta viewport` tag is taken into account and touch events are enabled. isMobile is a part of device, so you don't actually need to set it manually. Defaults to `false` and is not supported in Firefox. Learn more about [mobile emulation](../emulation.md#ismobile).

## context-option-hastouch
- `hasTouch` <[boolean]>

Specifies if viewport supports touch events. Defaults to false. Learn more about [mobile emulation](../emulation.md#devices).

## context-option-javascriptenabled
- `javaScriptEnabled` <[boolean]>

Whether or not to enable JavaScript in the context. Defaults to `true`. Learn more about [disabling JavaScript](../emulation.md#javascript-enabled).

## context-option-timezoneid
- `timezoneId` <[string]>

Changes the timezone of the context. See [ICU's metaZones.txt](https://cs.chromium.org/chromium/src/third_party/icu/source/data/misc/metaZones.txt?rcl=faee8bc70570192d82d2978a71e2a615788597d1)
for a list of supported timezone IDs. Defaults to the system timezone.

## context-option-geolocation
- `geolocation` <[Object]>
  - `latitude` <[float]> Latitude between -90 and 90.
  - `longitude` <[float]> Longitude between -180 and 180.
  - `accuracy` ?<[float]> Non-negative accuracy value. Defaults to `0`.

## context-option-locale
- `locale` <[string]>

Specify user locale, for example `en-GB`, `de-DE`, etc. Locale will affect `navigator.language` value, `Accept-Language` request header value as well as number and date formatting rules. Defaults to the system default locale. Learn more about emulation in our [emulation guide](../emulation.md#locale--timezone).

## context-option-permissions
- `permissions` <[Array]<[string]>>

A list of permissions to grant to all pages in this context. See
[`method: BrowserContext.grantPermissions`] for more details. Defaults to none.

## context-option-extrahttpheaders
- `extraHTTPHeaders` <[Object]<[string], [string]>>

An object containing additional HTTP headers to be sent with every request. Defaults to none.

## context-option-offline
- `offline` <[boolean]>

Whether to emulate network being offline. Defaults to `false`. Learn more about [network emulation](../emulation.md#offline).

## context-option-httpcredentials
- `httpCredentials` <[Object]>
  - `username` <[string]>
  - `password` <[string]>
  - `origin` ?<[string]> Restrain sending http credentials on specific origin (scheme://host:port).
  - `send` ?<[HttpCredentialsSend]<"unauthorized"|"always">> This option only applies to the requests sent from corresponding [APIRequestContext] and does not affect requests sent from the browser. `'always'` - `Authorization` header with basic authentication credentials will be sent with the each API request. `'unauthorized` - the credentials are only sent when 401 (Unauthorized) response with `WWW-Authenticate` header is received. Defaults to `'unauthorized'`.

Credentials for [HTTP authentication](https://developer.mozilla.org/en-US/docs/Web/HTTP/Authentication).
If no origin is specified, the username and password are sent to any servers upon unauthorized responses.

## context-option-colorscheme
* langs: js, java
- `colorScheme` <null|[ColorScheme]<"light"|"dark"|"no-preference">>

Emulates [prefers-colors-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) media feature, supported values are `'light'` and `'dark'`. See
[`method: Page.emulateMedia`] for more details. Passing `null` resets emulation to system defaults. Defaults to `'light'`.

## context-option-colorscheme-csharp-python
* langs: csharp, python
- `colorScheme` <[ColorScheme]<"light"|"dark"|"no-preference"|"null">>

Emulates [prefers-colors-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-color-scheme) media feature, supported values are `'light'` and `'dark'`. See
[`method: Page.emulateMedia`] for more details. Passing `'null'` resets emulation to system defaults. Defaults to `'light'`.

## context-option-reducedMotion
* langs: js, java
- `reducedMotion` <null|[ReducedMotion]<"reduce"|"no-preference">>

Emulates `'prefers-reduced-motion'` media feature, supported values are `'reduce'`, `'no-preference'`. See [`method: Page.emulateMedia`] for more details. Passing `null` resets emulation to system defaults. Defaults to `'no-preference'`.

## context-option-reducedMotion-csharp-python
* langs: csharp, python
- `reducedMotion` <[ReducedMotion]<"reduce"|"no-preference"|"null">>

Emulates `'prefers-reduced-motion'` media feature, supported values are `'reduce'`, `'no-preference'`. See [`method: Page.emulateMedia`] for more details. Passing `'null'` resets emulation to system defaults. Defaults to `'no-preference'`.

## context-option-forcedColors
* langs: js, java
- `forcedColors` <null|[ForcedColors]<"active"|"none">>

Emulates `'forced-colors'` media feature, supported values are `'active'`, `'none'`. See [`method: Page.emulateMedia`] for more details. Passing `null` resets emulation to system defaults. Defaults to `'none'`.

## context-option-forcedColors-csharp-python
* langs: csharp, python
- `forcedColors` <[ForcedColors]<"active"|"none"|"null">>

Emulates `'forced-colors'` media feature, supported values are `'active'`, `'none'`. See [`method: Page.emulateMedia`] for more details. Passing `'null'` resets emulation to system defaults. Defaults to `'none'`.

## context-option-contrast
* langs: js, java
- `contrast` <null|[Contrast]<"no-preference"|"more">>

Emulates `'prefers-contrast'` media feature, supported values are `'no-preference'`, `'more'`. See [`method: Page.emulateMedia`] for more details. Passing `null` resets emulation to system defaults. Defaults to `'no-preference'`.

## context-option-contrast-csharp-python
* langs: csharp, python
- `contrast` <[Contrast]<"no-preference"|"more"|"null">>

Emulates `'prefers-contrast'` media feature, supported values are `'no-preference'`, `'more'`. See [`method: Page.emulateMedia`] for more details. Passing `'null'` resets emulation to system defaults. Defaults to `'no-preference'`.

## context-option-logger
* langs: js
* deprecated: The logs received by the logger are incomplete. Please use tracing instead.
- `logger` <[Logger]>

Logger sink for Playwright logging.

## context-option-videospath
* langs: js
* deprecated: Use [`option: recordVideo`] instead.
- `videosPath` <[path]>

## context-option-videosize
* langs: js
* deprecated: Use [`option: recordVideo`] instead.
- `videoSize` <[Object]>
  - `width` <[int]> Video frame width.
  - `height` <[int]> Video frame height.

## context-option-recordhar
* langs: js
- `recordHar` <[Object]>
  - `omitContent` ?<[boolean]> Optional setting to control whether to omit request content from the HAR. Defaults to
    `false`. Deprecated, use `content` policy instead.
  - `content` ?<[HarContentPolicy]<"omit"|"embed"|"attach">> Optional setting to control resource content management. If `omit` is specified, content is not persisted. If `attach` is specified, resources are persisted as separate files or entries in the ZIP archive. If `embed` is specified, content is stored inline the HAR file as per HAR specification. Defaults to `attach` for `.zip` output files and to `embed` for all other file extensions.
  - `path` <[path]> Path on the filesystem to write the HAR file to. If the file name ends with `.zip`, `content: 'attach'` is used by default.
  - `mode` ?<[HarMode]<"full"|"minimal">> When set to `minimal`, only record information necessary for routing from HAR. This omits sizes, timing, page, cookies, security and other types of HAR information that are not used when replaying from HAR. Defaults to `full`.
  - `urlFilter` ?<[string]|[RegExp]> A glob or regex pattern to filter requests that are stored in the HAR. When a [`option: Browser.newContext.baseURL`] via the context options was provided and the passed URL is a path, it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor. Defaults to none.

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
- `recordHarOmitContent` ?<[boolean]>

Optional setting to control whether to omit request content from the HAR. Defaults to `false`.

## context-option-recordhar-content
* langs: csharp, java, python
  - alias-python: record_har_content
- `recordHarContent` ?<[HarContentPolicy]<"omit"|"embed"|"attach">>

Optional setting to control resource content management. If `omit` is specified, content is not persisted. If `attach` is specified, resources are persisted as separate files and all of these files are archived along with the HAR file. Defaults to `embed`, which stores content inline the HAR file as per HAR specification.

## context-option-recordhar-mode
* langs: csharp, java, python
  - alias-python: record_har_mode
- `recordHarMode` ?<[HarMode]<"full"|"minimal">>

When set to `minimal`, only record information necessary for routing from HAR. This omits sizes, timing, page, cookies, security and other types of HAR information that are not used when replaying from HAR. Defaults to `full`.

## context-option-recordhar-url-filter
* langs: csharp, java, python
  - alias-python: record_har_url_filter
- `recordHarUrlFilter` ?<[string]|[RegExp]>

## context-option-recordvideo
* langs: js
- `recordVideo` <[Object]>
  - `dir` <[path]> Path to the directory to put videos into.
  - `size` ?<[Object]> Optional dimensions of the recorded videos. If not specified the size will be equal to `viewport`
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
  - `width` <[int]> Video frame width.
  - `height` <[int]> Video frame height.

Dimensions of the recorded videos. If not specified the size will be equal to `viewport`
scaled down to fit into 800x800. If `viewport` is not configured explicitly the video size defaults to 800x450.
Actual picture of each page will be scaled down if necessary to fit the specified size.

## context-option-proxy
- `proxy` <[Object]>
  - `server` <[string]> Proxy to be used for all requests. HTTP and SOCKS proxies are supported, for example
    `http://myproxy.com:3128` or `socks5://myproxy.com:3128`. Short form `myproxy.com:3128` is considered an HTTP proxy.
  - `bypass` ?<[string]> Optional comma-separated domains to bypass proxy, for example `".com, chromium.org, .domain.com"`.
  - `username` ?<[string]> Optional username to use if HTTP proxy requires authentication.
  - `password` ?<[string]> Optional password to use if HTTP proxy requires authentication.

Network proxy settings to use with this context. Defaults to none.

## context-option-strict
- `strictSelectors` <[boolean]>

If set to true, enables strict selectors mode for this context. In the strict selectors mode all operations
on selectors that imply single target DOM element will throw when more than one element matches the selector.
This option does not affect any Locator APIs (Locators are always strict). Defaults to `false`.
See [Locator] to learn more about the strict mode.

## context-option-service-worker-policy
- `serviceWorkers` <[ServiceWorkerPolicy]<"allow"|"block">>

Whether to allow sites to register Service workers. Defaults to `'allow'`.
* `'allow'`: [Service Workers](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API) can be registered.
* `'block'`: Playwright will block all registration of Service Workers.

## remove-all-listeners-options-behavior
* langs: js
* since: v1.47
- `behavior` <[RemoveAllListenersBehavior]<"wait"|"ignoreErrors"|"default">>

Specifies whether to wait for already running listeners and what to do if they throw errors:
* `'default'` - do not wait for current listener calls (if any) to finish, if the listener throws, it may result in unhandled error
* `'wait'` - wait for current listener calls (if any) to finish
* `'ignoreErrors'` - do not wait for current listener calls (if any) to finish, all errors thrown by the listeners after removal are silently caught

## unroute-all-options-behavior
* langs: js, csharp, python
* since: v1.41
- `behavior` <[UnrouteBehavior]<"wait"|"ignoreErrors"|"default">>

Specifies whether to wait for already running handlers and what to do if they throw errors:
* `'default'` - do not wait for current handler calls (if any) to finish, if unrouted handler throws, it may result in unhandled error
* `'wait'` - wait for current handler calls (if any) to finish
* `'ignoreErrors'` - do not wait for current handler calls (if any) to finish, all errors thrown by the handlers after unrouting are silently caught


## select-options-values
* langs: java, js, csharp
- `values` <[null]|[string]|[ElementHandle]|[Array]<[string]>|[Object]|[Array]<[ElementHandle]>|[Array]<[Object]>>
  - `value` ?<[string]> Matches by `option.value`. Optional.
  - `label` ?<[string]> Matches by `option.label`. Optional.
  - `index` ?<[int]> Matches by the index. Optional.

Options to select. If the `<select>` has the `multiple` attribute, all matching options are selected, otherwise only the
first option matching one of the passed options is selected. String values are matching both values and labels. Option
is considered matching if all specified properties match.

## wait-for-navigation-url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while waiting for the navigation. Note that if
the parameter is a string without wildcard characters, the method will wait for navigation to URL that is exactly
equal to the string.

## wait-for-event-event
* langs: js, python, java
- `event` <[string]>

Event name, same one typically passed into `*.on(event)`.

## wait-for-load-state-state
- `state` ?<[LoadState]<"load"|"domcontentloaded"|"networkidle">>

Optional load state to wait for, defaults to `load`. If the state has been already reached while loading current document, the
method resolves immediately. Can be one of:
  * `'load'` - wait for the `load` event to be fired.
  * `'domcontentloaded'` - wait for the `DOMContentLoaded` event to be fired.
  * `'networkidle'` - **DISCOURAGED** wait until there are no network connections for at least `500` ms. Don't use this method for testing, rely on web assertions to assess readiness instead.

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
- `element` ?<[ElementHandle]|[Array]<[ElementHandle]>>

Option elements to select. Optional.

## python-select-options-index
* langs: python
- `index` ?<[int]|[Array]<[int]>>

Options to select by index. Optional.

## python-select-options-value
* langs: python
- `value` ?<[string]|[Array]<[string]>>

Options to select by value. If the `<select>` has the `multiple` attribute, all given options are selected, otherwise
only the first option matching one of the passed options is selected. Optional.

## python-select-options-label
* langs: python
- `label` ?<[string]|[Array]<[string]>>

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

## js-assertions-timeout
* langs: js
- `timeout` <[float]>

Time to retry the assertion for in milliseconds. Defaults to `timeout` in `TestConfig.expect`.

## csharp-java-python-assertions-timeout
* langs: java, python, csharp
- `timeout` <[float]>

Time to retry the assertion for in milliseconds. Defaults to `5000`.

## assertions-ignore-case
- `ignoreCase` <[boolean]>

Whether to perform case-insensitive match. [`option: ignoreCase`] option takes precedence over the corresponding regular expression flag if specified.

## assertions-max-diff-pixels
* langs: js
- `maxDiffPixels` <[int]>

An acceptable amount of pixels that could be different. Default is configurable with `TestConfig.expect`. Unset by default.

## assertions-max-diff-pixel-ratio
* langs: js
- `maxDiffPixelRatio` <[float]>

An acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1`. Default is configurable with `TestConfig.expect`. Unset by default.

## assertions-threshold
* langs: js
- `threshold` <[float]>

An acceptable perceived color difference in the [YIQ color space](https://en.wikipedia.org/wiki/YIQ)
between the same pixel in compared images, between zero (strict) and one (lax), default is configurable with
`TestConfig.expect`. Defaults to `0.2`.

## shared-context-params-list-v1.8
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
- %%-context-option-colorscheme-csharp-python-%%
- %%-context-option-reducedMotion-%%
- %%-context-option-reducedMotion-csharp-python-%%
- %%-context-option-forcedColors-%%
- %%-context-option-forcedColors-csharp-python-%%
- %%-context-option-contrast-%%
- %%-context-option-contrast-csharp-python-%%
- %%-context-option-logger-%%
- %%-context-option-videospath-%%
- %%-context-option-videosize-%%
- %%-context-option-recordhar-%%
- %%-context-option-recordhar-path-%%
- %%-context-option-recordhar-omit-content-%%
- %%-context-option-recordhar-content-%%
- %%-context-option-recordhar-mode-%%
- %%-context-option-recordhar-url-filter-%%
- %%-context-option-recordvideo-%%
- %%-context-option-recordvideo-dir-%%
- %%-context-option-recordvideo-size-%%
- %%-context-option-strict-%%
- %%-context-option-service-worker-policy-%%

## browser-option-args
- `args` <[Array]<[string]>>

:::warning
Use custom browser args at your own risk, as some of them may break Playwright functionality.
:::

Additional arguments to pass to the browser instance. The list of Chromium flags can be found
[here](https://peter.sh/experiments/chromium-command-line-switches/).

## browser-option-channel
- `channel` <[string]>

Browser distribution channel.

Use "chromium" to [opt in to new headless mode](../browsers.md#chromium-new-headless-mode).

Use "chrome", "chrome-beta", "chrome-dev", "chrome-canary", "msedge", "msedge-beta", "msedge-dev", or "msedge-canary" to use branded [Google Chrome and Microsoft Edge](../browsers.md#google-chrome--microsoft-edge).

## browser-option-chromiumsandbox
- `chromiumSandbox` <[boolean]>

Enable Chromium sandboxing. Defaults to `false`.


## browser-option-downloadspath
- `downloadsPath` <[path]>

If specified, accepted downloads are downloaded into this directory. Otherwise, temporary directory is created and is
deleted when browser is closed. In either case, the downloads are deleted when the browser context they were created in
is closed.

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
[Firefox](https://hacks.mozilla.org/2017/12/using-headless-mode-in-firefox/). Defaults to `true` unless the
[`option: BrowserType.launch.devtools`] option is `true`.

## js-python-browser-option-firefoxuserprefs
* langs: js, python
- `firefoxUserPrefs` <[Object]<[string], [string]|[float]|[boolean]>>

Firefox user preferences. Learn more about the Firefox user preferences at
[`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).

You can also provide a path to a custom [`policies.json` file](https://mozilla.github.io/policy-templates/) via `PLAYWRIGHT_FIREFOX_POLICIES_JSON` environment variable.

## csharp-java-browser-option-firefoxuserprefs
* langs: csharp, java
- `firefoxUserPrefs` <[Object]<[string], [any]>>

Firefox user preferences. Learn more about the Firefox user preferences at
[`about:config`](https://support.mozilla.org/en-US/kb/about-config-editor-firefox).

You can also provide a path to a custom [`policies.json` file](https://mozilla.github.io/policy-templates/) via `PLAYWRIGHT_FIREFOX_POLICIES_JSON` environment variable.

## browser-option-logger
* langs: js
* deprecated: The logs received by the logger are incomplete. Please use tracing instead.
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
* deprecated: Use [debugging tools](../debug.md) instead.
- `devtools` <[boolean]>

**Chromium-only** Whether to auto-open a Developer Tools panel for each tab. If this option is `true`, the
[`option: headless`] option will be set `false`.

## browser-option-slowmo
- `slowMo` <[float]>

Slows down Playwright operations by the specified amount of milliseconds. Useful so that you can see what is going on.

## shared-browser-options-list-v1.8
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

## locator-option-has-text
- `hasText` <[string]|[RegExp]>

Matches elements containing specified text somewhere inside, possibly in a child or a descendant element. When passed a [string], matching is case-insensitive and searches for a substring.
For example, `"Playwright"` matches `<article><div>Playwright</div></article>`.

## locator-option-has
- `has` <[Locator]>

Narrows down the results of the method to those which contain elements matching this relative locator.
For example, `article` that has `text=Playwright` matches `<article><div>Playwright</div></article>`.

Inner locator **must be relative** to the outer locator and is queried starting with the outer locator match, not the document root. For example, you can find `content` that has `div` in `<article><content><div>Playwright</div></content></article>`. However, looking for `content` that has `article div` will fail, because the inner locator must be relative and should not use any elements outside the `content`.

Note that outer and inner locators must belong to the same frame. Inner locator must not contain [FrameLocator]s.

## locator-option-has-not
- `hasNot` <[Locator]>

Matches elements that do not contain an element that matches an inner locator. Inner locator is queried against the outer one.
For example, `article` that does not have `div` matches `<article><span>Playwright</span></article>`.

Note that outer and inner locators must belong to the same frame. Inner locator must not contain [FrameLocator]s.

## locator-option-has-not-text
- `hasNotText` <[string]|[RegExp]>

Matches elements that do not contain specified text somewhere inside, possibly in a child or a descendant element. When passed a [string], matching is case-insensitive and searches for a substring.

## locator-option-visible
- `visible` <[boolean]>

Only matches visible or invisible elements.

## locator-options-list-v1.14
- %%-locator-option-has-text-%%
- %%-locator-option-has-%%

## screenshot-option-animations
- `animations` <[ScreenshotAnimations]<"disabled"|"allow">>

When set to `"disabled"`, stops CSS animations, CSS transitions and Web Animations. Animations get different treatment depending on their duration:
* finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
* infinite animations are canceled to initial state, and then played over after the screenshot.

Defaults to `"allow"` that leaves animations untouched.

## screenshot-option-animations-default-disabled
- `animations` <[ScreenshotAnimations]<"disabled"|"allow">>

When set to `"disabled"`, stops CSS animations, CSS transitions and Web Animations. Animations get different treatment depending on their duration:
* finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
* infinite animations are canceled to initial state, and then played over after the screenshot.

Defaults to `"disabled"` that disables animations.

## screenshot-option-omit-background
- `omitBackground` <[boolean]>

Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images.
Defaults to `false`.

## screenshot-option-quality
- `quality` <[int]>

The quality of the image, between 0-100. Not applicable to `png` images.

## screenshot-option-path
- `path` <[path]>

The file path to save the image to. The screenshot type will be inferred from file extension. If [`option: path`] is a
relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be
saved to the disk.

## screenshot-option-type
- `type` <[ScreenshotType]<"png"|"jpeg">>

Specify screenshot type, defaults to `png`.

## screenshot-option-mask
- `mask` <[Array]<[Locator]>>

Specify locators that should be masked when the screenshot is taken. Masked elements will be overlaid with
a pink box `#FF00FF` (customized by [`option: maskColor`]) that completely covers its bounding box.
The mask is also applied to invisible elements, see [Matching only visible elements](../locators.md#matching-only-visible-elements) to disable that.

## screenshot-option-mask-color
* since: v1.35
- `maskColor` <[string]>

Specify the color of the overlay box for masked elements, in [CSS color format](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value). Default color is pink `#FF00FF`.

## screenshot-option-full-page
- `fullPage` <[boolean]>

When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to
`false`.

## screenshot-option-clip
- `clip` <[Object]>
  - `x` <[float]> x-coordinate of top-left corner of clip area
  - `y` <[float]> y-coordinate of top-left corner of clip area
  - `width` <[float]> width of clipping area
  - `height` <[float]> height of clipping area

An object which specifies clipping of the resulting image.

## screenshot-option-scale
- `scale` <[ScreenshotScale]<"css"|"device">>

When set to `"css"`, screenshot will have a single pixel per each css pixel on the page. For high-dpi devices, this will keep screenshots small. Using `"device"` option will produce a single pixel per each device pixel, so screenshots of high-dpi devices will be twice as large or even larger.

Defaults to `"device"`.

## screenshot-option-scale-default-css
- `scale` <[ScreenshotScale]<"css"|"device">>

When set to `"css"`, screenshot will have a single pixel per each css pixel on the page. For high-dpi devices, this will keep screenshots small. Using `"device"` option will produce a single pixel per each device pixel, so screenshots of high-dpi devices will be twice as large or even larger.

Defaults to `"css"`.

## screenshot-option-caret
- `caret` <[ScreenshotCaret]<"hide"|"initial">>

When set to `"hide"`, screenshot will hide text caret. When set to `"initial"`, text caret behavior will not be changed.  Defaults to `"hide"`.

## screenshot-option-style
- `style` <string>

Text of the stylesheet to apply while making the screenshot. This is where you can hide dynamic elements, make elements invisible
or change their properties to help you creating repeatable screenshots. This stylesheet pierces the Shadow DOM and applies
to the inner frames.

## screenshot-option-style-path
- `stylePath` <[string]|[Array]<[string]>>

File name containing the stylesheet to apply while making the screenshot. This is where you can hide dynamic elements, make elements invisible or change their properties to help you creating repeatable screenshots. This stylesheet pierces the Shadow DOM and applies to the inner frames.

## screenshot-options-common-list-v1.8
- %%-screenshot-option-animations-%%
- %%-screenshot-option-omit-background-%%
- %%-screenshot-option-quality-%%
- %%-screenshot-option-path-%%
- %%-screenshot-option-scale-%%
- %%-screenshot-option-caret-%%
- %%-screenshot-option-type-%%
- %%-screenshot-option-mask-%%

## locator-get-by-test-id-test-id
* since: v1.27
- `testId` <[string]|[RegExp]>

Id to locate the element by.

## locator-get-by-text-text
* since: v1.27
- `text` <[string]|[RegExp]>

Text to locate the element for.

## locator-get-by-text-exact
* since: v1.27
- `exact` <[boolean]>

Whether to find an exact match: case-sensitive and whole-string. Default to false. Ignored when locating by a regular expression. Note that exact match still trims whitespace.

## get-by-role-to-have-role-role
- `role` <[AriaRole]<"alert"|"alertdialog"|"application"|"article"|"banner"|"blockquote"|"button"|"caption"|"cell"|"checkbox"|"code"|"columnheader"|"combobox"|"complementary"|"contentinfo"|"definition"|"deletion"|"dialog"|"directory"|"document"|"emphasis"|"feed"|"figure"|"form"|"generic"|"grid"|"gridcell"|"group"|"heading"|"img"|"insertion"|"link"|"list"|"listbox"|"listitem"|"log"|"main"|"marquee"|"math"|"meter"|"menu"|"menubar"|"menuitem"|"menuitemcheckbox"|"menuitemradio"|"navigation"|"none"|"note"|"option"|"paragraph"|"presentation"|"progressbar"|"radio"|"radiogroup"|"region"|"row"|"rowgroup"|"rowheader"|"scrollbar"|"search"|"searchbox"|"separator"|"slider"|"spinbutton"|"status"|"strong"|"subscript"|"superscript"|"switch"|"tab"|"table"|"tablist"|"tabpanel"|"term"|"textbox"|"time"|"timer"|"toolbar"|"tooltip"|"tree"|"treegrid"|"treeitem">>

Required aria role.

## locator-get-by-role-option-checked
* since: v1.27
- `checked` <[boolean]>

An attribute that is usually set by `aria-checked` or native `<input type=checkbox>` controls.

Learn more about [`aria-checked`](https://www.w3.org/TR/wai-aria-1.2/#aria-checked).

## locator-get-by-role-option-disabled
* since: v1.27
- `disabled` <[boolean]>

An attribute that is usually set by `aria-disabled` or `disabled`.

:::note
Unlike most other attributes, `disabled` is inherited through the DOM hierarchy.
Learn more about [`aria-disabled`](https://www.w3.org/TR/wai-aria-1.2/#aria-disabled).
:::

## locator-get-by-role-option-expanded
* since: v1.27
- `expanded` <[boolean]>

An attribute that is usually set by `aria-expanded`.

Learn more about [`aria-expanded`](https://www.w3.org/TR/wai-aria-1.2/#aria-expanded).

## locator-get-by-role-option-includeHidden
* since: v1.27
- `includeHidden` <[boolean]>

Option that controls whether hidden elements are matched. By default, only non-hidden elements, as [defined by ARIA](https://www.w3.org/TR/wai-aria-1.2/#tree_exclusion), are matched by role selector.

Learn more about [`aria-hidden`](https://www.w3.org/TR/wai-aria-1.2/#aria-hidden).

## locator-get-by-role-option-level
* since: v1.27
- `level` <[int]>

A number attribute that is usually present for roles `heading`, `listitem`, `row`, `treeitem`, with default values for `<h1>-<h6>` elements.

Learn more about [`aria-level`](https://www.w3.org/TR/wai-aria-1.2/#aria-level).

## locator-get-by-role-option-name
* since: v1.27
- `name` <[string]|[RegExp]>

Option to match the [accessible name](https://w3c.github.io/accname/#dfn-accessible-name). By default, matching is case-insensitive and searches for a substring, use [`option: exact`] to control this behavior.

Learn more about [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

## locator-get-by-role-option-exact
* since: v1.28
- `exact` <[boolean]>

Whether [`option: name`] is matched exactly: case-sensitive and whole-string. Defaults to false. Ignored when [`option: name`] is a regular expression. Note that exact match still trims whitespace.

## locator-get-by-role-option-pressed
* since: v1.27
- `pressed` <[boolean]>

An attribute that is usually set by `aria-pressed`.

Learn more about [`aria-pressed`](https://www.w3.org/TR/wai-aria-1.2/#aria-pressed).

## locator-get-by-role-option-selected
* since: v1.27
- `selected` <boolean>

An attribute that is usually set by `aria-selected`.

Learn more about [`aria-selected`](https://www.w3.org/TR/wai-aria-1.2/#aria-selected).

## locator-get-by-role-option-list-v1.27
- %%-locator-get-by-role-option-checked-%%
- %%-locator-get-by-role-option-disabled-%%
- %%-locator-get-by-role-option-expanded-%%
- %%-locator-get-by-role-option-includeHidden-%%
- %%-locator-get-by-role-option-level-%%
- %%-locator-get-by-role-option-name-%%
- %%-locator-get-by-role-option-pressed-%%
- %%-locator-get-by-role-option-selected-%%

## template-locator-locator

The method finds an element matching the specified selector in the locator's subtree. It also accepts filter options, similar to [`method: Locator.filter`] method.

[Learn more about locators](../locators.md).

## template-locator-root-locator

The method returns an element locator that can be used to perform actions on this page / frame.
Locator is resolved to the element immediately before performing an action, so a series of actions on the same locator can in fact be performed on different DOM elements. That would happen if the DOM structure between those actions has changed.

[Learn more about locators](../locators.md).

## template-locator-get-by-test-id

Locate element by the test id.

**Usage**

Consider the following DOM structure.

```html
<button data-testid="directions">Itinéraire</button>
```

You can locate the element by it's test id:

```js
await page.getByTestId('directions').click();
```

```java
page.getByTestId("directions").click();
```

```python async
await page.get_by_test_id("directions").click()
```

```python sync
page.get_by_test_id("directions").click()
```

```csharp
await page.GetByTestId("directions").ClickAsync();
```

**Details**

By default, the `data-testid` attribute is used as a test id. Use [`method: Selectors.setTestIdAttribute`] to configure a different test id attribute if necessary.

```js
// Set custom test id attribute from @playwright/test config:
import { defineConfig } from '@playwright/test';

export default defineConfig({
  use: {
    testIdAttribute: 'data-pw'
  },
});
```

## template-locator-get-by-text

Allows locating elements that contain given text.

See also [`method: Locator.filter`] that allows to match by another criteria, like an accessible role, and then filter by the text content.


**Usage**

Consider the following DOM structure:

```html
<div>Hello <span>world</span></div>
<div>Hello</div>
```

You can locate by text substring, exact string, or a regular expression:

```js
// Matches <span>
page.getByText('world');

// Matches first <div>
page.getByText('Hello world');

// Matches second <div>
page.getByText('Hello', { exact: true });

// Matches both <div>s
page.getByText(/Hello/);

// Matches second <div>
page.getByText(/^hello$/i);
```

```python async
# Matches <span>
page.get_by_text("world")

# Matches first <div>
page.get_by_text("Hello world")

# Matches second <div>
page.get_by_text("Hello", exact=True)

# Matches both <div>s
page.get_by_text(re.compile("Hello"))

# Matches second <div>
page.get_by_text(re.compile("^hello$", re.IGNORECASE))
```

```python sync
# Matches <span>
page.get_by_text("world")

# Matches first <div>
page.get_by_text("Hello world")

# Matches second <div>
page.get_by_text("Hello", exact=True)

# Matches both <div>s
page.get_by_text(re.compile("Hello"))

# Matches second <div>
page.get_by_text(re.compile("^hello$", re.IGNORECASE))
```

```java
// Matches <span>
page.getByText("world");

// Matches first <div>
page.getByText("Hello world");

// Matches second <div>
page.getByText("Hello", new Page.GetByTextOptions().setExact(true));

// Matches both <div>s
page.getByText(Pattern.compile("Hello"));

// Matches second <div>
page.getByText(Pattern.compile("^hello$", Pattern.CASE_INSENSITIVE));
```

```csharp
// Matches <span>
page.GetByText("world");

// Matches first <div>
page.GetByText("Hello world");

// Matches second <div>
page.GetByText("Hello", new() { Exact = true });

// Matches both <div>s
page.GetByText(new Regex("Hello"));

// Matches second <div>
page.GetByText(new Regex("^hello$", RegexOptions.IgnoreCase));
```

**Details**

Matching by text always normalizes whitespace, even with exact match. For example, it turns multiple spaces into one, turns line breaks into spaces and ignores leading and trailing whitespace.

Input elements of the type `button` and `submit` are matched by their `value` instead of the text content. For example, locating by text `"Log in"` matches `<input type=button value="Log in">`.

## template-locator-get-by-alt-text

Allows locating elements by their alt text.

**Usage**

For example, this method will find the image by alt text "Playwright logo":

```html
<img alt='Playwright logo'>
```

```js
await page.getByAltText('Playwright logo').click();
```

```java
page.getByAltText("Playwright logo").click();
```

```python async
await page.get_by_alt_text("Playwright logo").click()
```

```python sync
page.get_by_alt_text("Playwright logo").click()
```

```csharp
await page.GetByAltText("Playwright logo").ClickAsync();
```

## template-locator-get-by-label-text

Allows locating input elements by the text of the associated `<label>` or `aria-labelledby` element, or by the `aria-label` attribute.

**Usage**

For example, this method will find inputs by label "Username" and "Password" in the following DOM:

```html
<input aria-label="Username">
<label for="password-input">Password:</label>
<input id="password-input">
```

```js
await page.getByLabel('Username').fill('john');
await page.getByLabel('Password').fill('secret');
```

```java
page.getByLabel("Username").fill("john");
page.getByLabel("Password").fill("secret");
```

```python async
await page.get_by_label("Username").fill("john")
await page.get_by_label("Password").fill("secret")
```

```python sync
page.get_by_label("Username").fill("john")
page.get_by_label("Password").fill("secret")
```

```csharp
await page.GetByLabel("Username").FillAsync("john");
await page.GetByLabel("Password").FillAsync("secret");
```

## template-locator-get-by-placeholder-text

Allows locating input elements by the placeholder text.

**Usage**

For example, consider the following DOM structure.

```html
<input type="email" placeholder="name@example.com" />
```

You can fill the input after locating it by the placeholder text:

```js
await page
    .getByPlaceholder('name@example.com')
    .fill('playwright@microsoft.com');
```

```java
page.getByPlaceholder("name@example.com").fill("playwright@microsoft.com");
```

```python async
await page.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

```python sync
page.get_by_placeholder("name@example.com").fill("playwright@microsoft.com")
```

```csharp
await page
    .GetByPlaceholder("name@example.com")
    .FillAsync("playwright@microsoft.com");
```

## template-locator-get-by-role

Allows locating elements by their [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles), [ARIA attributes](https://www.w3.org/TR/wai-aria-1.2/#aria-attributes) and [accessible name](https://w3c.github.io/accname/#dfn-accessible-name).

**Usage**

Consider the following DOM structure.

```html
<h3>Sign up</h3>
<label>
  <input type="checkbox" /> Subscribe
</label>
<br/>
<button>Submit</button>
```

You can locate each element by it's implicit role:

```js
await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();

await page.getByRole('checkbox', { name: 'Subscribe' }).check();

await page.getByRole('button', { name: /submit/i }).click();
```

```python async
await expect(page.get_by_role("heading", name="Sign up")).to_be_visible()

await page.get_by_role("checkbox", name="Subscribe").check()

await page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

```python sync
expect(page.get_by_role("heading", name="Sign up")).to_be_visible()

page.get_by_role("checkbox", name="Subscribe").check()

page.get_by_role("button", name=re.compile("submit", re.IGNORECASE)).click()
```

```java
assertThat(page
    .getByRole(AriaRole.HEADING,
               new Page.GetByRoleOptions().setName("Sign up")))
    .isVisible();

page.getByRole(AriaRole.CHECKBOX,
               new Page.GetByRoleOptions().setName("Subscribe"))
    .check();

page.getByRole(AriaRole.BUTTON,
               new Page.GetByRoleOptions().setName(
                   Pattern.compile("submit", Pattern.CASE_INSENSITIVE)))
    .click();
```

```csharp
await Expect(Page
    .GetByRole(AriaRole.Heading, new() { Name = "Sign up" }))
    .ToBeVisibleAsync();

await page
    .GetByRole(AriaRole.Checkbox, new() { Name = "Subscribe" })
    .CheckAsync();

await page
    .GetByRole(AriaRole.Button, new() {
        NameRegex = new Regex("submit", RegexOptions.IgnoreCase)
    })
    .ClickAsync();
```

**Details**

Role selector **does not replace** accessibility audits and conformance tests, but rather gives early feedback about the ARIA guidelines.

Many html elements have an implicitly [defined role](https://w3c.github.io/html-aam/#html-element-role-mappings) that is recognized by the role selector. You can find all the [supported roles here](https://www.w3.org/TR/wai-aria-1.2/#role_definitions). ARIA guidelines **do not recommend** duplicating implicit roles and attributes by setting `role` and/or `aria-*` attributes to default values.

## template-locator-get-by-title

Allows locating elements by their title attribute.

**Usage**

Consider the following DOM structure.

```html
<span title='Issues count'>25 issues</span>
```

You can check the issues count after locating it by the title text:

```js
await expect(page.getByTitle('Issues count')).toHaveText('25 issues');
```

```java
assertThat(page.getByTitle("Issues count")).hasText("25 issues");
```

```python async
await expect(page.get_by_title("Issues count")).to_have_text("25 issues")
```

```python sync
expect(page.get_by_title("Issues count")).to_have_text("25 issues")
```

```csharp
await Expect(Page.GetByTitle("Issues count")).toHaveText("25 issues");
```

## test-config-snapshot-path-template
- `type` ?<[string]>
* langs: js

This option configures a template controlling location of snapshots generated by [`method: PageAssertions.toHaveScreenshot#1`], [`method: LocatorAssertions.toMatchAriaSnapshot#2`] and [`method: SnapshotAssertions.toMatchSnapshot#1`].

You can configure templates for each assertion separately in [`property: TestConfig.expect`].

**Usage**

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // Single template for all assertions
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{ext}',

  // Assertion-specific templates
  expect: {
    toHaveScreenshot: {
      pathTemplate: '{testDir}/__screenshots__{/projectName}/{testFilePath}/{arg}{ext}',
    },
    toMatchAriaSnapshot: {
      pathTemplate: '{testDir}/__snapshots__/{testFilePath}/{arg}{ext}',
    },
  },
});
```

**Details**

The value might include some "tokens" that will be replaced with actual values during test execution.

Consider the following file structure:

```txt
playwright.config.ts
tests/
└── page/
    └── page-click.spec.ts
```

And the following `page-click.spec.ts` that uses `toHaveScreenshot()` call:

```js title="page-click.spec.ts"
import { test, expect } from '@playwright/test';

test.describe('suite', () => {
  test('test should work', async ({ page }) => {
    await expect(page).toHaveScreenshot(['foo', 'bar', 'baz.png']);
  });
});
```

The list of supported tokens:

* `{arg}` - Relative snapshot path **without extension**. This comes from the arguments passed to `toHaveScreenshot()`, `toMatchAriaSnapshot()` or `toMatchSnapshot()`; if called without arguments, this will be an auto-generated snapshot name.
  * Value: `foo/bar/baz`
* `{ext}` - Snapshot extension (with the leading dot).
  * Value: `.png`
* `{platform}` - The value of `process.platform`.
* `{projectName}` - Project's file-system-sanitized name, if any.
  * Value: `''` (empty string).
* `{snapshotDir}` - Project's [`property: TestProject.snapshotDir`].
  * Value: `/home/playwright/tests` (since `snapshotDir` is not provided in config, it defaults to `testDir`)
* `{testDir}` - Project's [`property: TestProject.testDir`].
  * Value: `/home/playwright/tests` (absolute path since `testDir` is resolved relative to directory with config)
* `{testFileDir}` - Directories in relative path from `testDir` to **test file**.
  * Value: `page`
* `{testFileName}` - Test file name with extension.
  * Value: `page-click.spec.ts`
* `{testFilePath}` - Relative path from `testDir` to **test file**.
  * Value: `page/page-click.spec.ts`
* `{testName}` - File-system-sanitized test title, including parent describes but excluding file name.
  * Value: `suite-test-should-work`

Each token can be preceded with a single character that will be used **only if** this token has non-empty value.

Consider the following config:

```js title="playwright.config.ts"
import { defineConfig } from '@playwright/test';

export default defineConfig({
  snapshotPathTemplate: '__screenshots__{/projectName}/{testFilePath}/{arg}{ext}',
  testMatch: 'example.spec.ts',
  projects: [
    { use: { browserName: 'firefox' } },
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

In this config:
1. First project **does not** have a name, so its snapshots will be stored in `<configDir>/__screenshots__/example.spec.ts/...`.
1. Second project **does** have a name, so its snapshots will be stored in `<configDir>/__screenshots__/chromium/example.spec.ts/..`.
1. Since `snapshotPathTemplate` resolves to relative path, it will be resolved relative to `configDir`.
1. Forward slashes `"/"` can be used as path separators on any platform.

