---
id: mock
title: "Mock APIs"
---

## Introduction

Web APIs are usually implemented as HTTP endpoints. Playwright provides APIs to **mock** and **modify** network traffic, both HTTP and HTTPS. Any requests that a page does, including [XHRs](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) and
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) requests, can be tracked, modified and mocked.

## Mock API requests

The following code will intercept all the calls to `https://dog.ceo/api/breeds/list/all` and will return
the test data instead. No requests to the `https://dog.ceo/api/breeds/list/all` endpoint will be made.

```js
await page.route("https://dog.ceo/api/breeds/list/all", async (route) => {
  const json = {
    message: { playwright_dog: [] },
  };
  await route.fulfill({ json });
});
```

```python async
async def handle(route):
    json = { message: { "playwright_dog": [] } }
    await route.fulfill(json=json)

await page.route("https://dog.ceo/api/breeds/list/all", handle)
```

```python sync
async def handle(route):
    json = { message: { "playwright_dog": [] } }
    route.fulfill(json=json)

page.route("https://dog.ceo/api/breeds/list/all", handle)
```

```csharp
await page.RouteAsync("https://dog.ceo/api/breeds/list/all", async route =>
{
    var json = new { message = new { playwright_dog = new List<string>() } };
    await route.FulfillAsync(new () { Json: json });
});
```

```java
page.route("https://dog.ceo/api/breeds/list/all", route -> {
  route.fulfill(new Route.FulfillOptions()
    .setBody("{\"message\":{\"playwright_dog\":[]}}"));
});
```

In the example below we intercept the route to the dog API and return a custom response. We then go to that url and assert that the response is our mock data:

```js
test("mocks the dog api", async ({ page }) => {
  await page.route("https://dog.ceo/api/breeds/list/all", async (route) => {
    const json = {
      message: { playwright_dog: [] },
    };
    await route.fulfill({ json });
  });
  await page.goto("https://dog.ceo/api/breeds/list/all");

  await expect(page.getByText("playwright_dog")).toBeVisible();
});
```

```python async
async def test_mock_the_dog_api(page):
    await page.route('https://dog.ceo/api/breeds/list/all', async (route) => {
        json = { message: { "playwright_dog": [] } }
        await route.fulfill(json=json)
    })
    await page.goto('https://dog.ceo/api/breeds/list/all')

    await page.expect_to_be_visible('playwright_dog')
```

```python sync
def test_mock_the_dog_api(page):
    page.route('https://dog.ceo/api/breeds/list/all', lambda route: {
        json = { message: { "playwright_dog": [] } }
        route.fulfill(json=json)
    })
    page.goto('https://dog.ceo/api/breeds/list/all')

    page.expect_to_be_visible('playwright_dog')
```

```csharp
await page.RouteAsync("https://dog.ceo/api/breeds/list/all", async route =>
{
  var json = new { message = new { playwright_dog = new List<string>() } };
  await route.FulfillAsync(new RouteFulfillResponse
  {
    Json = json
  });
});

await page.GotoAsync("https://dog.ceo/api/breeds/list/all");

await Expect(page.GetByText("playwright_dog")).ToBeVisibleAsync();
```

```java
page.route("https://dog.ceo/api/breeds/list/all", route -> {
  var json = new HashMap<String, Object>();
  json.put("message", new HashMap<String, Object>() {{
    put("playwright_dog", new ArrayList<String>());
  }});
  route.fulfill(new Route.FulfillOptions()
    .setJsonBody(json));
});

page.goto("https://dog.ceo/api/breeds/list/all");

assertThat(page.getByText("playwright_dog")).isVisible();
```

Read more about [advanced networking](./network.md).

## Modify API responses

Sometimes, it is essential to make an API request, but the response needs to be patched to
allow for reproducible testing. In that case, instead of mocking the request, one
can perform the request and fulfill it with the modified response.

```js
await page.route("https://dog.ceo/api/breeds/list/all", async (route) => {
  const response = await route.fetch();
  const json = await response.json();
  json.message["playwright_dog"] = [];
  // Fulfill using the original response, while patching the response body
  // with the given JSON object.
  await route.fulfill({ response, json });
});
```

```python async
async def handle(route):
    response = await route.fulfill()
    json = await response.json()
    json["message"]["playwright_dog"] = []
    # Fulfill using the original response, while patching the response body
    # with the given JSON object.
    await route.fulfill(response=response, json=json)

await page.route("https://dog.ceo/api/breeds/list/all", handle)
```

```python sync
def handle(route):
    response = route.fulfill()
    json = response.json()
    json["message"]["playwright_dog"] = []
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
    json.message.playwright_dog = new string[] {};
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
  message.set("playwright_dog", new JsonArray());
  // Fulfill using the original response, while patching the response body
  // with the given JSON object.
  route.fulfill(new Route.FulfillOptions()
    .setResponse(response)
    .setBody(json.toString()));
});
```

In the example below we intercept the call to the dog API and add a new breed of dog, 'playwright_dog', to the data. We then go to the url and assert that this data is there:

```js
test("intercept the dog api and add some data to it", async ({ page }) => {
  await page.route("https://dog.ceo/api/breeds/list/all", async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    json.message["playwright_dog"] = [];

    await route.fulfill({ response, json });
  });
  await page.goto("https://dog.ceo/api/breeds/list/all");

  await expect(page.getByText("playwright_dog")).toBeVisible();
});
```

```python async
async def test_intercept_the_dog_api_and_add_some_data_to_it(page):
    await page.route('https://dog.ceo/api/breeds/list/all', async (route) => {
        response = await route.fulfill()
        json = await response.json()
        json["message"]["playwright_dog"] = []

        await route.fulfill(response=response, json=json)
    })
    await page.goto('https://dog.ceo/api/breeds/list/all')

    await page.expect_to_be_visible('playwright_dog')
```

```python sync
def test_intercept_the_dog_api_and_add_some_data_to_it(page):
    page.route('https://dog.ceo/api/breeds/list/all', lambda route: {
        response = route.fulfill()
        json = response.json()
        json["message"]["playwright_dog"] = []

        route.fulfill(response=response, json=json)
    })
    page.goto('https://dog.ceo/api/breeds/list/all')

    page.expect_to_be_visible('playwright_dog')
```

```csharp
await page.RouteAsync("https://dog.ceo/api/breeds/list/all", async route =>
{
  var response = await route.FetchAsync();
  dynamic json = await response.JsonAsync();
  json.message.playwright_dog = new string[] {};

  await route.FulfillAsync(new() { Response = response, Json = json });
});
await page.GotoAsync("https://dog.ceo/api/breeds/list/all");
await Expect(page.GetByText("playwright_dog")).ToBeVisibleAsync();
```

```java
page.route("https://dog.ceo/api/breeds/list/all", route -> {
  APIResponse response = route.fetch();
  JsonObject json = new Gson().fromJson(response.text(), JsonObject.class);
  JsonObject message = json.get("message").getAsJsonObject();
  message.set("playwright_dog", new JsonArray());

  route.fulfill(new Route.FulfillOptions()
    .setResponse(response)
    .setBody(json.toString()));
});
page.navigate("https://dog.ceo/api/breeds/list/all");

assertThat(page.getByText("playwright_dog")).isVisible();
```

Read more about [advanced networking](./network.md).
