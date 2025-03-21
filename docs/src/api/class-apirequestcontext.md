# class: APIRequestContext
* since: v1.16

This API is used for the Web API testing. You can use it to trigger API endpoints, configure micro-services, prepare
environment or the service to your e2e test.

Each Playwright browser context has associated with it [APIRequestContext] instance which shares cookie storage with
the browser context and can be accessed via [`property: BrowserContext.request`] or [`property: Page.request`].
It is also possible to create a new APIRequestContext instance manually by calling [`method: APIRequest.newContext`].

**Cookie management**

[APIRequestContext] returned by [`property: BrowserContext.request`] and [`property: Page.request`] shares cookie
storage with the corresponding [BrowserContext]. Each API request will have `Cookie` header populated with the
values from the browser context. If the API response contains `Set-Cookie` header it will automatically update
[BrowserContext] cookies and requests made from the page will pick them up. This means that if you log in using
this API, your e2e test will be logged in and vice versa.

If you want API requests to not interfere with the browser cookies you should create a new [APIRequestContext] by
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
    # it will automatically set the cookies to the browser page and vice versa.
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
    # it will automatically set the cookies to the browser page and vice versa.
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

## method: APIRequestContext.createFormData
* since: v1.23
* langs: csharp
- returns: <[FormData]>

Creates a new [FormData] instance which is used for providing form and multipart data when making HTTP requests.

## async method: APIRequestContext.delete
* since: v1.16
- returns: <[APIResponse]>

Sends HTTP(S) [DELETE](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/DELETE) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.delete.url = %%-fetch-param-url-%%
* since: v1.16

### option: APIRequestContext.delete.params = %%-js-fetch-option-params-%%
* since: v1.16

### param: APIRequestContext.delete.params = %%-java-fetch-params-%%
* since: v1.18

### option: APIRequestContext.delete.params = %%-python-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.delete.params = %%-csharp-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.delete.paramsString = %%-csharp-fetch-option-paramsString-%%
* since: v1.47

### option: APIRequestContext.delete.headers = %%-js-python-csharp-fetch-option-headers-%%
* since: v1.16

### option: APIRequestContext.delete.data = %%-js-python-csharp-fetch-option-data-%%
* since: v1.17

### option: APIRequestContext.delete.form = %%-js-fetch-option-form-%%
* since: v1.17

### option: APIRequestContext.delete.form = %%-python-fetch-option-form-%%
* since: v1.17

### option: APIRequestContext.delete.form = %%-csharp-fetch-option-form-%%
* since: v1.17

### option: APIRequestContext.delete.multipart = %%-js-fetch-option-multipart-%%
* since: v1.17

### option: APIRequestContext.delete.multipart = %%-python-fetch-option-multipart-%%
* since: v1.17

### option: APIRequestContext.delete.multipart = %%-csharp-fetch-option-multipart-%%
* since: v1.17

### option: APIRequestContext.delete.timeout = %%-js-python-csharp-fetch-option-timeout-%%
* since: v1.16

### option: APIRequestContext.delete.failOnStatusCode = %%-js-python-csharp-fetch-option-failonstatuscode-%%
* since: v1.16

### option: APIRequestContext.delete.ignoreHTTPSErrors = %%-js-python-csharp-fetch-option-ignorehttpserrors-%%
* since: v1.16

### option: APIRequestContext.delete.maxRedirects = %%-js-python-csharp-fetch-option-maxredirects-%%
* since: v1.26

### option: APIRequestContext.delete.maxRetries = %%-js-python-csharp-fetch-option-maxretries-%%
* since: v1.46

## async method: APIRequestContext.dispose
* since: v1.16

All responses returned by [`method: APIRequestContext.get`] and similar methods are stored in the memory, so that you can later call [`method: APIResponse.body`].This method discards all its resources, calling any method on disposed [APIRequestContext] will throw an exception.

### option: APIRequestContext.dispose.reason
* since: v1.45
- `reason` <[string]>

The reason to be reported to the operations interrupted by the context disposal.

## async method: APIRequestContext.fetch
* since: v1.16
- returns: <[APIResponse]>

Sends HTTP(S) request and returns its response. The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

**Usage**

JSON objects can be passed directly to the request:

```js
await request.fetch('https://example.com/api/createBook', {
  method: 'post',
  data: {
    title: 'Book Title',
    author: 'John Doe',
  }
});
```

```java
Map<String, Object> data = new HashMap();
data.put("title", "Book Title");
data.put("body", "John Doe");
request.fetch("https://example.com/api/createBook", RequestOptions.create().setMethod("post").setData(data));
```

```python
data = {
    "title": "Book Title",
    "body": "John Doe",
}
api_request_context.fetch("https://example.com/api/createBook", method="post", data=data)
```

```csharp
var data = new Dictionary<string, object>() {
  { "title", "Book Title" },
  { "body", "John Doe" }
};
await Request.FetchAsync("https://example.com/api/createBook", new() { Method = "post", DataObject = data });
```

The common way to send file(s) in the body of a request is to upload them as form fields with `multipart/form-data` encoding, by specifiying the `multipart` parameter:

```js
const form = new FormData();
form.set('name', 'John');
form.append('name', 'Doe');
// Send two file fields with the same name.
form.append('file', new File(['console.log(2024);'], 'f1.js', { type: 'text/javascript' }));
form.append('file', new File(['hello'], 'f2.txt', { type: 'text/plain' }));
await request.fetch('https://example.com/api/uploadForm', {
  multipart: form
});
```

```java
// Pass file path to the form data constructor:
Path file = Paths.get("team.csv");
APIResponse response = request.fetch("https://example.com/api/uploadTeamList",
  RequestOptions.create().setMethod("post").setMultipart(
    FormData.create().set("fileField", file)));

// Or you can pass the file content directly as FilePayload object:
FilePayload filePayload = new FilePayload("f.js", "text/javascript",
      "console.log(2022);".getBytes(StandardCharsets.UTF_8));
APIResponse response = request.fetch("https://example.com/api/uploadScript",
  RequestOptions.create().setMethod("post").setMultipart(
    FormData.create().set("fileField", filePayload)));
```

```python
api_request_context.fetch(
  "https://example.com/api/uploadScript",  method="post",
  multipart={
    "fileField": {
      "name": "f.js",
      "mimeType": "text/javascript",
      "buffer": b"console.log(2022);",
    },
  })
```

```csharp
var file = new FilePayload()
{
    Name = "f.js",
    MimeType = "text/javascript",
    Buffer = System.Text.Encoding.UTF8.GetBytes("console.log(2022);")
};
var multipart = Context.APIRequest.CreateFormData();
multipart.Set("fileField", file);
await Request.FetchAsync("https://example.com/api/uploadScript", new() { Method = "post", Multipart = multipart });
```


### param: APIRequestContext.fetch.urlOrRequest
* since: v1.16
- `urlOrRequest` <[string]|[Request]>

Target URL or Request to get all parameters from.

### option: APIRequestContext.fetch.params = %%-js-fetch-option-params-%%
* since: v1.16

### param: APIRequestContext.fetch.params = %%-java-fetch-params-%%
* since: v1.18

### option: APIRequestContext.fetch.params = %%-python-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.fetch.params = %%-csharp-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.fetch.paramsString = %%-csharp-fetch-option-paramsString-%%
* since: v1.47

### option: APIRequestContext.fetch.method
* since: v1.16
* langs: js, python, csharp
- `method` <[string]>

If set changes the fetch method (e.g. [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) or
[POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST)). If not specified, GET method is used.

### option: APIRequestContext.fetch.headers = %%-js-python-csharp-fetch-option-headers-%%
* since: v1.16

### option: APIRequestContext.fetch.data = %%-js-python-csharp-fetch-option-data-%%
* since: v1.16

### option: APIRequestContext.fetch.form = %%-js-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.fetch.form = %%-python-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.fetch.form = %%-csharp-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.fetch.multipart = %%-js-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.fetch.multipart = %%-python-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.fetch.multipart = %%-csharp-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.fetch.timeout = %%-js-python-csharp-fetch-option-timeout-%%
* since: v1.16

### option: APIRequestContext.fetch.failOnStatusCode = %%-js-python-csharp-fetch-option-failonstatuscode-%%
* since: v1.16

### option: APIRequestContext.fetch.ignoreHTTPSErrors = %%-js-python-csharp-fetch-option-ignorehttpserrors-%%
* since: v1.16

### option: APIRequestContext.fetch.maxRedirects = %%-js-python-csharp-fetch-option-maxredirects-%%
* since: v1.26

### option: APIRequestContext.fetch.maxRetries = %%-js-python-csharp-fetch-option-maxretries-%%
* since: v1.46

## async method: APIRequestContext.get
* since: v1.16
- returns: <[APIResponse]>

Sends HTTP(S) [GET](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/GET) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

**Usage**

Request parameters can be configured with `params` option, they will be serialized into the URL search parameters:

```js
// Passing params as object
await request.get('https://example.com/api/getText', {
  params: {
    'isbn': '1234',
    'page': 23,
  }
});

// Passing params as URLSearchParams
const searchParams = new URLSearchParams();
searchParams.set('isbn', '1234');
searchParams.append('page', 23);
searchParams.append('page', 24);
await request.get('https://example.com/api/getText', { params: searchParams });

// Passing params as string
const queryString = 'isbn=1234&page=23&page=24';
await request.get('https://example.com/api/getText', { params: queryString });
```

```java
request.get("https://example.com/api/getText", RequestOptions.create()
  .setQueryParam("isbn", "1234")
  .setQueryParam("page", 23));
```

```python
query_params = {
  "isbn": "1234",
  "page": "23"
}
api_request_context.get("https://example.com/api/getText", params=query_params)
```

```csharp
var queryParams = new Dictionary<string, object>()
{
  { "isbn", "1234" },
  { "page", 23 },
};
await request.GetAsync("https://example.com/api/getText", new() { Params = queryParams });
```

### param: APIRequestContext.get.url = %%-fetch-param-url-%%
* since: v1.16

### option: APIRequestContext.get.params = %%-js-fetch-option-params-%%
* since: v1.16

### param: APIRequestContext.get.params = %%-java-fetch-params-%%
* since: v1.18

### option: APIRequestContext.get.params = %%-python-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.get.params = %%-csharp-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.get.paramsString = %%-csharp-fetch-option-paramsString-%%
* since: v1.47

### option: APIRequestContext.get.headers = %%-js-python-csharp-fetch-option-headers-%%
* since: v1.16

### option: APIRequestContext.get.data = %%-js-python-csharp-fetch-option-data-%%
* since: v1.26

### option: APIRequestContext.get.form = %%-js-fetch-option-form-%%
* since: v1.26

### option: APIRequestContext.get.form = %%-python-fetch-option-form-%%
* since: v1.26

### option: APIRequestContext.get.form = %%-csharp-fetch-option-form-%%
* since: v1.26

### option: APIRequestContext.get.multipart = %%-js-fetch-option-multipart-%%
* since: v1.26

### option: APIRequestContext.get.multipart = %%-python-fetch-option-multipart-%%
* since: v1.26

### option: APIRequestContext.get.multipart = %%-csharp-fetch-option-multipart-%%
* since: v1.26

### option: APIRequestContext.get.timeout = %%-js-python-csharp-fetch-option-timeout-%%
* since: v1.16

### option: APIRequestContext.get.failOnStatusCode = %%-js-python-csharp-fetch-option-failonstatuscode-%%
* since: v1.16

### option: APIRequestContext.get.ignoreHTTPSErrors = %%-js-python-csharp-fetch-option-ignorehttpserrors-%%
* since: v1.16

### option: APIRequestContext.get.maxRedirects = %%-js-python-csharp-fetch-option-maxredirects-%%
* since: v1.26

### option: APIRequestContext.get.maxRetries = %%-js-python-csharp-fetch-option-maxretries-%%
* since: v1.46

## async method: APIRequestContext.head
* since: v1.16
- returns: <[APIResponse]>

Sends HTTP(S) [HEAD](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/HEAD) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.head.url = %%-fetch-param-url-%%
* since: v1.16

### option: APIRequestContext.head.params = %%-js-fetch-option-params-%%
* since: v1.16

### param: APIRequestContext.head.params = %%-java-fetch-params-%%
* since: v1.18

### option: APIRequestContext.head.params = %%-python-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.head.params = %%-csharp-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.head.paramsString = %%-csharp-fetch-option-paramsString-%%
* since: v1.47

### option: APIRequestContext.head.headers = %%-js-python-csharp-fetch-option-headers-%%
* since: v1.16

### option: APIRequestContext.head.data = %%-js-python-csharp-fetch-option-data-%%
* since: v1.26

### option: APIRequestContext.head.form = %%-python-fetch-option-form-%%
* since: v1.26

### option: APIRequestContext.head.form = %%-js-fetch-option-form-%%
* since: v1.26

### option: APIRequestContext.head.form = %%-csharp-fetch-option-form-%%
* since: v1.26

### option: APIRequestContext.head.multipart = %%-js-fetch-option-multipart-%%
* since: v1.26

### option: APIRequestContext.head.multipart = %%-python-fetch-option-multipart-%%
* since: v1.26

### option: APIRequestContext.head.multipart = %%-csharp-fetch-option-multipart-%%
* since: v1.26

### option: APIRequestContext.head.timeout = %%-js-python-csharp-fetch-option-timeout-%%
* since: v1.16

### option: APIRequestContext.head.failOnStatusCode = %%-js-python-csharp-fetch-option-failonstatuscode-%%
* since: v1.16

### option: APIRequestContext.head.ignoreHTTPSErrors = %%-js-python-csharp-fetch-option-ignorehttpserrors-%%
* since: v1.16

### option: APIRequestContext.head.maxRedirects = %%-js-python-csharp-fetch-option-maxredirects-%%
* since: v1.26

### option: APIRequestContext.head.maxRetries = %%-js-python-csharp-fetch-option-maxretries-%%
* since: v1.46

## async method: APIRequestContext.patch
* since: v1.16
- returns: <[APIResponse]>

Sends HTTP(S) [PATCH](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PATCH) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.patch.url = %%-fetch-param-url-%%
* since: v1.16

### option: APIRequestContext.patch.params = %%-js-fetch-option-params-%%
* since: v1.16

### param: APIRequestContext.patch.params = %%-java-fetch-params-%%
* since: v1.18

### option: APIRequestContext.patch.params = %%-python-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.patch.params = %%-csharp-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.patch.paramsString = %%-csharp-fetch-option-paramsString-%%
* since: v1.47

### option: APIRequestContext.patch.headers = %%-js-python-csharp-fetch-option-headers-%%
* since: v1.16

### option: APIRequestContext.patch.data = %%-js-python-csharp-fetch-option-data-%%
* since: v1.16

### option: APIRequestContext.patch.form = %%-js-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.patch.form = %%-python-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.patch.form = %%-csharp-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.patch.multipart = %%-js-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.patch.multipart = %%-python-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.patch.multipart = %%-csharp-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.patch.timeout = %%-js-python-csharp-fetch-option-timeout-%%
* since: v1.16

### option: APIRequestContext.patch.failOnStatusCode = %%-js-python-csharp-fetch-option-failonstatuscode-%%
* since: v1.16

### option: APIRequestContext.patch.ignoreHTTPSErrors = %%-js-python-csharp-fetch-option-ignorehttpserrors-%%
* since: v1.16

### option: APIRequestContext.patch.maxRedirects = %%-js-python-csharp-fetch-option-maxredirects-%%
* since: v1.26

### option: APIRequestContext.patch.maxRetries = %%-js-python-csharp-fetch-option-maxretries-%%
* since: v1.46

## async method: APIRequestContext.post
* since: v1.16
- returns: <[APIResponse]>

Sends HTTP(S) [POST](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/POST) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

**Usage**

JSON objects can be passed directly to the request:

```js
await request.post('https://example.com/api/createBook', {
  data: {
    title: 'Book Title',
    author: 'John Doe',
  }
});
```

```java
Map<String, Object> data = new HashMap();
data.put("title", "Book Title");
data.put("body", "John Doe");
request.post("https://example.com/api/createBook", RequestOptions.create().setData(data));
```

```python
data = {
    "title": "Book Title",
    "body": "John Doe",
}
api_request_context.post("https://example.com/api/createBook", data=data)
```

```csharp
var data = new Dictionary<string, object>() {
  { "firstName", "John" },
  { "lastName", "Doe" }
};
await request.PostAsync("https://example.com/api/createBook", new() { DataObject = data });
```

To send form data to the server use `form` option. Its value will be encoded into the request body with `application/x-www-form-urlencoded` encoding (see below how to use `multipart/form-data` form encoding to send files):

```js
await request.post('https://example.com/api/findBook', {
  form: {
    title: 'Book Title',
    author: 'John Doe',
  }
});
```

```java
request.post("https://example.com/api/findBook", RequestOptions.create().setForm(
    FormData.create().set("title", "Book Title").set("body", "John Doe")
));
```

```python
formData = {
    "title": "Book Title",
    "body": "John Doe",
}
api_request_context.post("https://example.com/api/findBook", form=formData)
```

```csharp
var formData = Context.APIRequest.CreateFormData();
formData.Set("title", "Book Title");
formData.Set("body", "John Doe");
await request.PostAsync("https://example.com/api/findBook", new() { Form = formData });
```

The common way to send file(s) in the body of a request is to upload them as form fields with `multipart/form-data` encoding. Use [FormData] to construct request body and pass it to the request as `multipart` parameter:

```js
const form = new FormData();
form.set('name', 'John');
form.append('name', 'Doe');
// Send two file fields with the same name.
form.append('file', new File(['console.log(2024);'], 'f1.js', { type: 'text/javascript' }));
form.append('file', new File(['hello'], 'f2.txt', { type: 'text/plain' }));
await request.post('https://example.com/api/uploadForm', {
  multipart: form
});
```

```java
// Pass file path to the form data constructor:
Path file = Paths.get("team.csv");
APIResponse response = request.post("https://example.com/api/uploadTeamList",
  RequestOptions.create().setMultipart(
    FormData.create().set("fileField", file)));

// Or you can pass the file content directly as FilePayload object:
FilePayload filePayload1 = new FilePayload("f1.js", "text/javascript",
      "console.log(2022);".getBytes(StandardCharsets.UTF_8));
APIResponse response = request.post("https://example.com/api/uploadScript",
  RequestOptions.create().setMultipart(
    FormData.create().set("fileField", filePayload)));
```

```python
api_request_context.post(
  "https://example.com/api/uploadScript'",
  multipart={
    "fileField": {
      "name": "f.js",
      "mimeType": "text/javascript",
      "buffer": b"console.log(2022);",
    },
  })
```

```csharp
var file = new FilePayload()
{
    Name = "f.js",
    MimeType = "text/javascript",
    Buffer = System.Text.Encoding.UTF8.GetBytes("console.log(2022);")
};
var multipart = Context.APIRequest.CreateFormData();
multipart.Set("fileField", file);
await request.PostAsync("https://example.com/api/uploadScript", new() { Multipart = multipart });
```

### param: APIRequestContext.post.url = %%-fetch-param-url-%%
* since: v1.16

### option: APIRequestContext.post.params = %%-js-fetch-option-params-%%
* since: v1.16

### param: APIRequestContext.post.params = %%-java-fetch-params-%%
* since: v1.18

### option: APIRequestContext.post.params = %%-python-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.post.params = %%-csharp-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.post.paramsString = %%-csharp-fetch-option-paramsString-%%
* since: v1.47

### option: APIRequestContext.post.headers = %%-js-python-csharp-fetch-option-headers-%%
* since: v1.16

### option: APIRequestContext.post.data = %%-js-python-csharp-fetch-option-data-%%
* since: v1.16

### option: APIRequestContext.post.form = %%-js-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.post.form = %%-python-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.post.form = %%-csharp-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.post.multipart = %%-js-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.post.multipart = %%-python-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.post.multipart = %%-csharp-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.post.timeout = %%-js-python-csharp-fetch-option-timeout-%%
* since: v1.16

### option: APIRequestContext.post.failOnStatusCode = %%-js-python-csharp-fetch-option-failonstatuscode-%%
* since: v1.16

### option: APIRequestContext.post.ignoreHTTPSErrors = %%-js-python-csharp-fetch-option-ignorehttpserrors-%%
* since: v1.16

### option: APIRequestContext.post.maxRedirects = %%-js-python-csharp-fetch-option-maxredirects-%%
* since: v1.26

### option: APIRequestContext.post.maxRetries = %%-js-python-csharp-fetch-option-maxretries-%%
* since: v1.46

## async method: APIRequestContext.put
* since: v1.16
- returns: <[APIResponse]>

Sends HTTP(S) [PUT](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods/PUT) request and returns its response.
The method will populate request cookies from the context and update
context cookies from the response. The method will automatically follow redirects.

### param: APIRequestContext.put.url = %%-fetch-param-url-%%
* since: v1.16

### option: APIRequestContext.put.params = %%-js-fetch-option-params-%%
* since: v1.16

### param: APIRequestContext.put.params = %%-java-fetch-params-%%
* since: v1.18

### option: APIRequestContext.put.params = %%-python-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.put.params = %%-csharp-fetch-option-params-%%
* since: v1.16

### option: APIRequestContext.put.paramsString = %%-csharp-fetch-option-paramsString-%%
* since: v1.47

### option: APIRequestContext.put.headers = %%-js-python-csharp-fetch-option-headers-%%
* since: v1.16

### option: APIRequestContext.put.data = %%-js-python-csharp-fetch-option-data-%%
* since: v1.16

### option: APIRequestContext.put.form = %%-python-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.put.form = %%-js-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.put.form = %%-csharp-fetch-option-form-%%
* since: v1.16

### option: APIRequestContext.put.multipart = %%-js-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.put.multipart = %%-python-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.put.multipart = %%-csharp-fetch-option-multipart-%%
* since: v1.16

### option: APIRequestContext.put.timeout = %%-js-python-csharp-fetch-option-timeout-%%
* since: v1.16

### option: APIRequestContext.put.failOnStatusCode = %%-js-python-csharp-fetch-option-failonstatuscode-%%
* since: v1.16

### option: APIRequestContext.put.ignoreHTTPSErrors = %%-js-python-csharp-fetch-option-ignorehttpserrors-%%
* since: v1.16

### option: APIRequestContext.put.maxRedirects = %%-js-python-csharp-fetch-option-maxredirects-%%
* since: v1.26

### option: APIRequestContext.put.maxRetries = %%-js-python-csharp-fetch-option-maxretries-%%
* since: v1.46

## async method: APIRequestContext.storageState
* since: v1.16
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
* since: v1.16
* langs: java, csharp
- returns: <[string]>

### option: APIRequestContext.storageState.path = %%-storagestate-option-path-%%
* since: v1.16

### option: APIRequestContext.storageState.indexedDB
* since: v1.51
- `indexedDB` ?<boolean>

Set to `true` to include IndexedDB in the storage state snapshot.
