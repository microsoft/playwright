---
id: mock
title: "Mock APIs"
---

Web APIs are usually implemented as HTTP endpoints. Playwright provides APIs to **mock** and **modify** network traffic, both HTTP and HTTPS. Any requests that a page does, including [XHRs](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) and
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) requests, can be tracked, modified and mocked.

## Mock API requests

Following code will intercept all the calls to `https://dog.ceo/api/breeds/list/all` and will return
the test data instead. No requests to the `https://dog.ceo/api/breeds/list/all` endpoint will be made.

Read more about [advanced networking](./network.md).

```js
await page.route('https://dog.ceo/api/breeds/list/all', async route => {
  const json = {
    message: { 'test_breed': [] }
  };
  await route.fulfill({ json });
});
```

```python async
async def handle(route):
    json = { message: { "test_breed": [] } }
    await route.fulfill(json=json)

await page.route("https://dog.ceo/api/breeds/list/all", handle)
```

```python sync
async def handle(route):
    json = { message: { "test_breed": [] } }
    route.fulfill(json=json)

page.route("https://dog.ceo/api/breeds/list/all", handle)
```

```csharp
await page.RouteAsync("https://dog.ceo/api/breeds/list/all", async route =>
{
    var json = /* JsonElement with the test payload */;
    await route.FulfillAsync(new () { Json: json });
});
```

```java
page.route("https://dog.ceo/api/breeds/list/all", route -> {
  route.fulfill(new Route.FulfillOptions()
    .setBody("{\"message\":{\"test_breed\":[]}}"));
});
```

## Modify API responses

Sometimes, it is essential to make an API request, but response needs to be patched to
allow for reproducible testing. In that case, instead of mocking the request, one
can perform the request and fulfill it with the modified response.

Read more about [advanced networking](./network.md).

```js
await page.route('https://dog.ceo/api/breeds/list/all', async route => {
  const response = await route.fetch();
  const json = await response.json();
  json.message['big_red_dog'] = [];
  // Fulfill using the original response, while patching the response body
  // with the given JSON object.
  await route.fulfill({ response, json });
});
```

```python async
async def handle(route):
    response = await route.fulfill()
    json = await response.json()
    json["message"]["big_red_dog"] = []
    # Fulfill using the original response, while patching the response body
    # with the given JSON object.
    await route.fulfill(response=response, json=json)

await page.route("https://dog.ceo/api/breeds/list/all", handle)
```

```python sync
def handle(route):
    response = route.fulfill()
    json = response.json()
    json["message"]["big_red_dog"] = []
    # Fulfill using the original response, while patching the response body
    # with the given JSON object.
    route.fulfill(response=response, json=json)

page.route("https://dog.ceo/api/breeds/list/all", handle)
```

```csharp
await page.RouteAsync("https://dog.ceo/api/breeds/list/all", async route =>
{
    var response = await route.FetchAsync();
    dynamic json = await response.JsonAsync();
    json.message.big_red_dog = new string[] {};
    // Fulfill using the original response, while patching the response body
    // with the given JSON object.
    await route.FulfillAsync(new() { Response = response, Json = json });
});
```

```java
page.route("https://dog.ceo/api/breeds/list/all", route -> {
  APIResponse response = route.fetch();
  JsonObject json = new Gson().fromJson(response.text(), JsonObject.class);
  JsonObject message = json.get("message").getAsJsonObject();
  message.set("big_red_dog", new JsonArray());
  // Fulfill using the original response, while patching the response body
  // with the given JSON object.
  route.fulfill(new Route.FulfillOptions()
    .setResponse(response)
    .setBody(json.toString()));
});
```
