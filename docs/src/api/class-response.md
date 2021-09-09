# class: Response

[Response] class represents responses which are received by page.

## async method: Response.allHeaders
- returns: <[Object]<[string], [string]>>

An object with all the response HTTP headers associated with this response.

## async method: Response.body
- returns: <[Buffer]>

Returns the buffer with response body.

## async method: Response.finished
- returns: <[null]|[string]>

Waits for this response to finish, returns always `null`.

## method: Response.frame
- returns: <[Frame]>

Returns the [Frame] that initiated this response.

## method: Response.headers
- returns: <[Object]<[string], [string]>>

**DEPRECATED** Incomplete list of headers as seen by the rendering engine. Use [`method: Response.allHeaders`] instead.

## async method: Response.headersArray
* langs: js, csharp, python
- returns: <[Array]<[Array]<[string]>>>

An array with all the request HTTP headers associated with this response. Unlike [`method: Response.allHeaders`], header names are not lower-cased.
Headers with multiple entries, such as `Set-Cookie`, appear in the array multiple times.

## async method: Response.headersArray
* langs: java
- returns: <[Array]<[Object]>>
  - `name` <[string]> Name of the header.
  - `value` <[string]> Value of the header.

An array with all the request HTTP headers associated with this response. Unlike [`method: Response.allHeaders`], header names are not lower-cased.
Headers with multiple entries, such as `Set-Cookie`, appear in the array multiple times.

## async method: Response.getHeaderValue
- returns: <[null]|[string]>

Returns the first value of the header matching the name. The name is case insensitive. If multiple headers have the same name, for example `set-cookie`, the first is returned. If no header is found, `null` is returned.

### param: Response.getHeaderValue.name
- `name` <[string]>

Name of the header.

## async method: Response.getHeaderValues
- returns: <[Array]<[string]>>

Returns all values of the headers matching the name, for example `set-cookie`. The name is case insensitive.

### param: Response.getHeaderValues.name
- `name` <[string]>

Name of the header.

## async method: Response.json
* langs: js, python
- returns: <[Serializable]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## async method: Response.json
* langs: csharp
- returns: <[null]|[JsonElement]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## method: Response.ok
- returns: <[boolean]>

Contains a boolean stating whether the response was successful (status in the range 200-299) or not.

## method: Response.request
- returns: <[Request]>

Returns the matching [Request] object.

## async method: Response.securityDetails
- returns: <[null]|[Object]>
  - `issuer` <[string]> Common Name component of the Issuer field.
    from the certificate. This should only be used for informational purposes. Optional.
  - `protocol` <[string]> The specific TLS protocol used. (e.g. `TLS 1.3`). Optional.
  - `subjectName` <[string]> Common Name component of the Subject
    field from the certificate. This should only be used for informational purposes. Optional.
  - `validFrom` <[float]> Unix timestamp (in seconds) specifying
    when this cert becomes valid. Optional.
  - `validTo` <[float]> Unix timestamp (in seconds) specifying
    when this cert becomes invalid. Optional.

Returns SSL and other security information.

## async method: Response.serverAddr
- returns: <[null]|[Object]>
  - `ipAddress` <[string]> IPv4 or IPV6 address of the server.
  - `port` <[int]>

Returns the IP address and port of the server.

## method: Response.status
- returns: <[int]>

Contains the status code of the response (e.g., 200 for a success).

## method: Response.statusText
- returns: <[string]>

Contains the status text of the response (e.g. usually an "OK" for a success).

## async method: Response.text
- returns: <[string]>

Returns the text representation of response body.

## method: Response.url
- returns: <[string]>

Contains the URL of the response.
