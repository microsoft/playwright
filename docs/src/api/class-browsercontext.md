# class: BrowserContext
* since: v1.8
* extends: [EventEmitter]

BrowserContexts provide a way to operate multiple independent browser sessions.

If a page opens another page, e.g. with a `window.open` call, the popup will belong to the parent page's browser
context.

Playwright allows creating "incognito" browser contexts with [`method: Browser.newContext`] method. "Incognito" browser
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
* since: v1.11
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
* since: v1.8
- argument: <[BrowserContext]>

Emitted when Browser context gets closed. This might happen because of one of the following:
* Browser context is closed.
* Browser application is closed or crashed.
* The [`method: Browser.close`] method was called.

## event: BrowserContext.page
* since: v1.8
- argument: <[Page]>

The event is emitted when a new Page is created in the BrowserContext. The page may still be loading. The event will
also fire for popup pages. See also [`event: Page.popup`] to receive events about popups relevant to a specific page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a
popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is
done and its response has started loading in the popup.

```js
const newPagePromise = context.waitForEvent('page');
await page.getByText('open new page').click();
const newPage = await newPagePromise;
console.log(await newPage.evaluate('location.href'));
```

```java
Page newPage = context.waitForPage(() -> {
  page.getByText("open new page").click();
});
System.out.println(newPage.evaluate("location.href"));
```

```python async
async with context.expect_page() as page_info:
    await page.get_by_text("open new page").click(),
page = await page_info.value
print(await page.evaluate("location.href"))
```

```python sync
with context.expect_page() as page_info:
    page.get_by_text("open new page").click(),
page = page_info.value
print(page.evaluate("location.href"))
```

```csharp
var popup = await context.RunAndWaitForPageAsync(async =>
{
    await page.GetByText("open new page").ClickAsync();
});
Console.WriteLine(await popup.EvaluateAsync<string>("location.href"));
```

:::note
Use [`method: Page.waitForLoadState`] to wait until the page gets to a particular state (you should not need it in most
cases).
:::

## event: BrowserContext.request
* since: v1.12
- argument: <[Request]>

Emitted when a request is issued from any pages created through this context.
The [request] object is read-only. To only listen for requests from a particular
page, use [`event: Page.request`].

In order to intercept and mutate requests, see [`method: BrowserContext.route`]
or [`method: Page.route`].

## event: BrowserContext.requestFailed
* since: v1.12
- argument: <[Request]>

Emitted when a request fails, for example by timing out. To only listen for
failed requests from a particular page, use [`event: Page.requestFailed`].

:::note
HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete
with [`event: BrowserContext.requestFinished`] event and not with [`event: BrowserContext.requestFailed`].
:::

## event: BrowserContext.requestFinished
* since: v1.12
- argument: <[Request]>

Emitted when a request finishes successfully after downloading the response body. For a successful response, the
sequence of events is `request`, `response` and `requestfinished`. To listen for
successful requests from a particular page, use [`event: Page.requestFinished`].

## event: BrowserContext.response
* since: v1.12
- argument: <[Response]>

Emitted when [response] status and headers are received for a request. For a successful response, the sequence of events
is `request`, `response` and `requestfinished`. To listen for response events
from a particular page, use [`event: Page.response`].

## event: BrowserContext.serviceWorker
* since: v1.11
* langs: js, python
- argument: <[Worker]>

:::note
Service workers are only supported on Chromium-based browsers.
:::

Emitted when new service worker is created in the context.

## async method: BrowserContext.addCookies
* since: v1.8

Adds cookies into this browser context. All pages within this context will have these cookies installed. Cookies can be
obtained via [`method: BrowserContext.cookies`].

**Usage**

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
* since: v1.8
- `cookies` <[Array]<[Object]>>
  - `name` <[string]>
  - `value` <[string]>
  - `url` ?<[string]> either url or domain / path are required. Optional.
  - `domain` ?<[string]> either url or domain / path are required Optional.
  - `path` ?<[string]> either url or domain / path are required Optional.
  - `expires` ?<[float]> Unix time in seconds. Optional.
  - `httpOnly` ?<[boolean]> Optional.
  - `secure` ?<[boolean]> Optional.
  - `sameSite` ?<[SameSiteAttribute]<"Strict"|"Lax"|"None">> Optional.

## async method: BrowserContext.addInitScript
* since: v1.8

Adds a script which would be evaluated in one of the following scenarios:
* Whenever a page is created in the browser context or is navigated.
* Whenever a child frame is attached or navigated in any page in the browser context. In this case, the script is
  evaluated in the context of the newly attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend
the JavaScript environment, e.g. to seed `Math.random`.

**Usage**

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
* since: v1.8
* langs: js
- `script` <[function]|[string]|[Object]>
  - `path` ?<[path]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the
    current working directory. Optional.
  - `content` ?<[string]> Raw script content. Optional.

Script to be evaluated in all pages in the browser context.

### param: BrowserContext.addInitScript.script
* since: v1.8
* langs: csharp, java
- `script` <[string]|[path]>

Script to be evaluated in all pages in the browser context.

### param: BrowserContext.addInitScript.arg
* since: v1.8
* langs: js
- `arg` ?<[Serializable]>

Optional argument to pass to [`param: script`] (only supported when passing a function).

### param: BrowserContext.addInitScript.path
* since: v1.8
* langs: python
- `path` ?<[path]>

Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the current working directory. Optional.

### param: BrowserContext.addInitScript.script
* since: v1.8
* langs: python
- `script` ?<[string]>

Script to be evaluated in all pages in the browser context. Optional.

## method: BrowserContext.backgroundPages
* since: v1.11
* langs: js, python
- returns: <[Array]<[Page]>>

:::note
Background pages are only supported on Chromium-based browsers.
:::

All existing background pages in the context.

## method: BrowserContext.browser
* since: v1.8
- returns: <[null]|[Browser]>

Returns the browser instance of the context. If it was launched as a persistent context null gets returned.

## async method: BrowserContext.clearCookies
* since: v1.8

Clears context cookies.

## async method: BrowserContext.clearPermissions
* since: v1.8

Clears all permission overrides for the browser context.

**Usage**

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
* since: v1.8

Closes the browser context. All the pages that belong to the browser context will be closed.

:::note
The default browser context cannot be closed.
:::

## async method: BrowserContext.cookies
* since: v1.8
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
* since: v1.8
- `urls` ?<[string]|[Array]<[string]>>

Optional list of URLs.

## async method: BrowserContext.exposeBinding
* since: v1.8

The method adds a function called [`param: name`] on the `window` object of every frame in every page in the context.
When called, the function executes [`param: callback`] and returns a [Promise] which resolves to the return value of
[`param: callback`]. If the [`param: callback`] returns a [Promise], it will be awaited.

The first argument of the [`param: callback`] function contains information about the caller: `{ browserContext:
BrowserContext, page: Page, frame: Frame }`.

See [`method: Page.exposeBinding`] for page-only version.

**Usage**

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
  await page.getByRole('button').click();
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
      page.getByRole(AriaRole.BUTTON).click();
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
    await page.get_by_role("button").click()

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
    page.get_by_role("button").click()

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;

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
await page.GetByRole(AriaRole.Button).ClickAsync();
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
Assert.AreEqual("Click me", await result.Task);
```

### param: BrowserContext.exposeBinding.name
* since: v1.8
- `name` <[string]>

Name of the function on the window object.

### param: BrowserContext.exposeBinding.callback
* since: v1.8
- `callback` <[function]>

Callback function that will be called in the Playwright's context.

### option: BrowserContext.exposeBinding.handle
* since: v1.8
- `handle` <[boolean]>

Whether to pass the argument as a handle, instead of passing by value. When passing a handle, only one argument is
supported. When passing by value, multiple arguments are supported.

## async method: BrowserContext.exposeFunction
* since: v1.8

The method adds a function called [`param: name`] on the `window` object of every frame in every page in the context.
When called, the function executes [`param: callback`] and returns a [Promise] which resolves to the return value of
[`param: callback`].

If the [`param: callback`] returns a [Promise], it will be awaited.

See [`method: Page.exposeFunction`] for page-only version.

**Usage**

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
  await page.getByRole('button').click();
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
      page.getByRole(AriaRole.BUTTON).click();
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
    await page.get_by_role("button").click()

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
    page.get_by_role("button").click()

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

        await page.GetByRole(AriaRole.Button).ClickAsync();
        Console.WriteLine(await page.TextContentAsync("div"));
    }
}
```

### param: BrowserContext.exposeFunction.name
* since: v1.8
- `name` <[string]>

Name of the function on the window object.

### param: BrowserContext.exposeFunction.callback
* since: v1.8
- `callback` <[function]>

Callback function that will be called in the Playwright's context.

## async method: BrowserContext.grantPermissions
* since: v1.8

Grants specified permissions to the browser context. Only grants corresponding permissions to the given origin if
specified.

### param: BrowserContext.grantPermissions.permissions
* since: v1.8
- `permissions` <[Array]<[string]>>

A permission or an array of permissions to grant. Permissions can be one of the following values:
* `'geolocation'`
* `'midi'`
* `'midi-sysex'` (system-exclusive midi)
* `'notifications'`
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
* since: v1.8
- `origin` <[string]>

The [origin] to grant permissions to, e.g. "https://example.com".

## async method: BrowserContext.newCDPSession
* since: v1.11
* langs: js, python, csharp
- returns: <[CDPSession]>

:::note
CDP sessions are only supported on Chromium-based browsers.
:::

Returns the newly created session.

### param: BrowserContext.newCDPSession.page
* since: v1.11
- `page` <[Page]|[Frame]>

Target to create new session for. For backwards-compatibility, this parameter is
named `page`, but it can be a `Page` or `Frame` type.

## async method: BrowserContext.newPage
* since: v1.8
- returns: <[Page]>

Creates a new page in the browser context.

## method: BrowserContext.pages
* since: v1.8
- returns: <[Array]<[Page]>>

Returns all open pages in the context.

## property: BrowserContext.request
* since: v1.16
* langs:
  - alias-csharp: APIRequest
- type: <[APIRequestContext]>

API testing helper associated with this context. Requests made with this API will use context cookies.

## async method: BrowserContext.route
* since: v1.8

Routing provides the capability to modify network requests that are made by any page in the browser context. Once route
is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

:::note
[`method: BrowserContext.route`] will not intercept requests intercepted by Service Worker. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [`option: Browser.newContext.serviceWorkers`] to `'block'`.
:::

**Usage**

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
* since: v1.8
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while routing.
When a [`option: baseURL`] via the context options was provided and the passed URL is a path,
it gets merged via the [`new URL()`](https://developer.mozilla.org/en-US/docs/Web/API/URL/URL) constructor.

### param: BrowserContext.route.handler
* since: v1.8
* langs: js, python
- `handler` <[function]\([Route], [Request]\): [Promise<any>|any]>

handler function to route the request.

### param: BrowserContext.route.handler
* since: v1.8
* langs: csharp, java
- `handler` <[function]\([Route]\)>

handler function to route the request.

### option: BrowserContext.route.times
* since: v1.15
- `times` <[int]>

How often a route should be used. By default it will be used every time.

## async method: BrowserContext.routeFromHAR
* since: v1.23

If specified the network requests that are made in the context will be served from the HAR file. Read more about [Replaying from HAR](../network.md#replaying-from-har).

Playwright will not serve requests intercepted by Service Worker from the HAR file. See [this](https://github.com/microsoft/playwright/issues/1090) issue. We recommend disabling Service Workers when using request interception by setting [`option: Browser.newContext.serviceWorkers`] to `'block'`.

### param: BrowserContext.routeFromHAR.har
* since: v1.23
- `har` <[path]>

Path to a [HAR](http://www.softwareishard.com/blog/har-12-spec) file with prerecorded network data. If `path` is a relative path, then it is resolved relative to the current working directory.

### option: BrowserContext.routeFromHAR.notFound
* since: v1.23
- `notFound` ?<[HarNotFound]<"abort"|"fallback">>
* If set to 'abort' any request not found in the HAR file will be aborted.
* If set to 'fallback' falls through to the next route handler in the handler chain.

Defaults to abort.

### option: BrowserContext.routeFromHAR.update
* since: v1.23
- `update` ?<boolean>

If specified, updates the given HAR with the actual network information instead of serving from file. The file is written to disk when [`method: BrowserContext.close`] is called.

### option: BrowserContext.routeFromHAR.url
* since: v1.23
- `url` <[string]|[RegExp]>

A glob pattern, regular expression or predicate to match the request URL. Only requests with URL matching the pattern will be served from the HAR file. If not specified, all requests are served from the HAR file.

## method: BrowserContext.serviceWorkers
* since: v1.11
* langs: js, python
- returns: <[Array]<[Worker]>>

:::note
Service workers are only supported on Chromium-based browsers.
:::

All existing service workers in the context.

## method: BrowserContext.setDefaultNavigationTimeout
* since: v1.8

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
* since: v1.8
- `timeout` <[float]>

Maximum navigation time in milliseconds

## method: BrowserContext.setDefaultTimeout
* since: v1.8

This setting will change the default maximum time for all the methods accepting [`param: timeout`] option.

:::note
[`method: Page.setDefaultNavigationTimeout`], [`method: Page.setDefaultTimeout`] and
[`method: BrowserContext.setDefaultNavigationTimeout`] take priority over [`method: BrowserContext.setDefaultTimeout`].
:::

### param: BrowserContext.setDefaultTimeout.timeout
* since: v1.8
- `timeout` <[float]>

Maximum time in milliseconds

## async method: BrowserContext.setExtraHTTPHeaders
* since: v1.8

The extra HTTP headers will be sent with every request initiated by any page in the context. These headers are merged
with page-specific extra HTTP headers set with [`method: Page.setExtraHTTPHeaders`]. If page overrides a particular
header, page-specific header value will be used instead of the browser context header value.

:::note
[`method: BrowserContext.setExtraHTTPHeaders`] does not guarantee the order of headers in the outgoing requests.
:::

### param: BrowserContext.setExtraHTTPHeaders.headers
* since: v1.8
- `headers` <[Object]<[string], [string]>>

An object containing additional HTTP headers to be sent with every request. All header values must be strings.

## async method: BrowserContext.setGeolocation
* since: v1.8

Sets the context's geolocation. Passing `null` or `undefined` emulates position unavailable.

**Usage**

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
* since: v1.8
- `geolocation` <[null]|[Object]>
  - `latitude` <[float]> Latitude between -90 and 90.
  - `longitude` <[float]> Longitude between -180 and 180.
  - `accuracy` ?<[float]> Non-negative accuracy value. Defaults to `0`.

## async method: BrowserContext.setHTTPCredentials
* since: v1.8
* langs: js
* deprecated: Browsers may cache credentials after successful authentication. Create a new browser context instead.

### param: BrowserContext.setHTTPCredentials.httpCredentials
* since: v1.8
- `httpCredentials` <[null]|[Object]>
  - `username` <[string]>
  - `password` <[string]>

## async method: BrowserContext.setOffline
* since: v1.8

### param: BrowserContext.setOffline.offline
* since: v1.8
- `offline` <[boolean]>

Whether to emulate network being offline for the browser context.

## async method: BrowserContext.storageState
* since: v1.8
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
* since: v1.8
* langs: csharp, java
- returns: <[string]>

### option: BrowserContext.storageState.path = %%-storagestate-option-path-%%
* since: v1.8

## property: BrowserContext.tracing
* since: v1.12
- type: <[Tracing]>

## async method: BrowserContext.unroute
* since: v1.8

Removes a route created with [`method: BrowserContext.route`]. When [`param: handler`] is not specified, removes all
routes for the [`param: url`].

### param: BrowserContext.unroute.url
* since: v1.8
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] used to register a routing with
[`method: BrowserContext.route`].

### param: BrowserContext.unroute.handler
* since: v1.8
* langs: js, python
- `handler` ?<[function]\([Route], [Request]\): [Promise<any>|any]>

Optional handler function used to register a routing with [`method: BrowserContext.route`].

### param: BrowserContext.unroute.handler
* since: v1.8
* langs: csharp, java
- `handler` ?<[function]\([Route]\)>

Optional handler function used to register a routing with [`method: BrowserContext.route`].

## async method: BrowserContext.waitForEvent
* since: v1.8
* langs: js, python
  - alias-python: expect_event
- returns: <[any]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy
value. Will throw an error if the context closes before the event is fired. Returns the event data value.

**Usage**

```js
const pagePromise = context.waitForEvent('page');
await page.getByRole('button').click();
const page = await pagePromise;
```

```java
Page newPage = context.waitForPage(() -> page.getByRole(AriaRole.BUTTON).click());
```

```python async
async with context.expect_event("page") as event_info:
    await page.get_by_role("button").click()
page = await event_info.value
```

```python sync
with context.expect_event("page") as event_info:
    page.get_by_role("button").click()
page = event_info.value
```

```csharp
var page = await context.RunAndWaitForPageAsync(async () =>
{
    await page.GetByRole(AriaRole.Button).ClickAsync();
});
```

## async method: BrowserContext.waitForEvent
* since: v1.8
* langs: python
- returns: <[EventContextManager]>

### param: BrowserContext.waitForEvent.event
* since: v1.8
- `event` <[string]>

Event name, same one would pass into `browserContext.on(event)`.

### param: BrowserContext.waitForEvent.optionsOrPredicate
* since: v1.8
* langs: js
- `optionsOrPredicate` ?<[function]|[Object]>
  - `predicate` <[function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` ?<[float]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to
    disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

### option: BrowserContext.waitForEvent.predicate = %%-wait-for-event-predicate-%%
* since: v1.8

### option: BrowserContext.waitForEvent.timeout = %%-wait-for-event-timeout-%%
* since: v1.8

## async method: BrowserContext.waitForPage
* since: v1.9
* langs: java, python, csharp
  - alias-python: expect_page
  - alias-csharp: RunAndWaitForPage
- returns: <[Page]>

Performs action and waits for a new [Page] to be created in the context. If predicate is provided, it passes
[Page] value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the context closes before new [Page] is created.

## async method: BrowserContext.waitForPage
* since: v1.9
* langs: python
- returns: <[EventContextManager]<[Page]>>

### param: BrowserContext.waitForPage.action = %%-csharp-wait-for-event-action-%%
* since: v1.12

### option: BrowserContext.waitForPage.predicate
* since: v1.9
* langs: csharp, java, python
- `predicate` <[function]\([Page]\):[boolean]>

Receives the [Page] object and resolves to truthy value when the waiting should resolve.

### option: BrowserContext.waitForPage.timeout = %%-wait-for-event-timeout-%%
* since: v1.9

### param: BrowserContext.waitForPage.callback = %%-java-wait-for-event-callback-%%
* since: v1.9

## async method: BrowserContext.waitForEvent2
* since: v1.8
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
* since: v1.8

### option: BrowserContext.waitForEvent2.predicate = %%-wait-for-event-predicate-%%
* since: v1.8

### option: BrowserContext.waitForEvent2.timeout = %%-wait-for-event-timeout-%%
* since: v1.8
