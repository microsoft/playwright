# class: BrowserContext
* extends: [EventEmitter]

BrowserContexts provide a way to operate multiple independent browser sessions.

If a page opens another page, e.g. with a `window.open` call, the popup will belong to the parent page's browser
context.

Playwright allows creation of "incognito" browser contexts with `browser.newContext()` method. "Incognito" browser
contexts don't write any browsing data to disk.

```js
// Create a new incognito browser context
const context = await browser.newContext();
// Create a new page inside context.
const page = await context.newPage();
await page.goto('https://example.com');
// Dispose context once it's no longer needed.
await context.close();
```

```java
// Create a new incognito browser context
BrowserContext context = browser.newContext();
// Create a new page inside context.
Page page = context.newPage();
page.navigate("https://example.com");
// Dispose context once it is no longer needed.
context.close();
```

```python async
# create a new incognito browser context
context = await browser.new_context()
# create a new page inside context.
page = await context.new_page()
await page.goto("https://example.com")
# dispose context once it is no longer needed.
await context.close()
```

```python sync
# create a new incognito browser context
context = browser.new_context()
# create a new page inside context.
page = context.new_page()
page.goto("https://example.com")
# dispose context once it is no longer needed.
context.close()
```

```csharp
using var playwright = await Playwright.CreateAsync();
var browser = await playwright.Firefox.LaunchAsync(new BrowserTypeLaunchOptions { Headless = false });
// Create a new incognito browser context
var context = await browser.NewContextAsync();
// Create a new page inside context.
var page = await context.NewPageAsync();
await page.GotoAsync("https://bing.com");
// Dispose context once it is no longer needed.
await context.CloseAsync();
```

## event: BrowserContext.backgroundPage
* langs: js, python
- argument: <[Page]>

:::note
Only works with Chromium browser's persistent context.
:::

Emitted when new background page is created in the context.


```js
const backgroundPage = await context.waitForEvent('backgroundpage');
```

```python async
background_page = await context.wait_for_event("backgroundpage")
```

```python sync
background_page = context.wait_for_event("backgroundpage")
```

## event: BrowserContext.close
- argument: <[BrowserContext]>

Emitted when Browser context gets closed. This might happen because of one of the following:
* Browser context is closed.
* Browser application is closed or crashed.
* The [`method: Browser.close`] method was called.

## event: BrowserContext.page
- argument: <[Page]>

The event is emitted when a new Page is created in the BrowserContext. The page may still be loading. The event will
also fire for popup pages. See also [`event: Page.popup`] to receive events about popups relevant to a specific page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a
popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is
done and its response has started loading in the popup.

```js
const [newPage] = await Promise.all([
  context.waitForEvent('page'),
  page.click('a[target=_blank]'),
]);
console.log(await newPage.evaluate('location.href'));
```

```java
Page newPage = context.waitForPage(() -> {
  page.click("a[target=_blank]");
});
System.out.println(newPage.evaluate("location.href"));
```

```python async
async with context.expect_page() as page_info:
    await page.click("a[target=_blank]"),
page = await page_info.value
print(await page.evaluate("location.href"))
```

```python sync
with context.expect_page() as page_info:
    page.click("a[target=_blank]"),
page = page_info.value
print(page.evaluate("location.href"))
```

```csharp
var popup = await context.RunAndWaitForPageAsync(async =>
{
    await page.ClickAsync("a");
});
Console.WriteLine(await popup.EvaluateAsync<string>("location.href"));
```

:::note
Use [`method: Page.waitForLoadState`] to wait until the page gets to a particular state (you should not need it in most
cases).
:::

## event: BrowserContext.request
- argument: <[Request]>

Emitted when a request is issued from any pages created through this context.
The [request] object is read-only. To only listen for requests from a particular
page, use [`event: Page.request`].

In order to intercept and mutate requests, see [`method: BrowserContext.route`]
or [`method: Page.route`].

## event: BrowserContext.requestFailed
- argument: <[Request]>

Emitted when a request fails, for example by timing out. To only listen for
failed requests from a particular page, use [`event: Page.requestFailed`].

:::note
HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete
with [`event: BrowserContext.requestFinished`] event and not with [`event: BrowserContext.requestFailed`].
:::

## event: BrowserContext.requestFinished
- argument: <[Request]>

Emitted when a request finishes successfully after downloading the response body. For a successful response, the
sequence of events is `request`, `response` and `requestfinished`. To listen for
successful requests from a particular page, use [`event: Page.requestFinished`].

## event: BrowserContext.response
- argument: <[Response]>

Emitted when [response] status and headers are received for a request. For a successful response, the sequence of events
is `request`, `response` and `requestfinished`. To listen for response events
from a particular page, use [`event: Page.response`].

## event: BrowserContext.serviceWorker
* langs: js, python
- argument: <[Worker]>

:::note
Service workers are only supported on Chromium-based browsers.
:::

Emitted when new service worker is created in the context.

## async method: BrowserContext.addCookies

Adds cookies into this browser context. All pages within this context will have these cookies installed. Cookies can be
obtained via [`method: BrowserContext.cookies`].

```js
await browserContext.addCookies([cookieObject1, cookieObject2]);
```

```java
browserContext.addCookies(Arrays.asList(cookieObject1, cookieObject2));
```

```python async
await browser_context.add_cookies([cookie_object1, cookie_object2])
```

```python sync
browser_context.add_cookies([cookie_object1, cookie_object2])
```

```csharp
await context.AddCookiesAsync(new[] { cookie1, cookie2 });
```

### param: BrowserContext.addCookies.cookies
- `cookies` <[Array]<[Object]>>
  - `name` <[string]>
  - `value` <[string]>
  - `url` <[string]> either url or domain / path are required. Optional.
  - `domain` <[string]> either url or domain / path are required Optional.
  - `path` <[string]> either url or domain / path are required Optional.
  - `expires` <[float]> Unix time in seconds. Optional.
  - `httpOnly` <[boolean]> Optional.
  - `secure` <[boolean]> Optional.
  - `sameSite` <[SameSiteAttribute]<"Strict"|"Lax"|"None">> Optional.

## async method: BrowserContext.addInitScript

Adds a script which would be evaluated in one of the following scenarios:
* Whenever a page is created in the browser context or is navigated.
* Whenever a child frame is attached or navigated in any page in the browser context. In this case, the script is
  evaluated in the context of the newly attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend
the JavaScript environment, e.g. to seed `Math.random`.

An example of overriding `Math.random` before the page loads:

```js browser
// preload.js
Math.random = () => 42;
```

```js
// In your playwright script, assuming the preload.js file is in same directory.
await browserContext.addInitScript({
  path: 'preload.js'
});
```

```java
// In your playwright script, assuming the preload.js file is in same directory.
browserContext.addInitScript(Paths.get("preload.js"));
```

```python async
# in your playwright script, assuming the preload.js file is in same directory.
await browser_context.add_init_script(path="preload.js")
```

```python sync
# in your playwright script, assuming the preload.js file is in same directory.
browser_context.add_init_script(path="preload.js")
```

```csharp
await context.AddInitScriptAsync(new BrowserContextAddInitScriptOptions { ScriptPath = "preload.js" });
```

:::note
The order of evaluation of multiple scripts installed via [`method: BrowserContext.addInitScript`] and
[`method: Page.addInitScript`] is not defined.
:::

### param: BrowserContext.addInitScript.script
* langs: js
- `script` <[function]|[string]|[Object]>
  - `path` <[path]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the
    current working directory. Optional.
  - `content` <[string]> Raw script content. Optional.

Script to be evaluated in all pages in the browser context.

### param: BrowserContext.addInitScript.script
* langs: csharp, java
- `script` <[string]|[path]>

Script to be evaluated in all pages in the browser context.

### param: BrowserContext.addInitScript.arg
* langs: js
- `arg` <[Serializable]>

Optional argument to pass to [`param: script`] (only supported when passing a function).

## method: BrowserContext.backgroundPages
* langs: js, python
- returns: <[Array]<[Page]>>

:::note
Background pages are only supported on Chromium-based browsers.
:::

All existing background pages in the context.

## method: BrowserContext.browser
- returns: <[null]|[Browser]>

Returns the browser instance of the context. If it was launched as a persistent context null gets returned.

## async method: BrowserContext.clearCookies

Clears context cookies.

## async method: BrowserContext.clearPermissions

Clears all permission overrides for the browser context.

```js
const context = await browser.newContext();
await context.grantPermissions(['clipboard-read']);
// do stuff ..
context.clearPermissions();
```

```java
BrowserContext context = browser.newContext();
context.grantPermissions(Arrays.asList("clipboard-read"));
// do stuff ..
context.clearPermissions();
```

```python async
context = await browser.new_context()
await context.grant_permissions(["clipboard-read"])
# do stuff ..
context.clear_permissions()
```

```python sync
context = browser.new_context()
context.grant_permissions(["clipboard-read"])
# do stuff ..
context.clear_permissions()
```

```csharp
var context = await browser.NewContextAsync();
await context.GrantPermissionsAsync(new[] { "clipboard-read" });
// Alternatively, you can use the helper class ContextPermissions 
//  to specify the permissions...
// do stuff ...
await context.ClearPermissionsAsync();
```

## async method: BrowserContext.close

Closes the browser context. All the pages that belong to the browser context will be closed.

:::note
The default browser context cannot be closed.
:::

## async method: BrowserContext.cookies
- returns: <[Array]<[Object]>>
  - `name` <[string]>
  - `value` <[string]>
  - `domain` <[string]>
  - `path` <[string]>
  - `expires` <[float]> Unix time in seconds.
  - `httpOnly` <[boolean]>
  - `secure` <[boolean]>
  - `sameSite` <[SameSiteAttribute]<"Strict"|"Lax"|"None">>

If no URLs are specified, this method returns all cookies. If URLs are specified, only cookies that affect those URLs
are returned.

### param: BrowserContext.cookies.urls
- `urls` <[string]|[Array]<[string]>>

Optional list of URLs.

## async method: BrowserContext.exposeBinding

The method adds a function called [`param: name`] on the `window` object of every frame in every page in the context.
When called, the function executes [`param: callback`] and returns a [Promise] which resolves to the return value of
[`param: callback`]. If the [`param: callback`] returns a [Promise], it will be awaited.

The first argument of the [`param: callback`] function contains information about the caller: `{ browserContext:
BrowserContext, page: Page, frame: Frame }`.

See [`method: Page.exposeBinding`] for page-only version.

An example of exposing page URL to all frames in all pages in the context:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext();
  await context.exposeBinding('pageURL', ({ page }) => page.url());
  const page = await context.newPage();
  await page.setContent(`
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.pageURL();
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
  `);
  await page.click('button');
})();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType webkit = playwright.webkit()
      Browser browser = webkit.launch(new BrowserType.LaunchOptions().setHeadless(false));
      BrowserContext context = browser.newContext();
      context.exposeBinding("pageURL", (source, args) -> source.page().url());
      Page page = context.newPage();
      page.setContent("<script>\n" +
        "  async function onClick() {\n" +
        "    document.querySelector('div').textContent = await window.pageURL();\n" +
        "  }\n" +
        "</script>\n" +
        "<button onclick=\"onClick()\">Click me</button>\n" +
        "<div></div>");
      page.click("button");
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    webkit = playwright.webkit
    browser = await webkit.launch(headless=false)
    context = await browser.new_context()
    await context.expose_binding("pageURL", lambda source: source["page"].url)
    page = await context.new_page()
    await page.set_content("""
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.pageURL();
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
    """)
    await page.click("button")

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    webkit = playwright.webkit
    browser = webkit.launch(headless=false)
    context = browser.new_context()
    context.expose_binding("pageURL", lambda source: source["page"].url)
    page = context.new_page()
    page.set_content("""
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.pageURL();
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
    """)
    page.click("button")

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        var browser = await playwright.Webkit.LaunchAsync(new BrowserTypeLaunchOptions { Headless = false });
        var context = await browser.NewContextAsync();

        await context.ExposeBindingAsync("pageURL", source => source.Page.Url);
        var page = await context.NewPageAsync();
        await page.SetContentAsync("<script>\n" +
        "  async function onClick() {\n" +
        "    document.querySelector('div').textContent = await window.pageURL();\n" +
        "  }\n" +
        "</script>\n" +
        "<button onclick=\"onClick()\">Click me</button>\n" +
        "<div></div>");
        await page.ClickAsync("button");
    }
}
```

An example of passing an element handle:

```js
await context.exposeBinding('clicked', async (source, element) => {
  console.log(await element.textContent());
}, { handle: true });
await page.setContent(`
  <script>
    document.addEventListener('click', event => window.clicked(event.target));
  </script>
  <div>Click me</div>
  <div>Or click me</div>
`);
```

```java
context.exposeBinding("clicked", (source, args) -> {
  ElementHandle element = (ElementHandle) args[0];
  System.out.println(element.textContent());
  return null;
}, new BrowserContext.ExposeBindingOptions().setHandle(true));
page.setContent("" +
  "<script>\n" +
  "  document.addEventListener('click', event => window.clicked(event.target));\n" +
  "</script>\n" +
  "<div>Click me</div>\n" +
  "<div>Or click me</div>\n");
```

```python async
async def print(source, element):
    print(await element.text_content())

await context.expose_binding("clicked", print, handle=true)
await page.set_content("""
  <script>
    document.addEventListener('click', event => window.clicked(event.target));
  </script>
  <div>Click me</div>
  <div>Or click me</div>
""")
```

```python sync
def print(source, element):
    print(element.text_content())

context.expose_binding("clicked", print, handle=true)
page.set_content("""
  <script>
    document.addEventListener('click', event => window.clicked(event.target));
  </script>
  <div>Click me</div>
  <div>Or click me</div>
""")
```

```csharp
var result = new TaskCompletionSource<string>();
var page = await Context.NewPageAsync();
await Context.ExposeBindingAsync("clicked", async (BindingSource _, IJSHandle t) =>
{
    return result.TrySetResult(await t.AsElement().TextContentAsync());
});

await page.SetContentAsync("<script>\n" +
  "  document.addEventListener('click', event => window.clicked(event.target));\n" +
  "</script>\n" +
  "<div>Click me</div>\n" +
  "<div>Or click me</div>\n");

await page.ClickAsync("div");
// Note: it makes sense to await the result here, because otherwise, the context 
//  gets closed and the binding function will throw an exception.
Assert.Equal("Click me", await result.Task);
```

### param: BrowserContext.exposeBinding.name
- `name` <[string]>

Name of the function on the window object.

### param: BrowserContext.exposeBinding.callback
- `callback` <[function]>

Callback function that will be called in the Playwright's context.

### option: BrowserContext.exposeBinding.handle
- `handle` <[boolean]>

Whether to pass the argument as a handle, instead of passing by value. When passing a handle, only one argument is
supported. When passing by value, multiple arguments are supported.

## async method: BrowserContext.exposeFunction

The method adds a function called [`param: name`] on the `window` object of every frame in every page in the context.
When called, the function executes [`param: callback`] and returns a [Promise] which resolves to the return value of
[`param: callback`].

If the [`param: callback`] returns a [Promise], it will be awaited.

See [`method: Page.exposeFunction`] for page-only version.

An example of adding a `sha256` function to all pages in the context:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.
const crypto = require('crypto');

(async () => {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext();
  await context.exposeFunction('sha256', text => crypto.createHash('sha256').update(text).digest('hex'));
  const page = await context.newPage();
  await page.setContent(`
    <script>
      async function onClick() {
        document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');
      }
    </script>
    <button onclick="onClick()">Click me</button>
    <div></div>
  `);
  await page.click('button');
})();
```

```java
import com.microsoft.playwright.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Base64;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType webkit = playwright.webkit()
      Browser browser = webkit.launch(new BrowserType.LaunchOptions().setHeadless(false));
      context.exposeFunction("sha256", args -> {
        String text = (String) args[0];
        MessageDigest crypto;
        try {
          crypto = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
          return null;
        }
        byte[] token = crypto.digest(text.getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(token);
      });
      Page page = context.newPage();
      page.setContent("<script>\n" +
        "  async function onClick() {\n" +
        "    document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');\n" +
        "  }\n" +
        "</script>\n" +
        "<button onclick=\"onClick()\">Click me</button>\n" +
        "<div></div>\n");
      page.click("button");
    }
  }
}
```

```python async
import asyncio
import hashlib
from playwright.async_api import async_playwright

def sha256(text):
    m = hashlib.sha256()
    m.update(bytes(text, "utf8"))
    return m.hexdigest()


async def run(playwright):
    webkit = playwright.webkit
    browser = await webkit.launch(headless=False)
    context = await browser.new_context()
    await context.expose_function("sha256", sha256)
    page = await context.new_page()
    await page.set_content("""
        <script>
          async function onClick() {
            document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');
          }
        </script>
        <button onclick="onClick()">Click me</button>
        <div></div>
    """)
    await page.click("button")

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
import hashlib
from playwright.sync_api import sync_playwright

def sha256(text):
    m = hashlib.sha256()
    m.update(bytes(text, "utf8"))
    return m.hexdigest()


def run(playwright):
    webkit = playwright.webkit
    browser = webkit.launch(headless=False)
    context = browser.new_context()
    context.expose_function("sha256", sha256)
    page = context.new_page()
    page.set_content("""
        <script>
          async function onClick() {
            document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');
          }
        </script>
        <button onclick="onClick()">Click me</button>
        <div></div>
    """)
    page.click("button")

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System;
using System.Security.Cryptography;
using System.Threading.Tasks;

class BrowserContextExamples
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        var browser = await playwright.Webkit.LaunchAsync(new BrowserTypeLaunchOptions { Headless = false });
        var context = await browser.NewContextAsync();

        await context.ExposeFunctionAsync("sha256", (string input) =>
        {
            return Convert.ToBase64String(
                SHA256.Create().ComputeHash(System.Text.Encoding.UTF8.GetBytes(input)));
        });

        var page = await context.NewPageAsync();
        await page.SetContentAsync("<script>\n" +
        "  async function onClick() {\n" +
        "    document.querySelector('div').textContent = await window.sha256('PLAYWRIGHT');\n" +
        "  }\n" +
        "</script>\n" +
        "<button onclick=\"onClick()\">Click me</button>\n" +
        "<div></div>");

        await page.ClickAsync("button");
        Console.WriteLine(await page.TextContentAsync("div"));
    }
}
```

### param: BrowserContext.exposeFunction.name
- `name` <[string]>

Name of the function on the window object.

### param: BrowserContext.exposeFunction.callback
- `callback` <[function]>

Callback function that will be called in the Playwright's context.

## async method: BrowserContext.grantPermissions

Grants specified permissions to the browser context. Only grants corresponding permissions to the given origin if
specified.

### param: BrowserContext.grantPermissions.permissions
- `permissions` <[Array]<[string]>>

A permission or an array of permissions to grant. Permissions can be one of the following values:
* `'geolocation'`
* `'midi'`
* `'midi-sysex'` (system-exclusive midi)
* `'notifications'`
* `'push'`
* `'camera'`
* `'microphone'`
* `'background-sync'`
* `'ambient-light-sensor'`
* `'accelerometer'`
* `'gyroscope'`
* `'magnetometer'`
* `'accessibility-events'`
* `'clipboard-read'`
* `'clipboard-write'`
* `'payment-handler'`

### option: BrowserContext.grantPermissions.origin
- `origin` <[string]>

The [origin] to grant permissions to, e.g. "https://example.com".

## async method: BrowserContext.newCDPSession
* langs: js, python
- returns: <[CDPSession]>

:::note
CDP sessions are only supported on Chromium-based browsers.
:::

Returns the newly created session.

### param: BrowserContext.newCDPSession.page
- `page` <[Page]>

Page to create new session for.

## async method: BrowserContext.newPage
- returns: <[Page]>

Creates a new page in the browser context.

## method: BrowserContext.pages
- returns: <[Array]<[Page]>>

Returns all open pages in the context.

## async method: BrowserContext.route

Routing provides the capability to modify network requests that are made by any page in the browser context. Once route
is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

An example of a naive handler that aborts all image requests:

```js
const context = await browser.newContext();
await context.route('**/*.{png,jpg,jpeg}', route => route.abort());
const page = await context.newPage();
await page.goto('https://example.com');
await browser.close();
```

```java
BrowserContext context = browser.newContext();
context.route("**/*.{png,jpg,jpeg}", route -> route.abort());
Page page = context.newPage();
page.navigate("https://example.com");
browser.close();
```

```python async
context = await browser.new_context()
page = await context.new_page()
await context.route("**/*.{png,jpg,jpeg}", lambda route: route.abort())
await page.goto("https://example.com")
await browser.close()
```

```python sync
context = browser.new_context()
page = context.new_page()
context.route("**/*.{png,jpg,jpeg}", lambda route: route.abort())
page.goto("https://example.com")
browser.close()
```

```csharp
var context = await browser.NewContextAsync();
var page = await context.NewPageAsync();
await context.RouteAsync("**/*.{png,jpg,jpeg}", r => r.AbortAsync());
await page.GotoAsync("https://theverge.com");
await browser.CloseAsync();
```

or the same snippet using a regex pattern instead:

```js
const context = await browser.newContext();
await context.route(/(\.png$)|(\.jpg$)/, route => route.abort());
const page = await context.newPage();
await page.goto('https://example.com');
await browser.close();
```

```java
BrowserContext context = browser.newContext();
context.route(Pattern.compile("(\\.png$)|(\\.jpg$)"), route -> route.abort());
Page page = context.newPage();
page.navigate("https://example.com");
browser.close();
```

```python async
context = await browser.new_context()
page = await context.new_page()
await context.route(re.compile(r"(\.png$)|(\.jpg$)"), lambda route: route.abort())
page = await context.new_page()
await page.goto("https://example.com")
await browser.close()
```

```python sync
context = browser.new_context()
page = context.new_page()
context.route(re.compile(r"(\.png$)|(\.jpg$)"), lambda route: route.abort())
page = await context.new_page()
page = context.new_page()
page.goto("https://example.com")
browser.close()
```

```csharp
var context = await browser.NewContextAsync();
var page = await context.NewPageAsync();
await context.RouteAsync(new Regex("(\\.png$)|(\\.jpg$)"), r => r.AbortAsync());
await page.GotoAsync("https://theverge.com");
await browser.CloseAsync();
```

It is possible to examine the request to decide the route action. For example, mocking all requests that contain some post data, and leaving all other requests as is:

```js
await context.route('/api/**', route => {
  if (route.request().postData().includes('my-string'))
    route.fulfill({ body: 'mocked-data' });
  else
    route.continue();
});
```

```java
context.route("/api/**", route -> {
  if (route.request().postData().contains("my-string"))
    route.fulfill(new Route.FulfillOptions().setBody("mocked-data"));
  else
    route.resume();
});
```

```python async
def handle_route(route):
  if ("my-string" in route.request.post_data)
    route.fulfill(body="mocked-data")
  else
    route.continue_()
await context.route("/api/**", handle_route)
```

```python sync
def handle_route(route):
  if ("my-string" in route.request.post_data)
    route.fulfill(body="mocked-data")
  else
    route.continue_()
context.route("/api/**", handle_route)
```

```csharp
await page.RouteAsync("/api/**", async r =>
{
    if (r.Request.PostData.Contains("my-string"))
        await r.FulfillAsync(body: "mocked-data");
    else
        await r.ContinueAsync();
});
```

Page routes (set up with [`method: Page.route`]) take precedence over browser context routes when request matches both
handlers.

To remove a route with its handler you can use [`method: BrowserContext.unroute`].

:::note
Enabling routing disables http cache.
:::

### param: BrowserContext.route.url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
When a [`option: baseURL`] via the context options was provided and the passed URL is a path,
it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.

### param: BrowserContext.route.handler
* langs: js, python
- `handler` <[function]\([Route], [Request]\)>

handler function to route the request.

### param: BrowserContext.route.handler
* langs: csharp, java
- `handler` <[function]\([Route]\)>

handler function to route the request.

## method: BrowserContext.serviceWorkers
* langs: js, python
- returns: <[Array]<[Worker]>>

:::note
Service workers are only supported on Chromium-based browsers.
:::

All existing service workers in the context.

## method: BrowserContext.setDefaultNavigationTimeout

This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [`method: Page.goBack`]
* [`method: Page.goForward`]
* [`method: Page.goto`]
* [`method: Page.reload`]
* [`method: Page.setContent`]
* [`method: Page.waitForNavigation`]

:::note
[`method: Page.setDefaultNavigationTimeout`] and [`method: Page.setDefaultTimeout`] take priority over
[`method: BrowserContext.setDefaultNavigationTimeout`].
:::

### param: BrowserContext.setDefaultNavigationTimeout.timeout
- `timeout` <[float]>

Maximum navigation time in milliseconds

## method: BrowserContext.setDefaultTimeout

This setting will change the default maximum time for all the methods accepting [`param: timeout`] option.

:::note
[`method: Page.setDefaultNavigationTimeout`], [`method: Page.setDefaultTimeout`] and
[`method: BrowserContext.setDefaultNavigationTimeout`] take priority over [`method: BrowserContext.setDefaultTimeout`].
:::

### param: BrowserContext.setDefaultTimeout.timeout
- `timeout` <[float]>

Maximum time in milliseconds

## async method: BrowserContext.setExtraHTTPHeaders

The extra HTTP headers will be sent with every request initiated by any page in the context. These headers are merged
with page-specific extra HTTP headers set with [`method: Page.setExtraHTTPHeaders`]. If page overrides a particular
header, page-specific header value will be used instead of the browser context header value.

:::note
[`method: BrowserContext.setExtraHTTPHeaders`] does not guarantee the order of headers in the outgoing requests.
:::

### param: BrowserContext.setExtraHTTPHeaders.headers
- `headers` <[Object]<[string], [string]>>

An object containing additional HTTP headers to be sent with every request. All header values must be strings.

## async method: BrowserContext.setGeolocation

Sets the context's geolocation. Passing `null` or `undefined` emulates position unavailable.

```js
await browserContext.setGeolocation({latitude: 59.95, longitude: 30.31667});
```

```java
browserContext.setGeolocation(new Geolocation(59.95, 30.31667));
```

```python async
await browser_context.set_geolocation({"latitude": 59.95, "longitude": 30.31667})
```

```python sync
browser_context.set_geolocation({"latitude": 59.95, "longitude": 30.31667})
```

```csharp
await context.SetGeolocationAsync(new Geolocation()
{
    Latitude = 59.95f,
    Longitude = 30.31667f
});
```

:::note
Consider using [`method: BrowserContext.grantPermissions`] to grant permissions for the browser context pages to read
its geolocation.
:::

### param: BrowserContext.setGeolocation.geolocation
- `geolocation` <[null]|[Object]>
  - `latitude` <[float]> Latitude between -90 and 90.
  - `longitude` <[float]> Longitude between -180 and 180.
  - `accuracy` <[float]> Non-negative accuracy value. Defaults to `0`.

## async method: BrowserContext.setHTTPCredentials
* langs: js

**DEPRECATED** Browsers may cache credentials after successful authentication. Create a new browser context instead.

### param: BrowserContext.setHTTPCredentials.httpCredentials
- `httpCredentials` <[null]|[Object]>
  - `username` <[string]>
  - `password` <[string]>

## async method: BrowserContext.setOffline

### param: BrowserContext.setOffline.offline
- `offline` <[boolean]>

Whether to emulate network being offline for the browser context.

## async method: BrowserContext.storageState
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

Returns storage state for this browser context, contains current cookies and local storage snapshot.

## async method: BrowserContext.storageState
* langs: csharp, java
- returns: <[string]>

### option: BrowserContext.storageState.path
- `path` <[path]>

The file path to save the storage state to. If [`option: path`] is a relative path, then it is resolved relative to
current working directory. If no path is provided, storage
state is still returned, but won't be saved to the disk.

## property: BrowserContext.tracing
- type: <[Tracing]>

## async method: BrowserContext.unroute

Removes a route created with [`method: BrowserContext.route`]. When [`param: handler`] is not specified, removes all
routes for the [`param: url`].

### param: BrowserContext.unroute.url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] used to register a routing with
[`method: BrowserContext.route`].

### param: BrowserContext.unroute.handler
* langs: js, python
- `handler` <[function]\([Route], [Request]\)>

Optional handler function used to register a routing with [`method: BrowserContext.route`].

### param: BrowserContext.unroute.handler
* langs: csharp, java
- `handler` <[function]\([Route]\)>

Optional handler function used to register a routing with [`method: BrowserContext.route`].

## async method: BrowserContext.waitForEvent
* langs: js, python
  - alias-python: expect_event
- returns: <[any]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy
value. Will throw an error if the context closes before the event is fired. Returns the event data value.

```js
const [page, _] = await Promise.all([
  context.waitForEvent('page'),
  page.click('button')
]);
```

```java
Page newPage = context.waitForPage(() -> page.click("button"));
```

```python async
async with context.expect_event("page") as event_info:
    await page.click("button")
page = await event_info.value
```

```python sync
with context.expect_event("page") as event_info:
    page.click("button")
page = event_info.value
```

```csharp
var page = await context.RunAndWaitForPageAsync(async () =>
{
    await page.ClickAsync("button");
});
```

### param: BrowserContext.waitForEvent.event
- `event` <[string]>

Event name, same one would pass into `browserContext.on(event)`.

### param: BrowserContext.waitForEvent.optionsOrPredicate
* langs: js
- `optionsOrPredicate` <[function]|[Object]>
  - `predicate` <[function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[float]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to
    disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

## async method: BrowserContext.waitForPage
* langs: java, python, csharp
  - alias-python: expect_page
  - alias-csharp: RunAndWaitForPage
- returns: <[Page]>

Performs action and waits for a new [Page] to be created in the context. If predicate is provided, it passes
[Page] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the context closes before new [Page] is created.

### option: BrowserContext.waitForPage.predicate =
* langs: csharp, java, python
- `predicate` <[function]\([Page]\):[boolean]>

Receives the [Page] object and resolves to truthy value when the waiting should resolve.

### option: BrowserContext.waitForPage.timeout = %%-wait-for-event-timeout-%%

## async method: BrowserContext.waitForEvent2
* langs: python
  - alias-python: wait_for_event
- returns: <[any]>

:::note
In most cases, you should use [`method: BrowserContext.waitForEvent`].
:::

Waits for given `event` to fire. If predicate is provided, it passes
event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the browser context is closed before the `event` is fired.

### param: BrowserContext.waitForEvent2.event = %%-wait-for-event-event-%%
### option: BrowserContext.waitForEvent2.predicate = %%-wait-for-event-predicate-%%
### option: BrowserContext.waitForEvent2.timeout = %%-wait-for-event-timeout-%%
