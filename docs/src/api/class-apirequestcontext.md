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
### param: APIRequestContext.delete.params = %%-java-fetch-params-%%
### option: APIRequestContext.delete.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.delete.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.delete.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.delete.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.delete.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.delete.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.delete.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.delete.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

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

### param: APIRequestContext.fetch.params = %%-java-fetch-params-%%
### option: APIRequestContext.fetch.params = %%-js-python-fetch-option-params-%%

### option: APIRequestContext.fetch.method
* langs: js, python
- `method` <[string]>

If set changes the fetch method (e.g. [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) or
[POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST)). If not specified, GET method is used.

### option: APIRequestContext.fetch.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.fetch.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.fetch.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.fetch.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.fetch.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.fetch.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.fetch.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

## async method: APIRequestContext.get
- returns: <[APIResponse]>

Sends HTTP(S) [GET](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.get.url = %%-fetch-param-url-%%
### param: APIRequestContext.get.params = %%-java-fetch-params-%%
### option: APIRequestContext.get.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.get.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.get.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.get.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.get.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

## async method: APIRequestContext.head
- returns: <[APIResponse]>

Sends HTTP(S) [HEAD](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.head.url = %%-fetch-param-url-%%
### param: APIRequestContext.head.params = %%-java-fetch-params-%%
### option: APIRequestContext.head.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.head.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.head.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.head.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.head.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

## async method: APIRequestContext.patch
- returns: <[APIResponse]>

Sends HTTP(S) [PATCH](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.patch.url = %%-fetch-param-url-%%
### param: APIRequestContext.patch.params = %%-java-fetch-params-%%
### option: APIRequestContext.patch.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.patch.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.patch.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.patch.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.patch.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.patch.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.patch.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.patch.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

## async method: APIRequestContext.post
- returns: <[APIResponse]>

Sends HTTP(S) [POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.post.url = %%-fetch-param-url-%%
### param: APIRequestContext.post.params = %%-java-fetch-params-%%
### option: APIRequestContext.post.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.post.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.post.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.post.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.post.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.post.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.post.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.post.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

## async method: APIRequestContext.put
- returns: <[APIResponse]>

Sends HTTP(S) [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.put.url = %%-fetch-param-url-%%
### param: APIRequestContext.put.params = %%-java-fetch-params-%%
### option: APIRequestContext.put.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.put.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.put.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.put.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.put.multipart = %%-js-pyhton-fetch-option-multipart-%%
### option: APIRequestContext.put.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.put.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.put.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

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
