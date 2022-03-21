# class: APIRequest
* langs: js, java, python

Exposes API that can be used for the Web API testing. This class is used for creating
[APIRequestContext] instance which in turn can be used for sending web requests. An instance
of this class can be obtained via [`property: Playwright.request`]. For more information
see [APIRequestContext].

## async method: APIRequest.newContext
* langs: js, java, python
- returns: <[APIRequestContext]>

Creates new instances of [APIRequestContext].

### option: APIRequest.newContext.useragent = %%-context-option-useragent-%%
### option: APIRequest.newContext.extraHTTPHeaders = %%-context-option-extrahttpheaders-%%
### option: APIRequest.newContext.httpCredentials = %%-context-option-httpcredentials-%%
### option: APIRequest.newContext.proxy = %%-browser-option-proxy-%%
### option: APIRequest.newContext.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

### option: APIRequest.newContext.timeout
- `timeout` <[float]>

Maximum time in milliseconds to wait for the response. Defaults to
`30000` (30 seconds). Pass `0` to disable timeout.


### option: APIRequest.newContext.baseURL
- `baseURL` <[string]>

Methods like [`method: APIRequestContext.get`] take the base URL into consideration by using the [`URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor for building the corresponding URL. Examples:
* baseURL: `http://localhost:3000` and sending request to `/bar.html` results in `http://localhost:3000/bar.html`
* baseURL: `http://localhost:3000/foo/` and sending request to `./bar.html` results in `http://localhost:3000/foo/bar.html`
* baseURL: `http://localhost:3000/foo` (without trailing slash) and navigating to `./bar.html` results in `http://localhost:3000/bar.html`

### option: APIRequest.newContext.storageState
* langs: js, python
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
obtained via [`method: BrowserContext.storageState`] or [`method: APIRequestContext.storageState`]. Either a path to the
file with saved storage, or the value returned by one of [`method: BrowserContext.storageState`] or
[`method: APIRequestContext.storageState`] methods.

### option: APIRequest.newContext.storageState
* langs: java
- `storageState` <[string]>

Populates context with given storage state. This option can be used to initialize context with logged-in information
obtained via [`method: BrowserContext.storageState`] or [`method: APIRequestContext.storageState`]. Either a path to the
file with saved storage, or the value returned by one of [`method: BrowserContext.storageState`] or
[`method: APIRequestContext.storageState`] methods.

### option: APIRequest.newContext.storageStatePath = %%-csharp-java-context-option-storage-state-path-%%
