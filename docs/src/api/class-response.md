# class: Response
* since: v1.8

[Response] class represents responses which are received by page.

## async method: Response.allHeaders
* since: v1.15
- returns: <[Object]<[string], [string]>>

An object with all the response HTTP headers associated with this response.

## async method: Response.body
* since: v1.8
- returns: <[Buffer]>

Returns the buffer with response body.

## async method: Response.finished
* since: v1.8
- returns: <[null]|[string]>

Waits for this response to finish, returns always `null`.

## async method: Response.finished
* since: v1.8
* langs: js
- returns: <[null]|[Error]>

## method: Response.frame
* since: v1.8
- returns: <[Frame]>

Returns the [Frame] that initiated this response.

## method: Response.fromServiceWorker
* since: v1.23
- returns: <[boolean]>

Indicates whether this Response was fulfilled by a Service Worker's Fetch Handler (i.e. via [FetchEvent.respondWith](https://developer.mozilla.org/en-US/docs/Web/API/FetchEvent/respondWith)).

## method: Response.headers
* since: v1.8
- returns: <[Object]<[string], [string]>>

An object with the response HTTP headers. The header names are lower-cased.
Note that this method does not return security-related headers, including cookie-related ones.
You can use [`method: Response.allHeaders`] for complete list of headers that include `cookie` information.

## async method: Response.headersArray
* since: v1.15
- returns: <[Array]<[Object]>>
  - `name` <[string]> Name of the header.
  - `value` <[string]> Value of the header.

An array with all the request HTTP headers associated with this response. Unlike [`method: Response.allHeaders`], header names are NOT lower-cased.
Headers with multiple entries, such as `Set-Cookie`, appear in the array multiple times.

## async method: Response.headerValue
* since: v1.15
- returns: <[null]|[string]>

Returns the value of the header matching the name. The name is case-insensitive. If multiple headers have
the same name (except `set-cookie`), they are returned as a list separated by `, `. For `set-cookie`, the `\n` separator is used. If no headers are found, `null` is returned.

### param: Response.headerValue.name
* since: v1.15
- `name` <[string]>

Name of the header.

## async method: Response.headerValues
* since: v1.15
- returns: <[Array]<[string]>>

Returns all values of the headers matching the name, for example `set-cookie`. The name is case-insensitive.

### param: Response.headerValues.name
* since: v1.15
- `name` <[string]>

Name of the header.

## async method: Response.json
* since: v1.8
* langs: js, python
- returns: <[Serializable]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## async method: Response.json
* since: v1.8
* langs: csharp
- returns: <[null]|[JsonElement]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## method: Response.ok
* since: v1.8
- returns: <[boolean]>

Contains a boolean stating whether the response was successful (status in the range 200-299) or not.

## method: Response.request
* since: v1.8
- returns: <[Request]>

Returns the matching [Request] object.

## async method: Response.securityDetails
* since: v1.13
- returns: <[null]|[Object]>
  - `issuer` ?<[string]> Common Name component of the Issuer field.
    from the certificate. This should only be used for informational purposes. Optional.
  - `protocol` ?<[string]> The specific TLS protocol used. (e.g. `TLS 1.3`). Optional.
  - `subjectName` ?<[string]> Common Name component of the Subject
    field from the certificate. This should only be used for informational purposes. Optional.
  - `validFrom` ?<[float]> Unix timestamp (in seconds) specifying
    when this cert becomes valid. Optional.
  - `validTo` ?<[float]> Unix timestamp (in seconds) specifying
    when this cert becomes invalid. Optional.

Returns SSL and other security information.

## async method: Response.serverAddr
* since: v1.13
- returns: <[null]|[Object]>
  - `ipAddress` <[string]> IPv4 or IPV6 address of the server.
  - `port` <[int]>

Returns the IP address and port of the server.

## method: Response.status
* since: v1.8
- returns: <[int]>

Contains the status code of the response (e.g., 200 for a success).

## method: Response.statusText
* since: v1.8
- returns: <[string]>

Contains the status text of the response (e.g. usually an "OK" for a success).

## async method: Response.text
* since: v1.8
- returns: <[string]>

Returns the text representation of response body.

## method: Response.url
* since: v1.8
- returns: <[string]>

Contains the URL of the response.
