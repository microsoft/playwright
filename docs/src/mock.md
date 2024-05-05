---
id: mock
title: "Mock APIs"
---

## Introduction

Web APIs are usually implemented as HTTP endpoints. Playwright provides APIs to **mock** and **modify** network traffic, both HTTP and HTTPS. Any requests that a page does, including [XHRs](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest) and
[fetch](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) requests, can be tracked, modified and mocked. With Playwright you can also mock using HAR files that contain multiple network requests made by the page.

## Mock API requests

The following code will intercept all the calls to `*/**/api/v1/fruits` and will return a custom response instead. No requests to the API will be made. The test goes to the URL that uses the mocked route and asserts that mock data is present on the page.

```js
test("mocks a fruit and doesn't call api", async ({ page }) => {
  // Mock the api call before navigating
  await page.route('*/**/api/v1/fruits', async route => {
    const json = [{ name: 'Strawberry', id: 21 }];
    await route.fulfill({ json });
  });
  // Go to the page
  await page.goto('https://demo.playwright.dev/api-mocking');

  // Assert that the Strawberry fruit is visible
  await expect(page.getByText('Strawberry')).toBeVisible();
});
```

```python async
async def test_mock_the_fruit_api(page: Page):
    async def handle(route: Route):
        json = [{"name": "Strawberry", "id": 21}]
        # fulfill the route with the mock data
        await route.fulfill(json=json)

    # Intercept the route to the fruit API
    await page.route("*/**/api/v1/fruits", handle)

    # Go to the page
    await page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the Strawberry fruit is visible
    await expect(page.get_by_text("Strawberry")).to_be_visible()
```

```python sync
def test_mock_the_fruit_api(page: Page):
    def handle(route: Route):
        json = [{"name": "Strawberry", "id": 21}]
        # fulfill the route with the mock data
        route.fulfill(json=json)

    # Intercept the route to the fruit API
    page.route("*/**/api/v1/fruits", handle)

    # Go to the page
    page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the Strawberry fruit is visible
    expect(page.get_by_text("Strawberry")).to_be_visible()
```

```csharp
// Intercept the route to the fruit API
await page.RouteAsync("*/**/api/v1/fruits", async route => {
  var json = new[] { new { name = "Strawberry", id = 21 } };
  // fulfill the route with the mock data
  await route.FulfillAsync(new()
  {
    Json = json
  });
});

// Go to the page
await page.GotoAsync("https://demo.playwright.dev/api-mocking");

// Assert that the Strawberry fruit is visible
await Expect(page.GetByTextAsync("Strawberry")).ToBeVisibleAsync();
```

```java
// Intercept the route to the fruit API
page.route("https://fruit.ceo/api/breeds/image/random", route -> {
    List<Dictionary<String, Object>> data = new ArrayList<Dictionary<String, Object>>();
    Hashtable<String, Object> dict = new Hashtable<String, Object>();
    dict.put("name", "Strawberry");
    dict.put("id", 21);
    data.add(dict);
  // fulfill the route with the mock data
  route.fulfill(RequestOptions.create().setData(data));
});

// Go to the page
page.navigate("https://demo.playwright.dev/api-mocking");

// Assert that the Strawberry fruit is visible
assertThat(page.getByText("Strawberry")).isVisible();
```

You can see from the trace of the example test that the API was never called, it was however fulfilled with the mock data.
![api mocking trace](https://github.com/microsoft/playwright/assets/13063165/3dc14cbf-c100-4efc-ac21-d7b52d698b53)

Read more about [advanced networking](./network.md).

## Modify API responses

Sometimes, it is essential to make an API request, but the response needs to be patched to
allow for reproducible testing. In that case, instead of mocking the request, one
can perform the request and fulfill it with the modified response.

In the example below we intercept the call to the fruit API and add a new fruit called 'Loquat', to the data. We then go to the url and assert that this data is there:


```js
test('gets the json from api and adds a new fruit', async ({ page }) => {
  // Get the response and add to it
  await page.route('*/**/api/v1/fruits', async route => {
    const response = await route.fetch();
    const json = await response.json();
    json.push({ name: 'Loquat', id: 100 });
    // Fulfill using the original response, while patching the response body
    // with the given JSON object.
    await route.fulfill({ response, json });
  });

  // Go to the page
  await page.goto('https://demo.playwright.dev/api-mocking');

  // Assert that the new fruit is visible
  await expect(page.getByText('Loquat', { exact: true })).toBeVisible();
});
```

```python async
async def test_gets_the_json_from_api_and_adds_a_new_fruit(page: Page):
    async def handle(route: Route):
        response = await route.fetch()
        json = await response.json()
        json.append({ "name": "Loquat", "id": 100})
        # Fulfill using the original response, while patching the response body
        # with the given JSON object.
        await route.fulfill(response=response, json=json)

    await page.route("https://demo.playwright.dev/api-mocking/api/v1/fruits", handle)

    # Go to the page
    await page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the new fruit is visible
    await expect(page.get_by_text("Loquat", exact=True)).to_be_visible()
```

```python sync
def test_gets_the_json_from_api_and_adds_a_new_fruit(page: Page):
    def handle(route: Route):
        response = route.fetch()
        json = response.json()
        json.append({ "name": "Loquat", "id": 100})
        # Fulfill using the original response, while patching the response body
        # with the given JSON object.
        route.fulfill(response=response, json=json)

    page.route("https://demo.playwright.dev/api-mocking/api/v1/fruits", handle)

    # Go to the page
    page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the new fruit is visible
    expect(page.get_by_text("Loquat", exact=True)).to_be_visible()
```

```csharp
await page.RouteAsync("*/**/api/v1/fruits", async (route) => {
    var response = await route.FetchAsync();
    var fruits = await response.JsonAsync<Fruit[]>();
    fruits.Add(new Fruit() { Name = "Loquat", Id = 100 });
    // Fulfill using the original response, while patching the response body
    // with the given JSON object.
    await route.FulfillAsync(new ()
    {
      Response = response,
      Json = fruits
    });
  }
);
// Go to the page
await page.GotoAsync("https://demo.playwright.dev/api-mocking");

// Assert that the Loquat fruit is visible
await Expect(page.GetByTextAsync("Loquat", new () { Exact = true })).ToBeVisibleAsync();
```

```java
page.route("*/**/api/v1/fruits", route -> {
  Response response = route.fetch();
  byte[] json = response.body();
  parsed = new Gson().fromJson(json, JsonObject.class)
  parsed.add(new JsonObject().add("name", "Loquat").add("id", 100));
  // Fulfill using the original response, while patching the response body
  // with the given JSON object.
  route.fulfill(new Route.FulfillOptions().setResponse(response).setBody(json.toString()));
});

// Go to the page
page.goto("https://demo.playwright.dev/api-mocking");

// Assert that the Loquat fruit is visible
assertThat(page.getByText("Loquat", new Page.GetByTextOptions().setExact(true))).isVisible();
```

In the trace of our test we can see that the API was called and the response was modified.
![trace of test showing api being called and fulfilled](https://github.com/microsoft/playwright/assets/13063165/8b8dd82d-1b3e-428e-871b-840581fed439)

By inspecting the response we can see that our new fruit was added to the list.
![trace of test showing the mock response](https://github.com/microsoft/playwright/assets/13063165/03e6c87c-4ecc-47e8-9ca0-30fface25e9d)

Read more about [advanced networking](./network.md).

## Mocking with HAR files

A HAR file is an [HTTP Archive](http://www.softwareishard.com/blog/har-12-spec/) file that contains a record of all the network requests that are made when a page is loaded. It contains information about the request and response headers, cookies, content, timings, and more. You can use HAR files to mock network requests in your tests. You'll need to:

1. Record a HAR file.
1. Commit the HAR file alongside the tests.
1. Route requests using the saved HAR files in the tests.

### Recording a HAR file

To record a HAR file we use [`method: Page.routeFromHAR`] or [`method: BrowserContext.routeFromHAR`] method. This method takes in the path to the HAR file and an optional object of options.
The options object can contain the URL so that only requests with the URL matching the specified glob pattern will be served from the HAR File. If not specified, all requests will be served from the HAR file.

Setting `update` option to true will create or update the HAR file with the actual network information instead of serving the requests from the HAR file. Use it when creating a test to populate the HAR with real data.

```js
test('records or updates the HAR file', async ({ page }) => {
  // Get the response from the HAR file
  await page.routeFromHAR('./hars/fruit.har', {
    url: '*/**/api/v1/fruits',
    update: true,
  });

  // Go to the page
  await page.goto('https://demo.playwright.dev/api-mocking');

  // Assert that the fruit is visible
  await expect(page.getByText('Strawberry')).toBeVisible();
});
```

```python async
async def test_records_or_updates_the_har_file(page: Page):
    # Get the response from the HAR file
    await page.route_from_har("./hars/fruit.har", url="*/**/api/v1/fruits", update=True)

    # Go to the page
    await page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the fruit is visible
    await expect(page.get_by_text("Strawberry")).to_be_visible()
```

```python sync
def test_records_or_updates_the_har_file(page: Page):
    # Get the response from the HAR file
    page.route_from_har("./hars/fruit.har", url="*/**/api/v1/fruits", update=True)

    # Go to the page
    page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the fruit is visible
    expect(page.get_by_text("Strawberry")).to_be_visible()
```

```csharp
// Get the response from the HAR file
await page.RouteFromHARAsync("./hars/fruit.har", new () {
  Url = "*/**/api/v1/fruits",
  Update = true,
});

// Go to the page
await page.GotoAsync("https://demo.playwright.dev/api-mocking");

// Assert that the fruit is visible
await Expect(page.GetByText("Strawberry")).ToBeVisibleAsync();
```

```java
// Get the response from the HAR file
page.routeFromHAR("./hars/fruit.har", new RouteFromHAROptions()
  .setUrl("*/**/api/v1/fruits")
  .setUpdate(true)
);

// Go to the page
page.goto("https://demo.playwright.dev/api-mocking");

// Assert that the fruit is visible
assertThat(page.getByText("Strawberry")).isVisible();
```

### Modifying a HAR file

Once you have recorded a HAR file you can modify it by opening the hashed .txt file inside your 'hars' folder and editing the JSON. This file should be committed to your source control. Anytime you run this test with `update: true` it will update your HAR file with the request from the API.

```json
[
  {
    "name": "Playwright",
    "id": 100
  },
  // ... other fruits
]
```

### Replaying from HAR

Now that you have the HAR file recorded and modified the mock data, it can be used to serve matching responses in the test. For this, just turn off or simply remove the `update` option. This will run the test against the HAR file instead of hitting the API.

```js
test('gets the json from HAR and checks the new fruit has been added', async ({ page }) => {
  // Replay API requests from HAR.
  // Either use a matching response from the HAR,
  // or abort the request if nothing matches.
  await page.routeFromHAR('./hars/fruit.har', {
    url: '*/**/api/v1/fruits',
    update: false,
  });

  // Go to the page
  await page.goto('https://demo.playwright.dev/api-mocking');

  // Assert that the Playwright fruit is visible
  await expect(page.getByText('Playwright', { exact: true })).toBeVisible();
});
```

```python async
async def test_gets_the_json_from_har_and_checks_the_new_fruit_has_been_added(page: Page):
    # Replay API requests from HAR.
    # Either use a matching response from the HAR,
    # or abort the request if nothing matches.
    await page.route_from_har("./hars/fruit.har", url="*/**/api/v1/fruits", update=False)

    # Go to the page
    await page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the Playwright fruit is visible
    await expect(page.get_by_text("Playwright", exact=True)).to_be_visible()
```

```python sync
def test_gets_the_json_from_har_and_checks_the_new_fruit_has_been_added(page: Page):
    # Replay API requests from HAR.
    # Either use a matching response from the HAR,
    # or abort the request if nothing matches.
    page.route_from_har("./hars/fruit.har", url="*/**/api/v1/fruits", update=False)

    # Go to the page
    page.goto("https://demo.playwright.dev/api-mocking")

    # Assert that the Playwright fruit is visible
    expect(page.get_by_text("Playwright", exact=True)).to_be_visible()
```

```csharp
// Replay API requests from HAR.
// Either use a matching response from the HAR,
// or abort the request if nothing matches.
await page.RouteFromHARAsync("./hars/fruit.har", new ()
  {
    Url = "*/**/api/v1/fruits",
    Update = false,
  }
);

// Go to the page
await page.GotoAsync("https://demo.playwright.dev/api-mocking");

// Assert that the Playwright fruit is visible
await page.ExpectByTextAsync("Playwright", new() { Exact = true }).ToBeVisibleAsync();
```

```java
// Replay API requests from HAR.
// Either use a matching response from the HAR,
// or abort the request if nothing matches.
page.routeFromHAR("./hars/fruit.har", new RouteFromHAROptions()
  .setUrl("*/**/api/v1/fruits")
  .setUpdate(false)
);

// Go to the page
page.goto("https://demo.playwright.dev/api-mocking");

// Assert that the Playwright fruit is visible
assertThat(page.getByText("Playwright", new Page.GetByTextOptions().setExact(true))).isVisible();
```
In the trace of our test we can see that the route was fulfilled from the HAR file and the API was not called.
![trace showing the HAR file being used](https://github.com/microsoft/playwright/assets/13063165/1bd7ab66-ea4f-43c2-a4e5-ca17d4837ff1)

If we inspect the response we can see our new fruit was added to the JSON, which was done by manually updating the hashed `.txt` file inside the `hars` folder.
![trace showing response from HAR file](https://github.com/microsoft/playwright/assets/13063165/db3117fc-7b02-4973-9a51-29e213261a6a)

HAR replay matches URL and HTTP method strictly. For POST requests, it also matches POST payloads strictly. If multiple recordings match a request, the one with the most matching headers is picked. An entry resulting in a redirect will be followed automatically.

Similar to when recording, if given HAR file name ends with `.zip`, it is considered an archive containing the HAR file along with network payloads stored as separate entries. You can also extract this archive, edit payloads or HAR log manually and point to the extracted har file. All the payloads will be resolved relative to the extracted har file on the file system.

#### Recording HAR with CLI

We recommend the `update` option to record HAR file for your test. However, you can also record the HAR with Playwright CLI.

Open the browser with Playwright CLI and pass `--save-har` option to produce a HAR file. Optionally, use `--save-har-glob` to only save requests you are interested in, for example API endpoints. If the har file name ends with `.zip`, artifacts are written as separate files and are all compressed into a single `zip`.

```bash js
# Save API requests from example.com as "example.har" archive.
npx playwright open --save-har=example.har --save-har-glob="**/api/**" https://example.com
```

```bash java
# Save API requests from example.com as "example.har" archive.
mvn exec:java -e -D exec.mainClass=com.microsoft.playwright.CLI -D exec.args="open --save-har=example.har --save-har-glob='**/api/**' https://example.com"
```

```bash python
# Save API requests from example.com as "example.har" archive.
playwright open --save-har=example.har --save-har-glob="**/api/**" https://example.com
```

```bash csharp
# Save API requests from example.com as "example.har" archive.
pwsh bin/Debug/netX/playwright.ps1 open --save-har=example.har --save-har-glob="**/api/**" https://example.com
```

Read more about [advanced networking](./network.md).
