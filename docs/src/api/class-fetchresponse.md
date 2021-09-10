# class: FetchResponse

[FetchResponse] class represents responses received from [`method: BrowserContext.fetch`] and [`method: Page.fetch`] methods.

## async method: FetchResponse.body
- returns: <[Buffer]>

Returns the buffer with response body.

## async method: FetchResponse.dispose

Disposes the body of this response. If not called then the body will stay in memory until the context closes.

## method: FetchResponse.headers
- returns: <[Object]<[string], [string]>>

An object with all the response HTTP headers associated with this response.

## method: FetchResponse.headersArray
- returns: <[Array]<[Object]>>
  - `name` <[string]> Name of the header.
  - `value` <[string]> Value of the header.

An array with all the request HTTP headers associated with this response. Header names are not lower-cased.
Headers with multiple entries, such as `Set-Cookie`, appear in the array multiple times.

## async method: FetchResponse.json
* langs: js, python
- returns: <[Serializable]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## async method: FetchResponse.json
* langs: csharp
- returns: <[null]|[JsonElement]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## method: FetchResponse.ok
- returns: <[boolean]>

Contains a boolean stating whether the response was successful (status in the range 200-299) or not.

## method: FetchResponse.status
- returns: <[int]>

Contains the status code of the response (e.g., 200 for a success).

## method: FetchResponse.statusText
- returns: <[string]>

Contains the status text of the response (e.g. usually an "OK" for a success).

## async method: FetchResponse.text
- returns: <[string]>

Returns the text representation of response body.

## method: FetchResponse.url
- returns: <[string]>

Contains the URL of the response.
