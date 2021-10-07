# class: ApiRequestContext
* langs: js

This API is used for the Web API testing. You can use it to trigger API endpoints, configure micro-services, prepare
environment or the service to your e2e test. When used on [Page] or a [BrowserContext], this API will automatically use
the cookies from the corresponding [BrowserContext]. This means that if you log in using this API, your e2e test
will be logged in and vice versa.

## async method: ApiRequestContext.delete
- returns: <[ApiResponse]>

Sends HTTP(S) [DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.delete.url = %%-fetch-param-url-%%
### option: ApiRequestContext.delete.params = %%-fetch-option-params-%%
### option: ApiRequestContext.delete.headers = %%-fetch-option-headers-%%
### option: ApiRequestContext.delete.timeout = %%-fetch-option-timeout-%%
### option: ApiRequestContext.delete.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: ApiRequestContext.delete.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: ApiRequestContext.dispose

All responses received through [`method: ApiRequestContext.fetch`], [`method: ApiRequestContext.get`], [`method: ApiRequestContext.post`]
and other methods are stored in the memory, so that you can later call [`method: ApiResponse.body`]. This method
discards all stored responses, and makes [`method: ApiResponse.body`] throw "Response disposed" error.

## async method: ApiRequestContext.fetch
- returns: <[ApiResponse]>

Sends HTTP(S) request and returns its response. The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.fetch.urlOrRequest
- `urlOrRequest` <[string]|[Request]>

Target URL or Request to get all parameters from.

### option: ApiRequestContext.fetch.params = %%-fetch-option-params-%%

### option: ApiRequestContext.fetch.method
- `method` <[string]>

If set changes the fetch method (e.g. [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) or
[POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST)). If not specified, GET method is used.

### option: ApiRequestContext.fetch.headers = %%-fetch-option-headers-%%
### option: ApiRequestContext.fetch.data = %%-fetch-option-data-%%
### option: ApiRequestContext.fetch.form = %%-fetch-option-form-%%
### option: ApiRequestContext.fetch.multipart = %%-fetch-option-multipart-%%
### option: ApiRequestContext.fetch.timeout = %%-fetch-option-timeout-%%
### option: ApiRequestContext.fetch.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: ApiRequestContext.fetch.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: ApiRequestContext.get
- returns: <[ApiResponse]>

Sends HTTP(S) [GET](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.get.url = %%-fetch-param-url-%%
### option: ApiRequestContext.get.params = %%-fetch-option-params-%%
### option: ApiRequestContext.get.headers = %%-fetch-option-headers-%%
### option: ApiRequestContext.get.timeout = %%-fetch-option-timeout-%%
### option: ApiRequestContext.get.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: ApiRequestContext.get.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: ApiRequestContext.head
- returns: <[ApiResponse]>

Sends HTTP(S) [HEAD](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.head.url = %%-fetch-param-url-%%
### option: ApiRequestContext.head.params = %%-fetch-option-params-%%
### option: ApiRequestContext.head.headers = %%-fetch-option-headers-%%
### option: ApiRequestContext.head.timeout = %%-fetch-option-timeout-%%
### option: ApiRequestContext.head.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: ApiRequestContext.head.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: ApiRequestContext.patch
- returns: <[ApiResponse]>

Sends HTTP(S) [PATCH](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.patch.url = %%-fetch-param-url-%%
### option: ApiRequestContext.patch.params = %%-fetch-option-params-%%
### option: ApiRequestContext.patch.headers = %%-fetch-option-headers-%%
### option: ApiRequestContext.patch.data = %%-fetch-option-data-%%
### option: ApiRequestContext.patch.form = %%-fetch-option-form-%%
### option: ApiRequestContext.patch.multipart = %%-fetch-option-multipart-%%
### option: ApiRequestContext.patch.timeout = %%-fetch-option-timeout-%%
### option: ApiRequestContext.patch.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: ApiRequestContext.patch.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: ApiRequestContext.post
- returns: <[ApiResponse]>

Sends HTTP(S) [POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.post.url = %%-fetch-param-url-%%
### option: ApiRequestContext.post.params = %%-fetch-option-params-%%
### option: ApiRequestContext.post.headers = %%-fetch-option-headers-%%
### option: ApiRequestContext.post.data = %%-fetch-option-data-%%
### option: ApiRequestContext.post.form = %%-fetch-option-form-%%
### option: ApiRequestContext.post.multipart = %%-fetch-option-multipart-%%
### option: ApiRequestContext.post.timeout = %%-fetch-option-timeout-%%
### option: ApiRequestContext.post.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: ApiRequestContext.post.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: ApiRequestContext.put
- returns: <[ApiResponse]>

Sends HTTP(S) [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.put.url = %%-fetch-param-url-%%
### option: ApiRequestContext.put.params = %%-fetch-option-params-%%
### option: ApiRequestContext.put.headers = %%-fetch-option-headers-%%
### option: ApiRequestContext.put.data = %%-fetch-option-data-%%
### option: ApiRequestContext.put.form = %%-fetch-option-form-%%
### option: ApiRequestContext.put.multipart = %%-fetch-option-multipart-%%
### option: ApiRequestContext.put.timeout = %%-fetch-option-timeout-%%
### option: ApiRequestContext.put.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: ApiRequestContext.put.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: ApiRequestContext.storageState
- returns: <[Object]>
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

Returns storage state for this request context, contains current cookies and local storage snapshot if it was passed to the constructor.

### option: ApiRequestContext.storageState.path = %%-storagestate-option-path-%%
