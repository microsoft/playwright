# class: APIResponse
* since: v1.16

[APIResponse] class represents responses returned by [`method: APIRequestContext.get`] and similar methods.

```python async
import asyncio
from playwright.async_api import async_playwright, Playwright

async def run(playwright: Playwright):
    context = await playwright.request.new_context()
    response = await context.get("https://example.com/user/repos")
    assert response.ok
    assert response.status == 200
    assert response.headers["content-type"] == "application/json; charset=utf-8"
    json_data = await response.json()
    assert json_data["name"] == "foobar"
    assert await response.body() == '{"status": "ok"}'


async def main():
    async with async_playwright() as playwright:
        await run(playwright)

asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    context = playwright.request.new_context()
    response = context.get("https://example.com/user/repos")
    assert response.ok
    assert response.status == 200
    assert response.headers["content-type"] == "application/json; charset=utf-8"
    assert response.json()["name"] == "foobar"
    assert response.body() == '{"status": "ok"}'
```

## async method: APIResponse.body
* since: v1.16
- returns: <[Buffer]>

Returns the buffer with response body.

## async method: APIResponse.dispose
* since: v1.16

Disposes the body of this response. If not called then the body will stay in memory until the context closes.

## method: APIResponse.headers
* since: v1.16
- returns: <[Object]<[string], [string]>>

An object with all the response HTTP headers associated with this response.

## method: APIResponse.headersArray
* since: v1.16
- returns: <[Array]<[Object]>>
  * alias: HttpHeader
  * alias-csharp: Header
  - `name` <[string]> Name of the header.
  - `value` <[string]> Value of the header.

An array with all the response HTTP headers associated with this response. Header names are not lower-cased.
Headers with multiple entries, such as `Set-Cookie`, appear in the array multiple times.

## async method: APIResponse.json
* since: v1.16
* langs: js, python
- returns: <[Serializable]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## async method: APIResponse.json
* since: v1.16
* langs: csharp
- returns: <[null]|[JsonElement]>

Returns the JSON representation of response body.

This method will throw if the response body is not parsable via `JSON.parse`.

## method: APIResponse.ok
* since: v1.16
- returns: <[boolean]>

Contains a boolean stating whether the response was successful (status in the range 200-299) or not.

## async method: APIResponse.securityDetails
* since: v1.61
- returns: <[null]|[Object]>
  * alias: SecurityDetails
  * alias-csharp: ResponseSecurityDetailsResult
  - `issuer` ?<[string]> Common Name component of the Issuer field.
    from the certificate. This should only be used for informational purposes. Optional.
  - `protocol` ?<[string]> The specific TLS protocol used. (e.g. `TLS 1.3`). Optional.
  - `subjectName` ?<[string]> Common Name component of the Subject
    field from the certificate. This should only be used for informational purposes. Optional.
  - `validFrom` ?<[float]> Unix timestamp (in seconds) specifying
    when this cert becomes valid. Optional.
  - `validTo` ?<[float]> Unix timestamp (in seconds) specifying
    when this cert becomes invalid. Optional.

Returns SSL and other security information. Resolves to `null` for non-HTTPS responses. For redirected requests, returns the information for the last request in the redirect chain.

## async method: APIResponse.serverAddr
* since: v1.61
- returns: <[null]|[Object]>
  * alias-csharp: ResponseServerAddrResult
  * alias-java: ServerAddr
  - `ipAddress` <[string]> IPv4 or IPV6 address of the server.
  - `port` <[int]>

Returns the IP address and port of the server. Resolves to `null` if the server address is not available. For redirected requests, returns the information for the last request in the redirect chain.

## method: APIResponse.status
* since: v1.16
- returns: <[int]>

Contains the status code of the response (e.g., 200 for a success).

## method: APIResponse.statusText
* since: v1.16
- returns: <[string]>

Contains the status text of the response (e.g. usually an "OK" for a success).

## async method: APIResponse.text
* since: v1.16
- returns: <[string]>

Returns the text representation of response body.

## method: APIResponse.url
* since: v1.16
- returns: <[string]>

Contains the URL of the response.
