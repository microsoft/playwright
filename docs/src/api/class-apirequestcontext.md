# class: APIRequestContext
* langs: js, java, python

This API is used for the Web API testing. You can use it to trigger API endpoints, configure micro-services, prepare
environment or the service to your e2e test. When used on [Page] or a [BrowserContext], this API will automatically use
the cookies from the corresponding [BrowserContext]. This means that if you log in using this API, your e2e test
will be logged in and vice versa.

## async method: APIRequestContext.delete
- returns: <[APIResponse]>

Sends HTTP(S) [DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.delete.url = %%-fetch-param-url-%%
### option: APIRequestContext.delete.params = %%-fetch-option-params-%%
### option: APIRequestContext.delete.headers = %%-fetch-option-headers-%%
### option: APIRequestContext.delete.data = %%-fetch-option-data-%%
### option: APIRequestContext.delete.form = %%-fetch-option-form-%%
### option: APIRequestContext.delete.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.delete.multipart = %%-java-fetch-option-multipart-%%
### option: APIRequestContext.delete.timeout = %%-fetch-option-timeout-%%
### option: APIRequestContext.delete.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: APIRequestContext.delete.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: APIRequestContext.dispose

All responses returned by [`method: APIRequestContext.get`] and similar methods are stored in the memory, so that you can later call [`method: APIResponse.body`]. This method
discards all stored responses, and makes [`method: APIResponse.body`] throw "Response disposed" error.

## async method: APIRequestContext.fetch
- returns: <[APIResponse]>

Sends HTTP(S) request and returns its response. The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.fetch.urlOrRequest
- `urlOrRequest` <[string]|[Request]>

Target URL or Request to get all parameters from.

### option: APIRequestContext.fetch.params = %%-fetch-option-params-%%

### option: APIRequestContext.fetch.method
- `method` <[string]>

If set changes the fetch method (e.g. [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) or
[POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST)). If not specified, GET method is used.

### option: APIRequestContext.fetch.headers = %%-fetch-option-headers-%%
### option: APIRequestContext.fetch.data = %%-fetch-option-data-%%
### option: APIRequestContext.fetch.form = %%-fetch-option-form-%%
### option: APIRequestContext.fetch.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.fetch.multipart = %%-java-fetch-option-multipart-%%
### option: APIRequestContext.fetch.timeout = %%-fetch-option-timeout-%%
### option: APIRequestContext.fetch.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: APIRequestContext.fetch.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: APIRequestContext.get
- returns: <[APIResponse]>

Sends HTTP(S) [GET](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.get.url = %%-fetch-param-url-%%
### option: APIRequestContext.get.params = %%-fetch-option-params-%%
### option: APIRequestContext.get.headers = %%-fetch-option-headers-%%
### option: APIRequestContext.get.timeout = %%-fetch-option-timeout-%%
### option: APIRequestContext.get.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: APIRequestContext.get.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: APIRequestContext.head
- returns: <[APIResponse]>

Sends HTTP(S) [HEAD](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.head.url = %%-fetch-param-url-%%
### option: APIRequestContext.head.params = %%-fetch-option-params-%%
### option: APIRequestContext.head.headers = %%-fetch-option-headers-%%
### option: APIRequestContext.head.timeout = %%-fetch-option-timeout-%%
### option: APIRequestContext.head.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: APIRequestContext.head.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: APIRequestContext.patch
- returns: <[APIResponse]>

Sends HTTP(S) [PATCH](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.patch.url = %%-fetch-param-url-%%
### option: APIRequestContext.patch.params = %%-fetch-option-params-%%
### option: APIRequestContext.patch.headers = %%-fetch-option-headers-%%
### option: APIRequestContext.patch.data = %%-fetch-option-data-%%
### option: APIRequestContext.patch.form = %%-fetch-option-form-%%
### option: APIRequestContext.patch.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.patch.multipart = %%-java-fetch-option-multipart-%%
### option: APIRequestContext.patch.timeout = %%-fetch-option-timeout-%%
### option: APIRequestContext.patch.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: APIRequestContext.patch.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: APIRequestContext.post
- returns: <[APIResponse]>

Sends HTTP(S) [POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.post.url = %%-fetch-param-url-%%
### option: APIRequestContext.post.params = %%-fetch-option-params-%%
### option: APIRequestContext.post.headers = %%-fetch-option-headers-%%
### option: APIRequestContext.post.data = %%-fetch-option-data-%%
### option: APIRequestContext.post.form = %%-fetch-option-form-%%
### option: APIRequestContext.post.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.post.multipart = %%-java-fetch-option-multipart-%%
### option: APIRequestContext.post.timeout = %%-fetch-option-timeout-%%
### option: APIRequestContext.post.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: APIRequestContext.post.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: APIRequestContext.put
- returns: <[APIResponse]>

Sends HTTP(S) [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.put.url = %%-fetch-param-url-%%
### option: APIRequestContext.put.params = %%-fetch-option-params-%%
### option: APIRequestContext.put.headers = %%-fetch-option-headers-%%
### option: APIRequestContext.put.data = %%-fetch-option-data-%%
### option: APIRequestContext.put.form = %%-fetch-option-form-%%
### option: APIRequestContext.put.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.put.multipart = %%-java-fetch-option-multipart-%%
### option: APIRequestContext.put.timeout = %%-fetch-option-timeout-%%
### option: APIRequestContext.put.failOnStatusCode = %%-fetch-option-failonstatuscode-%%
### option: APIRequestContext.put.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: APIRequestContext.storageState
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

## async method: APIRequestContext.storageState
* langs: java
- returns: <[string]>

### option: APIRequestContext.storageState.path = %%-storagestate-option-path-%%
