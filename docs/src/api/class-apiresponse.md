# class: APIResponse
* langs: js, java, python

[APIResponse] class represents responses returned by [`method: APIRequestContext.get`] and similar methods.

## async method: APIResponse.body
- returns: <[Buffer]>

Returns the buffer with response body.

## async method: APIResponse.dispose

Disposes the body of this response. If not called then the body will stay in memory until the context closes.

## method: APIResponse.headers
- returns: <[Object]<[string], [string]>>

An object with all the response HTTP headers associated with this response.

## method: APIResponse.headersArray
- returns: <[Array]<[Object]>>
  - `name` <[string]> Name of the header.
  - `value` <[string]> Value of the header.

An array with all the request HTTP headers associated with this response. Header names are not lower-cased.
Headers with multiple entries, such as `Set-Cookie`, appear in the array multiple times.

## async method: APIResponse.json
* langs: js, python
- returns: <[Serializable]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## async method: APIResponse.json
* langs: csharp
- returns: <[null]|[JsonElement]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## method: APIResponse.ok
- returns: <[boolean]>

Contains a boolean stating whether the response was successful (status in the range 200-299) or not.

## method: APIResponse.status
- returns: <[int]>

Contains the status code of the response (e.g., 200 for a success).

## method: APIResponse.statusText
- returns: <[string]>

Contains the status text of the response (e.g. usually an "OK" for a success).

## async method: APIResponse.text
- returns: <[string]>

Returns the text representation of response body.

## method: APIResponse.url
- returns: <[string]>

Contains the URL of the response.
