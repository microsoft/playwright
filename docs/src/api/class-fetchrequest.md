# class: FetchRequest
* langs: js

This API is used for Web API testing. You can use it to trigger API endpoints, configure micro-services, prepare
environment or the service to your e2e test. When used on [Page] or a [BrowserContext], this API will automatically use
the cookies from the corresponding [BrowserContext]. This means that if you log in using this API, your e2e test
will be logged in and vice versa.

## async method: FetchRequest.dispose

All responses received through [`method: FetchRequest.fetch`], [`method: FetchRequest.get`], [`method: FetchRequest.post`]
and other methods are stored in the memory, so that you can later call [`method: FetchResponse.body`]. This method
discards all stored responses, and makes [`method: FetchResponse.body`] throw "Response disposed" error.

## async method: FetchRequest.fetch
- returns: <[FetchResponse]>

Sends HTTP(S) fetch and returns its response. The method will populate fetch cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: FetchRequest.fetch.urlOrRequest
- `urlOrRequest` <[string]|[Request]>

Target URL or Request to get all fetch parameters from.

### option: FetchRequest.fetch.params
- `params` <[Object]<[string], [string]>>

Query parameters to be send with the URL.

### option: FetchRequest.fetch.method
- `method` <[string]>

If set changes the fetch method (e.g. PUT or POST). If not specified, GET method is used.

### option: FetchRequest.fetch.headers
- `headers` <[Object]<[string], [string]>>

Allows to set HTTP headers.

### option: FetchRequest.fetch.data
- `data` <[string]|[Buffer]>

Allows to set post data of the fetch.

### option: FetchRequest.fetch.timeout
- `timeout` <[float]>

Request timeout in milliseconds.

### option: FetchRequest.fetch.failOnStatusCode
- `failOnStatusCode` <[boolean]>

Whether to throw on response codes other than 2xx and 3xx. By default response object is returned
for all status codes.

## async method: FetchRequest.get
- returns: <[FetchResponse]>

Sends HTTP(S) GET request and returns its response. The method will populate fetch cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: FetchRequest.get.urlOrRequest
- `urlOrRequest` <[string]|[Request]>

Target URL or Request to get all fetch parameters from.

### option: FetchRequest.get.params
- `params` <[Object]<[string], [string]>>

Query parameters to be send with the URL.

### option: FetchRequest.get.headers
- `headers` <[Object]<[string], [string]>>

Allows to set HTTP headers.

### option: FetchRequest.get.timeout
- `timeout` <[float]>

Request timeout in milliseconds.

### option: FetchRequest.get.failOnStatusCode
- `failOnStatusCode` <[boolean]>

Whether to throw on response codes other than 2xx and 3xx. By default response object is returned
for all status codes.

## async method: FetchRequest.post
- returns: <[FetchResponse]>

Sends HTTP(S) fetch and returns its response. The method will populate fetch cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: FetchRequest.post.urlOrRequest
- `urlOrRequest` <[string]|[Request]>

Target URL or Request to get all fetch parameters from.

### option: FetchRequest.post.params
- `params` <[Object]<[string], [string]>>

Query parameters to be send with the URL.

### option: FetchRequest.post.headers
- `headers` <[Object]<[string], [string]>>

Allows to set HTTP headers.

### option: FetchRequest.post.data
- `data` <[string]|[Buffer]>

Allows to set post data of the fetch.

### option: FetchRequest.post.timeout
- `timeout` <[float]>

Request timeout in milliseconds.

### option: FetchRequest.post.failOnStatusCode
- `failOnStatusCode` <[boolean]>

Whether to throw on response codes other than 2xx and 3xx. By default response object is returned
for all status codes.
