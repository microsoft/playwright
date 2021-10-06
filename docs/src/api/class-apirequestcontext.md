# class: ApiRequestContext
* langs: js

This API is used for the Web API testing. You can use it to trigger API endpoints, configure micro-services, prepare
environment or the service to your e2e test. When used on [Page] or a [BrowserContext], this API will automatically use
the cookies from the corresponding [BrowserContext]. This means that if you log in using this API, your e2e test
will be logged in and vice versa.

## async method: ApiRequestContext.dispose

All responses received through [`method: ApiRequestContext.fetch`], [`method: ApiRequestContext.get`], [`method: ApiRequestContext.post`]
and other methods are stored in the memory, so that you can later call [`method: ApiResponse.body`]. This method
discards all stored responses, and makes [`method: ApiResponse.body`] throw "Response disposed" error.

## async method: ApiRequestContext.fetch
- returns: <[ApiResponse]>

Sends HTTP(S) fetch and returns its response. The method will populate fetch cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.fetch.urlOrRequest
- `urlOrRequest` <[string]|[Request]>

Target URL or Request to get all fetch parameters from.

### option: ApiRequestContext.fetch.params
- `params` <[Object]<[string], [string]>>

Query parameters to be send with the URL.

### option: ApiRequestContext.fetch.method
- `method` <[string]>

If set changes the fetch method (e.g. PUT or POST). If not specified, GET method is used.

### option: ApiRequestContext.fetch.headers
- `headers` <[Object]<[string], [string]>>

Allows to set HTTP headers.

### option: ApiRequestContext.fetch.data = %%-fetch-option-data-%%
### option: ApiRequestContext.fetch.form = %%-fetch-option-form-%%
### option: ApiRequestContext.fetch.multipart = %%-fetch-option-multipart-%%

### option: ApiRequestContext.fetch.timeout
- `timeout` <[float]>

Request timeout in milliseconds.

### option: ApiRequestContext.fetch.failOnStatusCode
- `failOnStatusCode` <[boolean]>

Whether to throw on response codes other than 2xx and 3xx. By default response object is returned
for all status codes.

### option: ApiRequestContext.fetch.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%


## async method: ApiRequestContext.get
- returns: <[ApiResponse]>

Sends HTTP(S) GET request and returns its response. The method will populate fetch cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.get.url
- `url` <[string]>

Target URL.

### option: ApiRequestContext.get.params
- `params` <[Object]<[string], [string]>>

Query parameters to be send with the URL.

### option: ApiRequestContext.get.headers
- `headers` <[Object]<[string], [string]>>

Allows to set HTTP headers.

### option: ApiRequestContext.get.timeout
- `timeout` <[float]>

Request timeout in milliseconds.

### option: ApiRequestContext.get.failOnStatusCode
- `failOnStatusCode` <[boolean]>

Whether to throw on response codes other than 2xx and 3xx. By default response object is returned
for all status codes.

### option: ApiRequestContext.get.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

## async method: ApiRequestContext.post
- returns: <[ApiResponse]>

Sends HTTP(S) fetch and returns its response. The method will populate fetch cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: ApiRequestContext.post.url
- `url` <[string]>

Target URL.

### option: ApiRequestContext.post.params
- `params` <[Object]<[string], [string]>>

Query parameters to be send with the URL.

### option: ApiRequestContext.post.headers
- `headers` <[Object]<[string], [string]>>

Allows to set HTTP headers.

### option: ApiRequestContext.post.data = %%-fetch-option-data-%%

### option: ApiRequestContext.post.form = %%-fetch-option-form-%%

### option: ApiRequestContext.post.multipart = %%-fetch-option-multipart-%%

### option: ApiRequestContext.post.timeout
- `timeout` <[float]>

Request timeout in milliseconds.

### option: ApiRequestContext.post.failOnStatusCode
- `failOnStatusCode` <[boolean]>

Whether to throw on response codes other than 2xx and 3xx. By default response object is returned
for all status codes.

### option: ApiRequestContext.post.ignoreHTTPSErrors = %%-context-option-ignorehttpserrors-%%

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
