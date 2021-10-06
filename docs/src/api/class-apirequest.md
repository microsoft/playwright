# class: ApiRequest
* langs: js

Exposes API that can be used for the Web API testing.

## async method: ApiRequest.newContext
* langs: js
- returns: <[ApiRequestContext]>

**experimental** Creates new instances of [ApiRequestContext].

### option: ApiRequest.newContext.useragent = %%-context-option-useragent-%%
### option: ApiRequest.newContext.extraHTTPHeaders = %%-context-option-extrahttpheaders-%%
### option: ApiRequest.newContext.httpCredentials = %%-context-option-httpcredentials-%%
### option: ApiRequest.newContext.proxy = %%-browser-option-proxy-%%
### option: ApiRequest.newContext.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

### option: ApiRequest.newContext.timeout
- `timeout` <[float]>

Maximum time in milliseconds to wait for the response. Defaults to
`30000` (30 seconds). Pass `0` to disable timeout.


### option: ApiRequest.newContext.baseURL
- `baseURL` <[string]>

When using [`method: ApiRequestContext.get`], [`method: ApiRequestContext.post`], [`method: ApiRequestContext.fetch`] it takes the base URL in consideration by using the [`URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor for building the corresponding URL. Examples:
* baseURL: `http://localhost:3000` and sending rquest to `/bar.html` results in `http://localhost:3000/bar.html`
* baseURL: `http://localhost:3000/foo/` and sending rquest to `./bar.html` results in `http://localhost:3000/foo/bar.html`

### option: ApiRequest.newContext.storageState
- `storageState` <[path]|[Object]>
  - `cookies` <[Array]<[Object]>>
    - `name` <[string]>
    - `value` <[string]>
    - `domain` <[string]>
    - `path` <[string]>
    - `expires` <[float]> Unix time in seconds.
    - `httpOnly` <[boolean]>
    - `secure` <[boolean]>
    - `sameSite` <[SameSiteAttribute]<"Strict"|"Lax"|"None">>
  - `origins` <[Array]<[Object]>>
    - `origin` <[string]>
    - `localStorage` <[Array]<[Object]>>
      - `name` <[string]>
      - `value` <[string]>

Populates context with given storage state. This option can be used to initialize context with logged-in information
obtained via [`method: BrowserContext.storageState`] or [`method: ApiRequestContext.storageState`]. Either a path to the
file with saved storage, or the value returned by one of [`method: BrowserContext.storageState`] or
[`method: ApiRequestContext.storageState`] methods.

