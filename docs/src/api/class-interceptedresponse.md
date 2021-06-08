# class: InterceptedResponse

Whenever a network route is set up with [`method: Page.route`] or [`method: BrowserContext.route`], the `Route` object
allows to handle the route.

## async method: InterceptedResponse.abort

Aborts the route's response.

### param: InterceptedResponse.abort.errorCode
- `errorCode` <[string]>

Optional error code. Defaults to `failed`, could be one of the following:
* `'aborted'` - An operation was aborted (due to user action)
* `'accessdenied'` - Permission to access a resource, other than the network, was denied
* `'addressunreachable'` - The IP address is unreachable. This usually means that there is no route to the specified
  host or network.
* `'blockedbyclient'` - The client chose to block the request.
* `'blockedbyresponse'` - The request failed because the response was delivered along with requirements which are not
  met ('X-Frame-Options' and 'Content-Security-Policy' ancestor checks, for instance).
* `'connectionaborted'` - A connection timed out as a result of not receiving an ACK for data sent.
* `'connectionclosed'` - A connection was closed (corresponding to a TCP FIN).
* `'connectionfailed'` - A connection attempt failed.
* `'connectionrefused'` - A connection attempt was refused.
* `'connectionreset'` - A connection was reset (corresponding to a TCP RST).
* `'internetdisconnected'` - The Internet connection has been lost.
* `'namenotresolved'` - The host name could not be resolved.
* `'timedout'` - An operation timed out.
* `'failed'` - A generic failure occurred.

## async method: InterceptedResponse.body
- returns: <[Buffer]>

Returns the buffer with response body.

## async method: InterceptedResponse.continue
* langs:
  - alias-java: resume
  - alias-python: continue_

Continues route's response with optional overrides.

### option: InterceptedResponse.continue.status
- `status` <[int]>

Response status code.

### option: InterceptedResponse.continue.status
- `statusText` <[string]>

Response status text.

### option: InterceptedResponse.continue.headers
- `headers` <[Object]<[string], [string]>>

Response headers.

### option: InterceptedResponse.continue.contentType
- `contentType` <[string]>

If set, equals to setting `Content-Type` response header.

### option: InterceptedResponse.continue.body
* langs: js, python
- `body` <[string]|[Buffer]>

Response body.

### option: InterceptedResponse.continue.body
* langs: csharp, java
- `body` <[string]>

Optional response body as text.

### option: InterceptedResponse.continue.bodyBytes
* langs: csharp, java
- `bodyBytes` <[Buffer]>

Optional response body as raw bytes.

## method: InterceptedResponse.headers
- returns: <[Object]<[string], [string]>>

Returns the object with HTTP headers associated with the response. All header names are lower-case.

## async method: InterceptedResponse.json
* langs: js, python
- returns: <[Serializable]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## async method: InterceptedResponse.json
* langs: csharp
- returns: <[JsonElement?]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## method: InterceptedResponse.request
- returns: <[Request]>

Returns the matching [Request] object.

## method: InterceptedResponse.status
- returns: <[int]>

Contains the status code of the response (e.g., 200 for a success).

## method: InterceptedResponse.statusText
- returns: <[string]>

Contains the status text of the response (e.g. usually an "OK" for a success).

## async method: InterceptedResponse.text
- returns: <[string]>

Returns the text representation of response body.
