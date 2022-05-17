# class: APIRequestContext

This API is used for the Web API testing. You can use it to trigger API endpoints, configure micro-services, prepare
environment or the service to your e2e test.

Each Playwright browser context has associated with it [APIRequestContext] instance which shares cookie storage with
the browser context and can be accessed via [`property: BrowserContext.request`] or [`property: Page.request`].
It is also possible to create a new APIRequestContext instance manually by calling [`method: APIRequest.newContext`].

**Cookie management**

[APIRequestContext] retuned by [`property: BrowserContext.request`] and [`property: Page.request`] shares cookie
storage with the corresponding [BrowserContext]. Each API request will have `Cookie` header populated with the
values from the browser context. If the API response contains `Set-Cookie` header it will automatically update
[BrowserContext] cookies and requests made from the page will pick them up. This means that if you log in using
this API, your e2e test will be logged in and vice versa.

If you want API requests to not interfere with the browser cookies you shoud create a new [APIRequestContext] by
calling [`method: APIRequest.newContext`]. Such `APIRequestContext` object will have its own isolated cookie
storage.

```python async
import os
import asyncio
from playwright.async_api import async_playwright, Playwright

REPO = "test-repo-1"
USER = "github-username"
API_TOKEN = os.getenv("GITHUB_API_TOKEN")

async def run(playwright: Playwright):
    # This will launch a new browser, create a context and page. When making HTTP
    # requests with the internal APIRequestContext (e.g. `context.request` or `page.request`)
    # it will automatically set the cookies to the browser page and vise versa.
    browser = await playwright.chromium.launch()
    context = await browser.new_context(base_url="https://api.github.com")
    api_request_context = context.request
    page = await context.new_page()

    # Alternatively you can create a APIRequestContext manually without having a browser context attached:
    # api_request_context = await playwright.request.new_context(base_url="https://api.github.com")

    # Create a repository.
    response = await api_request_context.post(
        "/user/repos",
        headers={
            "Accept": "application/vnd.github.v3+json",
            # Add GitHub personal access token.
            "Authorization": f"token {API_TOKEN}",
        },
        data={"name": REPO},
    )
    assert response.ok
    assert response.json()["name"] == REPO

    # Delete a repository.
    response = await api_request_context.delete(
        f"/repos/{USER}/{REPO}",
        headers={
            "Accept": "application/vnd.github.v3+json",
            # Add GitHub personal access token.
            "Authorization": f"token {API_TOKEN}",
        },
    )
    assert response.ok
    assert await response.body() == '{"status": "ok"}'

async def main():
    async with async_playwright() as playwright:
        await run(playwright)

asyncio.run(main())
```

```python sync
import os
from playwright.sync_api import sync_playwright

REPO = "test-repo-1"
USER = "github-username"
API_TOKEN = os.getenv("GITHUB_API_TOKEN")

with sync_playwright() as p:
    # This will launch a new browser, create a context and page. When making HTTP
    # requests with the internal APIRequestContext (e.g. `context.request` or `page.request`)
    # it will automatically set the cookies to the browser page and vise versa.
    browser = p.chromium.launch()
    context = browser.new_context(base_url="https://api.github.com")
    api_request_context = context.request
    page = context.new_page()

    # Alternatively you can create a APIRequestContext manually without having a browser context attached:
    # api_request_context = p.request.new_context(base_url="https://api.github.com")


    # Create a repository.
    response = api_request_context.post(
        "/user/repos",
        headers={
            "Accept": "application/vnd.github.v3+json",
            # Add GitHub personal access token.
            "Authorization": f"token {API_TOKEN}",
        },
        data={"name": REPO},
    )
    assert response.ok
    assert response.json()["name"] == REPO

    # Delete a repository.
    response = api_request_context.delete(
        f"/repos/{USER}/{REPO}",
        headers={
            "Accept": "application/vnd.github.v3+json",
            # Add GitHub personal access token.
            "Authorization": f"token {API_TOKEN}",
        },
    )
    assert response.ok
    assert await response.body() == '{"status": "ok"}'
```

## async method: APIRequestContext.delete
- returns: <[APIResponse]>

Sends HTTP(S) [DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.delete.url = %%-fetch-param-url-%%
### param: APIRequestContext.delete.params = %%-java-csharp-fetch-params-%%
### option: APIRequestContext.delete.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.delete.params = %%-csharp-fetch-option-params-%%
### option: APIRequestContext.delete.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.delete.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.delete.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.delete.form = %%-csharp-fetch-option-form-%%
### option: APIRequestContext.delete.multipart = %%-js-python-fetch-option-multipart-%%
### option: APIRequestContext.delete.multipart = %%-csharp-fetch-option-multipart-%%
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

### param: APIRequestContext.fetch.params = %%-java-csharp-fetch-params-%%
### option: APIRequestContext.fetch.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.fetch.params = %%-csharp-fetch-option-params-%%

### option: APIRequestContext.fetch.method
* langs: js, python, csharp
- `method` <[string]>

If set changes the fetch method (e.g. [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) or
[POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST)). If not specified, GET method is used.

### option: APIRequestContext.fetch.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.fetch.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.fetch.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.fetch.form = %%-csharp-fetch-option-form-%%
### option: APIRequestContext.fetch.multipart = %%-js-python-fetch-option-multipart-%%
### option: APIRequestContext.fetch.multipart = %%-csharp-fetch-option-multipart-%%
### option: APIRequestContext.fetch.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.fetch.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.fetch.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

## async method: APIRequestContext.get
- returns: <[APIResponse]>

Sends HTTP(S) [GET](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.get.url = %%-fetch-param-url-%%
### param: APIRequestContext.get.params = %%-java-csharp-fetch-params-%%
### option: APIRequestContext.get.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.get.params = %%-csharp-fetch-option-params-%%
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
### param: APIRequestContext.head.params = %%-java-csharp-fetch-params-%%
### option: APIRequestContext.head.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.head.params = %%-csharp-fetch-option-params-%%
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
### param: APIRequestContext.patch.params = %%-java-csharp-fetch-params-%%
### option: APIRequestContext.patch.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.patch.params = %%-csharp-fetch-option-params-%%
### option: APIRequestContext.patch.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.patch.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.patch.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.patch.form = %%-csharp-fetch-option-form-%%
### option: APIRequestContext.patch.multipart = %%-js-python-fetch-option-multipart-%%
### option: APIRequestContext.patch.multipart = %%-csharp-fetch-option-multipart-%%
### option: APIRequestContext.patch.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.patch.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.patch.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

## async method: APIRequestContext.post
- returns: <[APIResponse]>

Sends HTTP(S) [POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.post.url = %%-fetch-param-url-%%
### param: APIRequestContext.post.params = %%-java-csharp-fetch-params-%%
### option: APIRequestContext.post.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.post.params = %%-csharp-fetch-option-params-%%
### option: APIRequestContext.post.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.post.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.post.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.post.form = %%-csharp-fetch-option-form-%%
### option: APIRequestContext.post.multipart = %%-js-python-fetch-option-multipart-%%
### option: APIRequestContext.post.multipart = %%-csharp-fetch-option-multipart-%%
### option: APIRequestContext.post.timeout = %%-js-python-fetch-option-timeout-%%
### option: APIRequestContext.post.failOnStatusCode = %%-js-python-fetch-option-failonstatuscode-%%
### option: APIRequestContext.post.ignoreHTTPSErrors = %%-js-python-fetch-option-ignorehttpserrors-%%

## async method: APIRequestContext.put
- returns: <[APIResponse]>

Sends HTTP(S) [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.put.url = %%-fetch-param-url-%%
### param: APIRequestContext.put.params = %%-java-csharp-fetch-params-%%
### option: APIRequestContext.put.params = %%-js-python-fetch-option-params-%%
### option: APIRequestContext.put.params = %%-csharp-fetch-option-params-%%
### option: APIRequestContext.put.headers = %%-js-python-fetch-option-headers-%%
### option: APIRequestContext.put.data = %%-js-python-fetch-option-data-%%
### option: APIRequestContext.put.form = %%-js-python-fetch-option-form-%%
### option: APIRequestContext.put.form = %%-csharp-fetch-option-form-%%
### option: APIRequestContext.put.multipart = %%-js-python-fetch-option-multipart-%%
### option: APIRequestContext.put.multipart = %%-csharp-fetch-option-multipart-%%
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
* langs: java, csharp
- returns: <[string]>

### option: APIRequestContext.storageState.path = %%-storagestate-option-path-%%
