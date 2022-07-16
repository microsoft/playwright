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
    assert response.json()["name"] == "foobar"
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
  - `name` <[string]> Name of the header.
  - `value` <[string]> Value of the header.

An array with all the request HTTP headers associated with this response. Header names are not lower-cased.
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
