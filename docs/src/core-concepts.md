---
id: core-concepts
title: "Core concepts"
---

Playwright provides a set of APIs to automate Chromium, Firefox and WebKit
browsers. By using the Playwright API, you can write scripts to create
new browser pages, navigate to URLs and then interact with elements on a page.

Along with a test runner Playwright can be used to automate user interactions to
validate and test web applications. The Playwright API enables this through
the following primitives.

<!-- TOC -->

<br/>

## Browser

A [Browser] refers to an instance of Chromium, Firefox
or WebKit. Playwright scripts generally start with launching a browser instance
and end with closing the browser. Browser instances can be launched in headless
(without a GUI) or headed mode.

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

const browser = await chromium.launch({ headless: false });
await browser.close();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      Browser browser = chromium.launch(new BrowserType.LaunchOptions().setHeadless(false));
      browser.close();
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=False)
        await browser.close()

asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    browser.close()
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class Program
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var firefox = playwright.Firefox.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless = false
        });
    }
}
```

Launching a browser instance can be expensive, and Playwright is designed to
maximize what a single instance can do through multiple browser contexts.

### API reference

- [Browser]

<br/>

## Browser contexts

A [BrowserContext] is an isolated incognito-alike
session within a browser instance. Browser contexts are fast and cheap to create.
We recommend running each test scenario in its own new Browser context, so that
the browser state is isolated between the tests.

```js
const browser = await chromium.launch();
const context = await browser.newContext();
```

```java
Browser browser = chromium.launch();
BrowserContext context = browser.newContext();
```

```python async
browser = await playwright.chromium.launch()
context = await browser.new_context()
```

```python sync
browser = playwright.chromium.launch()
context = browser.new_context()
```

```csharp
await using var browser = playwright.Chromium.LaunchAsync();
var context = await browser.NewContextAsync();
```

Browser contexts can also be used to emulate multi-page scenarios involving
mobile devices, permissions, locale and color scheme.

```js
const { devices } = require('playwright');
const iPhone = devices['iPhone 11 Pro'];

const context = await browser.newContext({
  ...iPhone,
  permissions: ['geolocation'],
  geolocation: { latitude: 52.52, longitude: 13.39},
  colorScheme: 'dark',
  locale: 'de-DE'
});
```

```java
// FIXME
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType devices = playwright.devices();
      BrowserContext context = browser.newContext(new Browser.NewContextOptions()
        .setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 12_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0 Mobile/15E148 Safari/604.1")
        .setViewportSize(375, 812)
        .setDeviceScaleFactor(3)
        .setIsMobile(true)
        .setHasTouch(true)
        .setPermissions(Arrays.asList("geolocation"))
        .setGeolocation(52.52, 13.39)
        .setColorScheme(ColorScheme.DARK)
        .setLocale("de-DE"));
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        iphone_11 = p.devices['iPhone 11 Pro']
        browser = await p.chromium.launch()
        context = await browser.new_context(
            **iphone_11,
            locale='de-DE',
            geolocation={ 'longitude': 12.492507, 'latitude': 41.889938 },
            permissions=['geolocation'],
            color_scheme='dark',
        )
        page = await browser.new_page()
        await browser.close()

asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    iphone_11 = p.devices['iPhone 11 Pro']
    browser = p.webkit.launch(headless=False)
    context = browser.new_context(
        **iphone_11,
        locale='de-DE',
        geolocation={ 'longitude': 12.492507, 'latitude': 41.889938 },
        permissions=['geolocation']
    )
    browser.close()
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class PlaywrightExample
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Webkit.LaunchAsync();
        var options = new BrowserContextNewOptions(Playwright.Devices["iPhone 11 Pro"])
        {
            Geolocation = new Geolocation() { Longitude = 12.492507f, Latitude = 41.889938f },
            Permissions = new[] { "geolocation" },
            Locale = "de-DE"
        };

        await using var context = await browser.NewContextAsync(options);
        // do work

    }
}
```

### API reference

- [BrowserContext]
- [`method: Browser.newContext`]

<br/>

## Pages and frames

A Browser context can have multiple pages. A [Page]
refers to a single tab or a popup window within a browser context. It should be used to navigate to URLs and interact with the page content.

```js
// Create a page.
const page = await context.newPage();

// Navigate explicitly, similar to entering a URL in the browser.
await page.goto('http://example.com');
// Fill an input.
await page.fill('#search', 'query');

// Navigate implicitly by clicking a link.
await page.click('#submit');
// Expect a new url.
console.log(page.url());

// Page can navigate from the script - this will be picked up by Playwright.
window.location.href = 'https://example.com';
```

```java
// Create a page.
Page page = context.newPage();

// Navigate explicitly, similar to entering a URL in the browser.
page.navigate("http://example.com");
// Fill an input.
page.fill("#search", "query");

// Navigate implicitly by clicking a link.
page.click("#submit");
// Expect a new url.
System.out.println(page.url());

// Page can navigate from the script - this will be picked up by Playwright.
// window.location.href = "https://example.com";
```

```python async
page = await context.new_page()

# Navigate explicitly, similar to entering a URL in the browser.
await page.goto('http://example.com')
# Fill an input.
await page.fill('#search', 'query')

# Navigate implicitly by clicking a link.
await page.click('#submit')
# Expect a new url.
print(page.url)

# Page can navigate from the script - this will be picked up by Playwright.
# window.location.href = 'https://example.com'
```

```python sync
page = context.new_page()

# Navigate explicitly, similar to entering a URL in the browser.
page.goto('http://example.com')
# Fill an input.
page.fill('#search', 'query')

# Navigate implicitly by clicking a link.
page.click('#submit')
# Expect a new url.
print(page.url)

# Page can navigate from the script - this will be picked up by Playwright.
# window.location.href = 'https://example.com'
```

```csharp
// Create a page.
var page = await context.NewPageAsync();

// Navigate explicitly, similar to entering a URL in the browser.
await page.GotoAsync("http://example.com");
// Fill an input.
await page.FillAsync("#search", "query");

// Navigate implicitly by clicking a link.
await page.ClickAsync("#submit");
// Expect a new url.
Console.WriteLine(page.Url);

// Page can navigate from the script - this will be picked up by Playwright.
// window.location.href = "https://example.com";
```

> Read more on [page navigation and loading](./navigations.md).

A page can have one or more [Frame] objects attached to
it. Each page has a main frame and page-level interactions (like `click`) are
assumed to operate in the main frame.

A page can have additional frames attached with the `iframe` HTML tag. These
frames can be accessed for interactions inside the frame.

```js
// Get frame using the frame's name attribute
const frame = page.frame('frame-login');

// Get frame using frame's URL
const frame = page.frame({ url: /.*domain.*/ });

// Get frame using any other selector
const frameElementHandle = await page.$('.frame-class');
const frame = await frameElementHandle.contentFrame();

// Interact with the frame
await frame.fill('#username-input', 'John');
```

```java
// Get frame using the frame"s name attribute
Frame frame = page.frame("frame-login");

// Get frame using frame"s URL
Frame frame = page.frameByUrl(Pattern.compile(".*domain.*"));

// Get frame using any other selector
ElementHandle frameElementHandle = page.querySelector(".frame-class");
Frame frame = frameElementHandle.contentFrame();

// Interact with the frame
frame.fill("#username-input", "John");
```

```python async
# Get frame using the frame's name attribute
frame = page.frame('frame-login')

# Get frame using frame's URL
frame = page.frame(url=r'.*domain.*')

# Get frame using any other selector
frame_element_handle = await page.query_selector('.frame-class')
frame = await frame_element_handle.content_frame()

# Interact with the frame
await frame.fill('#username-input', 'John')
```

```python sync
# Get frame using the frame's name attribute
frame = page.frame('frame-login')

# Get frame using frame's URL
frame = page.frame(url=r'.*domain.*')

# Get frame using any other selector
frame_element_handle = page.query_selector('.frame-class')
frame = frame_element_handle.content_frame()

# Interact with the frame
frame.fill('#username-input', 'John')
```

```csharp
// Create a page.
var page = await context.NewPageAsync();

// Get frame using the frame's name attribute
var frame = page.Frame("frame-login");

// Get frame using frame's URL
var frame = page.FrameByUrl("*domain.");

// Get frame using any other selector
var frameElementHandle = await page.QuerySelectorAsync(".frame-class");
var frame = await frameElementHandle.ContentFrameAsync();

// Interact with the frame
await frame.FillAsync("#username-input", "John");
```

### API reference

- [Page]
- [Frame]
- [`method: Page.frame`]

<br/>

## Selectors

Playwright can search for elements using CSS selectors, XPath selectors, HTML attributes like `id`, `data-test-id` and even text content.

You can explicitly specify the selector engine you are using or let Playwright detect it.

All selector engines except for XPath pierce shadow DOM by default. If you want to enforce regular DOM selection, you can use the `*:light` versions of the selectors. You don't typically need to though.

Learn more about selectors and selector engines [here](./selectors.md).

Some examples below:

```js
// Using data-test-id= selector engine
await page.click('data-test-id=foo');
```

```java
// Using data-test-id= selector engine
page.click("data-test-id=foo");
```

```python async
# Using data-test-id= selector engine
await page.click('data-test-id=foo')
```

```python sync
# Using data-test-id= selector engine
page.click('data-test-id=foo')
```

```csharp
// Using data-test-id= selector engine
await page.ClickAsync("data-test-id=foo");
```

```js
// CSS and XPath selector engines are automatically detected
await page.click('div');
await page.click('//html/body/div');
```

```java
// CSS and XPath selector engines are automatically detected
page.click("div");
page.click("//html/body/div");
```

```python async
# CSS and XPath selector engines are automatically detected
await page.click('div')
await page.click('//html/body/div')
```

```python sync
# CSS and XPath selector engines are automatically detected
page.click('div')
page.click('//html/body/div')
```

```csharp
// CSS and XPath selector engines are automatically detected
await page.ClickAsync("div");
await page.ClickAsync("//html/body/div");
```

```js
// Find node by text substring
await page.click('text=Hello w');
```

```java
// Find node by text substring
page.click("text=Hello w");
```

```python async
# Find node by text substring
await page.click('text=Hello w')
```

```python sync
# Find node by text substring
page.click('text=Hello w')
```

```csharp
// Find node by text substring
await page.ClickAsync("text=Hello w");
```

```js
// Explicit CSS and XPath notation
await page.click('css=div');
await page.click('xpath=//html/body/div');
```

```java
// Explicit CSS and XPath notation
page.click("css=div");
page.click("xpath=//html/body/div");
```

```python async
# Explicit CSS and XPath notation
await page.click('css=div')
await page.click('xpath=//html/body/div')
```

```python sync
# Explicit CSS and XPath notation
page.click('css=div')
page.click('xpath=//html/body/div')
```

```csharp
// Explicit CSS and XPath notation
await page.ClickAsync("css=div");
await page.ClickAsync("xpath=//html/body/div");
```

```js
// Only search light DOM, outside WebComponent shadow DOM:
await page.click('css:light=div');
```

```java
// Only search light DOM, outside WebComponent shadow DOM:
page.click("css:light=div");
```

```python async
# Only search light DOM, outside WebComponent shadow DOM:
await page.click('css:light=div')
```

```python sync
# Only search light DOM, outside WebComponent shadow DOM:
page.click('css:light=div')
```

```csharp
// Only search light DOM, outside WebComponent shadow DOM:
await page.ClickAsync("css:light=div");
```

Selectors using the same or different engines can be combined using the `>>` separator. For example,

```js
// Click an element with text 'Sign Up' inside of a #free-month-promo.
await page.click('#free-month-promo >> text=Sign Up');
```

```java
// Click an element with text "Sign Up" inside of a #free-month-promo.
page.click("#free-month-promo >> text=Sign Up");
```

```python async
# Click an element with text 'Sign Up' inside of a #free-month-promo.
await page.click('#free-month-promo >> text=Sign Up')
```

```python sync
# Click an element with text 'Sign Up' inside of a #free-month-promo.
page.click('#free-month-promo >> text=Sign Up')
```

```csharp
// Click an element with text "Sign Up" inside of a #free-month-promo.
await page.Click("#free-month-promo >> text=Sign Up");
```

```js
// Capture textContent of a section that contains an element with text 'Selectors'.
const sectionText = await page.$eval('*css=section >> text=Selectors', e => e.textContent);
```

```java
// Capture textContent of a section that contains an element with text "Selectors".
String sectionText = (String) page.evalOnSelector("*css=section >> text=Selectors", "e => e.textContent");
```

```python async
# Capture textContent of a section that contains an element with text 'Selectors'.
section_text = await page.eval_on_selector('*css=section >> text=Selectors', 'e => e.textContent')
```

```python sync
# Capture textContent of a section that contains an element with text 'Selectors'.
section_text = page.eval_on_selector('*css=section >> text=Selectors', 'e => e.textContent')
```

```csharp
// Capture textContent of a section that contains an element with text "Selectors".
var sectionText = await page.EvalOnSelectorAsync<string>("*css=section >> text=Selectors", "e => e.textContent");
```

<br/>

## Auto-waiting

Actions like [`method: Page.click`] and [`method: Page.fill`] auto-wait for the element to be visible
and [actionable](./actionability.md). For example, click will:
- wait for an element with the given selector to appear in the DOM
- wait for it to become visible: have non-empty bounding box and no `visibility:hidden`
- wait for it to stop moving: for example, wait until css transition finishes
- scroll the element into view
- wait for it to receive pointer events at the action point: for example, wait until element becomes non-obscured by other elements
- retry if the element is detached during any of the above checks


```js
// Playwright waits for #search element to be in the DOM
await page.fill('#search', 'query');
```

```java
// Playwright waits for #search element to be in the DOM
page.fill("#search", "query");
```

```python async
# Playwright waits for #search element to be in the DOM
await page.fill('#search', 'query')
```

```python sync
# Playwright waits for #search element to be in the DOM
page.fill('#search', 'query')
```

```csharp
// Playwright waits for #search element to be in the DOM
await page.FillAsync("#search", "query");
```

```js
// Playwright waits for element to stop animating
// and accept clicks.
await page.click('#search');
```

```java
// Playwright waits for element to stop animating
// and accept clicks.
page.click("#search");
```

```python async
# Playwright waits for element to stop animating
# and accept clicks.
await page.click('#search')
```

```python sync
# Playwright waits for element to stop animating
# and accept clicks.
page.click('#search')
```

```csharp
// Playwright waits for element to stop animating
// and accept clicks.
await page.ClickAsync("#search");
```

You can explicitly wait for an element to appear in the DOM or to become visible:

```js
// Wait for #search to appear in the DOM.
await page.waitForSelector('#search', { state: 'attached' });
// Wait for #promo to become visible, for example with `visibility:visible`.
await page.waitForSelector('#promo');
```

```java
// Wait for #search to appear in the DOM.
page.waitForSelector("#search", new Page.WaitForSelectorOptions()
  .setState(WaitForSelectorState.ATTACHED));
// Wait for #promo to become visible, for example with "visibility:visible".
page.waitForSelector("#promo");
```

```python async
# Wait for #search to appear in the DOM.
await page.wait_for_selector('#search', state='attached')
# Wait for #promo to become visible, for example with `visibility:visible`.
await page.wait_for_selector('#promo')
```

```python sync
# Wait for #search to appear in the DOM.
page.wait_for_selector('#search', state='attached')
# Wait for #promo to become visible, for example with `visibility:visible`.
page.wait_for_selector('#promo')
```

```csharp
// Wait for #search to appear in the DOM.
await page.WaitForSelectorAsync("#search", WaitForSelectorState.Attached);
// Wait for #promo to become visible, for example with `visibility:visible`.
await page.WaitForSelectorAsync("#promo");
```

... or to become hidden or detached

```js
// Wait for #details to become hidden, for example with `display:none`.
await page.waitForSelector('#details', { state: 'hidden' });
// Wait for #promo to be removed from the DOM.
await page.waitForSelector('#promo', { state: 'detached' });
```

```java
// Wait for #details to become hidden, for example with "display:none".
page.waitForSelector("#details", new Page.WaitForSelectorOptions()
  .setState(WaitForSelectorState.HIDDEN));
// Wait for #promo to be removed from the DOM.
page.waitForSelector("#promo", new Page.WaitForSelectorOptions()
  .setState(WaitForSelectorState.DETACHED));
```

```python async
# Wait for #details to become hidden, for example with `display:none`.
await page.wait_for_selector('#details', state='hidden')
# Wait for #promo to be removed from the DOM.
await page.wait_for_selector('#promo', state='detached')
```

```python sync
# Wait for #details to become hidden, for example with `display:none`.
page.wait_for_selector('#details', state='hidden')
# Wait for #promo to be removed from the DOM.
page.wait_for_selector('#promo', state='detached')
```

```csharp
// Wait for #details to become hidden, for example with "display:none".
await page.WaitForSelectorAsync("#details", WaitForSelectorState.Hidden);
// Wait for #promo to be removed from the DOM.
await page.WaitForSelectorAsync("#promo", WaitForSelectorState.Detached);
```

### API reference

- [`method: Page.click`]
- [`method: Page.fill`]
- [`method: Page.waitForSelector`]

<br/>

## Execution contexts: Playwright and Browser

Playwright scripts run in your Playwright environment. Your page scripts run in the browser page environment. Those environments don't intersect, they are running in different virtual machines in different processes and even potentially on different computers.

The [`method: Page.evaluate`] API can run a JavaScript function in the context
of the web page and bring results back to the Playwright environment. Browser globals like
`window` and `document` can be used in `evaluate`.

```js
const href = await page.evaluate(() => document.location.href);
```

```java
String href = (String) page.evaluate("document.location.href");
```

```python async
href = await page.evaluate('() => document.location.href')
```

```python sync
href = page.evaluate('() => document.location.href')
```

```csharp
var href = await page.EvaluateAsync<string>("document.location.href");
```

If the result is a Promise or if the function is asynchronous evaluate will automatically wait until it's resolved:

```js
const status = await page.evaluate(async () => {
  const response = await fetch(location.href);
  return response.status;
});
```

```java
int status = (int) page.evaluate("async () => {\n" +
  "  const response = await fetch(location.href);\n" +
  "  return response.status;\n" +
  "}");
```

```python async
status = await page.evaluate("""async () => {
  response = await fetch(location.href)
  return response.status
}""")
```

```python sync
status = page.evaluate("""async () => {
  response = fetch(location.href)
  return response.status
}""")
```

```csharp
int status = await page.EvaluateAsync<int>(@"async () => {
  const response = await fetch(location.href);
  return response.status;
}");
```

## Evaluation Argument

Playwright evaluation methods like [`method: Page.evaluate`] take a single optional argument. This argument can be a mix of [Serializable] values and [JSHandle] or [ElementHandle] instances. Handles are automatically converted to the value they represent.

```js
// A primitive value.
await page.evaluate(num => num, 42);

// An array.
await page.evaluate(array => array.length, [1, 2, 3]);

// An object.
await page.evaluate(object => object.foo, { foo: 'bar' });

// A single handle.
const button = await page.$('button');
await page.evaluate(button => button.textContent, button);

// Alternative notation using elementHandle.evaluate.
await button.evaluate((button, from) => button.textContent.substring(from), 5);

// Object with multiple handles.
const button1 = await page.$('.button1');
const button2 = await page.$('.button2');
await page.evaluate(
    o => o.button1.textContent + o.button2.textContent,
    { button1, button2 });

// Object destructuring works. Note that property names must match
// between the destructured object and the argument.
// Also note the required parenthesis.
await page.evaluate(
    ({ button1, button2 }) => button1.textContent + button2.textContent,
    { button1, button2 });

// Array works as well. Arbitrary names can be used for destructuring.
// Note the required parenthesis.
await page.evaluate(
    ([b1, b2]) => b1.textContent + b2.textContent,
    [button1, button2]);

// Any non-cyclic mix of serializables and handles works.
await page.evaluate(
    x => x.button1.textContent + x.list[0].textContent + String(x.foo),
    { button1, list: [button2], foo: null });
```

```java
// A primitive value.
page.evaluate("num => num", 42);

// An array.
page.evaluate("array => array.length", Arrays.asList(1, 2, 3));

// An object.
Map<String, Object> obj = new HashMap<>();
obj.put("foo", "bar");
page.evaluate("object => object.foo", obj);

// A single handle.
ElementHandle button = page.querySelector("button");
page.evaluate("button => button.textContent", button);

// Alternative notation using elementHandle.evaluate.
button.evaluate("(button, from) => button.textContent.substring(from)", 5);

// Object with multiple handles.
ElementHandle button1 = page.querySelector(".button1");
ElementHandle button2 = page.querySelector(".button2");
Map<String, ElementHandle> arg = new HashMap<>();
arg.put("button1", button1);
arg.put("button2", button2);
page.evaluate("o => o.button1.textContent + o.button2.textContent", arg);

// Object destructuring works. Note that property names must match
// between the destructured object and the argument.
// Also note the required parenthesis.
Map<String, ElementHandle> arg = new HashMap<>();
arg.put("button1", button1);
arg.put("button2", button2);
page.evaluate("({ button1, button2 }) => button1.textContent + button2.textContent", arg);

// Array works as well. Arbitrary names can be used for destructuring.
// Note the required parenthesis.
page.evaluate(
  "([b1, b2]) => b1.textContent + b2.textContent",
  Arrays.asList(button1, button2));

// Any non-cyclic mix of serializables and handles works.
Map<String, Object> arg = new HashMap<>();
arg.put("button1", button1);
arg.put("list", Arrays.asList(button2));
arg.put("foo", 0);
page.evaluate(
  "x => x.button1.textContent + x.list[0].textContent + String(x.foo)",
  arg);
```

```python async
# A primitive value.
await page.evaluate('num => num', 42)

# An array.
await page.evaluate('array => array.length', [1, 2, 3])

# An object.
await page.evaluate('object => object.foo', { 'foo': 'bar' })

# A single handle.
button = await page.query_selctor('button')
await page.evaluate('button => button.textContent', button)

# Alternative notation using elementHandle.evaluate.
await button.evaluate('(button, from) => button.textContent.substring(from)', 5)

# Object with multiple handles.
button1 = await page.query_selector('.button1')
button2 = await page.query_selector('.button2')
await page.evaluate("""
    o => o.button1.textContent + o.button2.textContent""",
    { 'button1': button1, 'button2': button2 })

# Object destructuring works. Note that property names must match
# between the destructured object and the argument.
# Also note the required parenthesis.
await page.evaluate("""
    ({ button1, button2 }) => button1.textContent + button2.textContent""",
    { 'button1': button1, 'button2': button2 })

# Array works as well. Arbitrary names can be used for destructuring.
# Note the required parenthesis.
await page.evaluate("""
    ([b1, b2]) => b1.textContent + b2.textContent""",
    [button1, button2])

# Any non-cyclic mix of serializables and handles works.
await page.evaluate("""
    x => x.button1.textContent + x.list[0].textContent + String(x.foo)""",
    { 'button1': button1, 'list': [button2], 'foo': None })
```

```python sync
# A primitive value.
page.evaluate('num => num', 42)

# An array.
page.evaluate('array => array.length', [1, 2, 3])

# An object.
page.evaluate('object => object.foo', { 'foo': 'bar' })

# A single handle.
button = page.query_selector('button')
page.evaluate('button => button.textContent', button)

# Alternative notation using elementHandle.evaluate.
button.evaluate('(button, from) => button.textContent.substring(from)', 5)

# Object with multiple handles.
button1 = page.query_selector('.button1')
button2 = page.query_selector('.button2')
page.evaluate("""o => o.button1.textContent + o.button2.textContent""",
    { 'button1': button1, 'button2': button2 })

# Object destructuring works. Note that property names must match
# between the destructured object and the argument.
# Also note the required parenthesis.
page.evaluate("""
    ({ button1, button2 }) => button1.textContent + button2.textContent""",
    { 'button1': button1, 'button2': button2 })

# Array works as well. Arbitrary names can be used for destructuring.
# Note the required parenthesis.
page.evaluate("""
    ([b1, b2]) => b1.textContent + b2.textContent""",
    [button1, button2])

# Any non-cyclic mix of serializables and handles works.
page.evaluate("""
    x => x.button1.textContent + x.list[0].textContent + String(x.foo)""",
    { 'button1': button1, 'list': [button2], 'foo': None })
```

```csharp
// A primitive value.
await page.EvaluateAsync<int>("num => num", 42);

// An array.
await page.EvaluateAsync<int[]>("array => array.length", new[] { 1, 2, 3 });

// An object.
await page.EvaluateAsync<object>("object => object.foo", new { foo = "bar" });

// A single handle.
var button = await page.QuerySelectorAsync("button");
await page.EvaluateAsync<IJSHandle>("button => button.textContent", button);

// Alternative notation using elementHandle.EvaluateAsync.
await button.EvaluateAsync<string>("(button, from) => button.textContent.substring(from)", 5);

// Object with multiple handles.
var button1 = await page.QuerySelectorAsync(".button1");
var button2 = await page.QuerySelectorAsync(".button2");
await page.EvaluateAsync("o => o.button1.textContent + o.button2.textContent", new { button1, button2 });

// Object destructuring works. Note that property names must match
// between the destructured object and the argument.
// Also note the required parenthesis.
await page.EvaluateAsync("({ button1, button2 }) => button1.textContent + button2.textContent", new { button1, button2 });

// Array works as well. Arbitrary names can be used for destructuring.
// Note the required parenthesis.
await page.EvaluateAsync("([b1, b2]) => b1.textContent + b2.textContent", new[] { button1, button2 });

// Any non-cyclic mix of serializables and handles works.
await page.EvaluateAsync("x => x.button1.textContent + x.list[0].textContent + String(x.foo)", new { button1, list = new[] { button2 }, foo = null as object });
```

Right:

```js
const data = { text: 'some data', value: 1 };
// Pass |data| as a parameter.
const result = await page.evaluate(data => {
  window.myApp.use(data);
}, data);
```

```java
Map<String, Object> data = new HashMap<>();
data.put("text", "some data");
data.put("value", 1);
// Pass |data| as a parameter.
Object result = page.evaluate("data => {\n" +
  "  window.myApp.use(data);\n" +
  "}", data);
```

```python async
data = { 'text': 'some data', 'value': 1 }
# Pass |data| as a parameter.
result = await page.evaluate("""data => {
  window.myApp.use(data)
}""", data)
```

```python sync
data = { 'text': 'some data', 'value': 1 }
# Pass |data| as a parameter.
result = page.evaluate("""data => {
  window.myApp.use(data)
}""", data)
```

```csharp
var data = new { text = "some data", value = 1};
// Pass data as a parameter
var result = await page.EvaluateAsync("data => { window.myApp.use(data); }", data);
```

Wrong:

```js
const data = { text: 'some data', value: 1 };
const result = await page.evaluate(() => {
  // There is no |data| in the web page.
  window.myApp.use(data);
});
```

```java
Map<String, Object> data = new HashMap<>();
data.put("text", "some data");
data.put("value", 1);
Object result = page.evaluate("() => {\n" +
  "  // There is no |data| in the web page.\n" +
  "  window.myApp.use(data);\n" +
  "}");
```

```python async
data = { 'text': 'some data', 'value': 1 }
result = await page.evaluate("""() => {
  # There is no |data| in the web page.
  window.myApp.use(data)
}""")
```

```python sync
data = { 'text': 'some data', 'value': 1 }
result = page.evaluate("""() => {
  # There is no |data| in the web page.
  window.myApp.use(data)
}""")
```

```csharp
var data = new { text = "some data", value = 1};
// Pass data as a parameter
var result = await page.EvaluateAsync(@"data => {
  // There is no |data| in the web page.
  window.myApp.use(data); 
}");
```

### API reference

- [`method: Page.evaluate`]
- [`method: Frame.evaluate`]
- [EvaluationArgument]

<br/>
