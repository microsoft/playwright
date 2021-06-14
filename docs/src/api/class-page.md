# class: Page
* extends: [EventEmitter]

Page provides methods to interact with a single tab in a [Browser], or an
[extension background page](https://developer.chrome.com/extensions/background_pages) in Chromium. One [Browser]
instance might have multiple [Page] instances.

This example creates a page, navigates it to a URL, and then saves a screenshot:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://example.com');
  await page.screenshot({path: 'screenshot.png'});
  await browser.close();
})();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType webkit = playwright.webkit();
      Browser browser = webkit.launch();
      BrowserContext context = browser.newContext();
      Page page = context.newPage();
      page.navigate("https://example.com");
      page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("screenshot.png")));
      browser.close();
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    webkit = playwright.webkit
    browser = await webkit.launch()
    context = await browser.new_context()
    page = await context.new_page()
    await page.goto("https://example.com")
    await page.screenshot(path="screenshot.png")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    webkit = playwright.webkit
    browser = webkit.launch()
    context = browser.new_context()
    page = context.new_page()
    page.goto("https://example.com")
    page.screenshot(path="screenshot.png")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class PageExamples
{
    public static async Task Run()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Webkit.LaunchAsync();
        var page = await browser.NewPageAsync();
        await page.GotoAsync("https://www.theverge.com");
        await page.ScreenshotAsync(new PageScreenshotOptions { Path = "theverge.png" });
    }
}
```

The Page class emits various events (described below) which can be handled using any of Node's native
[`EventEmitter`](https://nodejs.org/api/events.html#events_class_eventemitter) methods, such as `on`, `once` or
`removeListener`.

This example logs a message for a single page `load` event:

```js
page.once('load', () => console.log('Page loaded!'));
```

```java
page.onLoad(p -> System.out.println("Page loaded!"));
```

```py
page.once("load", lambda: print("page loaded!"))
```

```csharp
page.Load += (_, _) => Console.WriteLine("Page loaded!");
```

To unsubscribe from events use the `removeListener` method:

```js
function logRequest(interceptedRequest) {
  console.log('A request was made:', interceptedRequest.url());
}
page.on('request', logRequest);
// Sometime later...
page.removeListener('request', logRequest);
```

```java
Consumer<Request> logRequest = interceptedRequest -> {
  System.out.println("A request was made: " + interceptedRequest.url());
};
page.onRequest(logRequest);
// Sometime later...
page.offRequest(logRequest);
```

```py
def log_request(intercepted_request):
    print("a request was made:", intercepted_request.url)
page.on("request", log_request)
# sometime later...
page.remove_listener("request", log_request)
```

```csharp
void PageLoadHandler(object _, IPage p) {
    Console.WriteLine("Page loaded!");
};

page.Load += PageLoadHandler;
// Do some work...
page.Load -= PageLoadHandler;
```

## event: Page.close
- argument: <[Page]>

Emitted when the page closes.

## event: Page.console
* langs:
  - alias-java: consoleMessage
- argument: <[ConsoleMessage]>

Emitted when JavaScript within the page calls one of console API methods, e.g. `console.log` or `console.dir`. Also
emitted if the page throws an error or a warning.

The arguments passed into `console.log` appear as arguments on the event handler.

An example of handling `console` event:

```js
page.on('console', async msg => {
  for (let i = 0; i < msg.args().length; ++i)
    console.log(`${i}: ${await msg.args()[i].jsonValue()}`);
});
await page.evaluate(() => console.log('hello', 5, {foo: 'bar'}));
```

```java
page.onConsoleMessage(msg -> {
  for (int i = 0; i < msg.args().size(); ++i)
    System.out.println(i + ": " + msg.args().get(i).jsonValue());
});
page.evaluate("() => console.log('hello', 5, {foo: 'bar'})");
```

```python async
async def print_args(msg):
    for arg in msg.args:
        print(await arg.json_value())

page.on("console", print_args)
await page.evaluate("console.log('hello', 5, {foo: 'bar'})")
```

```python sync
def print_args(msg):
    for arg in msg.args:
        print(arg.json_value())

page.on("console", print_args)
page.evaluate("console.log('hello', 5, {foo: 'bar'})")
```

```csharp
page.Console += async (_, msg) =>
{
    foreach (var arg in msg.Args)
        Console.WriteLine(await arg.JsonValueAsync<object>());
};

await page.EvaluateAsync("console.log('hello', 5, { foo: 'bar' })");
```

## event: Page.crash
- argument: <[Page]>

Emitted when the page crashes. Browser pages might crash if they try to allocate too much memory. When the page crashes,
ongoing and subsequent operations will throw.

The most common way to deal with crashes is to catch an exception:

```js
try {
  // Crash might happen during a click.
  await page.click('button');
  // Or while waiting for an event.
  await page.waitForEvent('popup');
} catch (e) {
  // When the page crashes, exception message contains 'crash'.
}
```

```java
try {
  // Crash might happen during a click.
  page.click("button");
  // Or while waiting for an event.
  page.waitForPopup(() -> {});
} catch (PlaywrightException e) {
  // When the page crashes, exception message contains "crash".
}
```

```python async
try:
    # crash might happen during a click.
    await page.click("button")
    # or while waiting for an event.
    await page.wait_for_event("popup")
except Error as e:
    # when the page crashes, exception message contains "crash".
```

```python sync
try:
    # crash might happen during a click.
    page.click("button")
    # or while waiting for an event.
    page.wait_for_event("popup")
except Error as e:
    # when the page crashes, exception message contains "crash".
```

```csharp
try {
  // Crash might happen during a click.
  await page.ClickAsync("button");
  // Or while waiting for an event.
  await page.WaitForPopup();
} catch (PlaywrightException e) {
  // When the page crashes, exception message contains "crash".
}
```

## event: Page.dialog
- argument: <[Dialog]>

Emitted when a JavaScript dialog appears, such as `alert`, `prompt`, `confirm` or `beforeunload`. Listener **must** either [`method: Dialog.accept`] or [`method: Dialog.dismiss`] the dialog - otherwise the page will [freeze](https://developer.mozilla.org/en-US/docs/Web/JavaScript/EventLoop#never_blocking) waiting for the dialog, and actions like click will never finish.

:::note
When no [`event: Page.dialog`] listeners are present, all dialogs are automatically dismissed.
:::

## event: Page.DOMContentLoaded
- argument: <[Page]>

Emitted when the JavaScript [`DOMContentLoaded`](https://developer.mozilla.org/en-US/docs/Web/Events/DOMContentLoaded)
event is dispatched.

## event: Page.download
- argument: <[Download]>

Emitted when attachment download started. User can access basic file operations on downloaded content via the passed
[Download] instance.

:::note
Browser context **must** be created with the [`option: acceptDownloads`] set to `true` when user needs access to the
downloaded content. If [`option: acceptDownloads`] is not set, download events are emitted, but the actual download is
not performed and user has no access to the downloaded files.
:::

## event: Page.fileChooser
- argument: <[FileChooser]>

Emitted when a file chooser is supposed to appear, such as after clicking the  `<input type=file>`. Playwright can
respond to it via setting the input files using [`method: FileChooser.setFiles`] that can be uploaded after that.

```js
page.on('filechooser', async (fileChooser) => {
  await fileChooser.setFiles('/tmp/myfile.pdf');
});
```

```java
page.onFileChooser(fileChooser -> {
  fileChooser.setFiles(Paths.get("/tmp/myfile.pdf"));
});
```

```py
page.on("filechooser", lambda file_chooser: file_chooser.set_files("/tmp/myfile.pdf"))
```

```csharp
page.FileChooser += (_, fileChooser) =>
{
    fileChooser.SetFilesAsync(@"C:\temp\myfile.pdf");
};
```

## event: Page.frameAttached
- argument: <[Frame]>

Emitted when a frame is attached.

## event: Page.frameDetached
- argument: <[Frame]>

Emitted when a frame is detached.

## event: Page.frameNavigated
- argument: <[Frame]>

Emitted when a frame is navigated to a new url.

## event: Page.load
- argument: <[Page]>

Emitted when the JavaScript [`load`](https://developer.mozilla.org/en-US/docs/Web/Events/load) event is dispatched.

## event: Page.pageError
- argument: <[Error]>

Emitted when an uncaught exception happens within the page.

## event: Page.pageError
* langs: csharp, java
- argument: <[string]>

## event: Page.popup
- argument: <[Page]>

Emitted when the page opens a new tab or window. This event is emitted in addition to the
[`event: BrowserContext.page`], but only for popups relevant to this page.

The earliest moment that page is available is when it has navigated to the initial url. For example, when opening a
popup with `window.open('http://example.com')`, this event will fire when the network request to "http://example.com" is
done and its response has started loading in the popup.

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.evaluate(() => window.open('https://example.com')),
]);
console.log(await popup.evaluate('location.href'));
```

```java
Page popup = page.waitForPopup(() -> {
  page.evaluate("() => window.open('https://example.com')");
});
System.out.println(popup.evaluate("location.href"));
```

```python async
async with page.expect_event("popup") as page_info:
    page.evaluate("window.open('https://example.com')")
popup = await page_info.value
print(await popup.evaluate("location.href"))
```

```python sync
with page.expect_event("popup") as page_info:
    page.evaluate("window.open('https://example.com')")
popup = page_info.value
print(popup.evaluate("location.href"))
```

```csharp
var popup = await page.RunAndWaitForPopupAsync(async () =>
{
    await page.EvaluateAsync("() => window.open('https://microsoft.com')");
});
Console.WriteLine(await popup.EvaluateAsync<string>("location.href"));
```

:::note
Use [`method: Page.waitForLoadState`] to wait until the page gets to a particular state (you should not need it in most
cases).
:::

## event: Page.request
- argument: <[Request]>

Emitted when a page issues a request. The [request] object is read-only. In order to intercept and mutate requests, see
[`method: Page.route`] or [`method: BrowserContext.route`].

## event: Page.requestFailed
- argument: <[Request]>

Emitted when a request fails, for example by timing out.

:::note
HTTP Error responses, such as 404 or 503, are still successful responses from HTTP standpoint, so request will complete
with [`event: Page.requestFinished`] event and not with [`event: Page.requestFailed`]. A request will only be considered
failed when the client cannot get an HTTP response from the server, e.g. due to network error net::ERR_FAILED.
:::

## event: Page.requestFinished
- argument: <[Request]>

Emitted when a request finishes successfully after downloading the response body. For a successful response, the
sequence of events is `request`, `response` and `requestfinished`.

## event: Page.response
- argument: <[Response]>

Emitted when [response] status and headers are received for a request. For a successful response, the sequence of events
is `request`, `response` and `requestfinished`.

## event: Page.webSocket
- argument: <[WebSocket]>

Emitted when [WebSocket] request is sent.

## event: Page.worker
- argument: <[Worker]>

Emitted when a dedicated [WebWorker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API) is spawned by the
page.

## property: Page.accessibility
* langs: csharp, js, python
- type: <[Accessibility]>

## async method: Page.addInitScript

Adds a script which would be evaluated in one of the following scenarios:
* Whenever the page is navigated.
* Whenever the child frame is attached or navigated. In this case, the script is evaluated in the context of the newly
  attached frame.

The script is evaluated after the document was created but before any of its scripts were run. This is useful to amend
the JavaScript environment, e.g. to seed `Math.random`.

An example of overriding `Math.random` before the page loads:

```js browser
// preload.js
Math.random = () => 42;
```

```js
// In your playwright script, assuming the preload.js file is in same directory
await page.addInitScript({ path: './preload.js' });
```

```java
// In your playwright script, assuming the preload.js file is in same directory
page.addInitScript(Paths.get("./preload.js"));
```

```python async
# in your playwright script, assuming the preload.js file is in same directory
await page.add_init_script(path="./preload.js")
```

```python sync
# in your playwright script, assuming the preload.js file is in same directory
page.add_init_script(path="./preload.js")
```

```csharp
await page.AddInitScriptAsync(new PageAddInitScriptOption { ScriptPath = "./preload.js" });
```

:::note
The order of evaluation of multiple scripts installed via [`method: BrowserContext.addInitScript`] and
[`method: Page.addInitScript`] is not defined.
:::

### param: Page.addInitScript.script
* langs: js
- `script` <[function]|[string]|[Object]>
  - `path` <[path]> Path to the JavaScript file. If `path` is a relative path, then it is resolved relative to the
    current working directory. Optional.
  - `content` <[string]> Raw script content. Optional.

Script to be evaluated in the page.

### param: Page.addInitScript.script
* langs: csharp, java
- `script` <[string]|[path]>

Script to be evaluated in all pages in the browser context.

### param: Page.addInitScript.arg
* langs: js
- `arg` <[Serializable]>

Optional argument to pass to [`param: script`] (only supported when passing a function).

## async method: Page.addScriptTag
- returns: <[ElementHandle]>

Adds a `<script>` tag into the page with the desired url or content. Returns the added tag when the script's onload
fires or when the script content was injected into frame.

Shortcut for main frame's [`method: Frame.addScriptTag`].

### option: Page.addScriptTag.url
- `url` <[string]>

URL of a script to be added.

### option: Page.addScriptTag.path
- `path` <[path]>

Path to the JavaScript file to be injected into frame. If `path` is a relative path, then it is resolved relative to the
current working directory.

### option: Page.addScriptTag.content
- `content` <[string]>

Raw JavaScript content to be injected into frame.

### option: Page.addScriptTag.type
- `type` <[string]>

Script type. Use 'module' in order to load a Javascript ES6 module. See
[script](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script) for more details.

## async method: Page.addStyleTag
- returns: <[ElementHandle]>

Adds a `<link rel="stylesheet">` tag into the page with the desired url or a `<style type="text/css">` tag with the
content. Returns the added tag when the stylesheet's onload fires or when the CSS content was injected into frame.

Shortcut for main frame's [`method: Frame.addStyleTag`].

### option: Page.addStyleTag.url
- `url` <[string]>

URL of the `<link>` tag.

### option: Page.addStyleTag.path
- `path` <[path]>

Path to the CSS file to be injected into frame. If `path` is a relative path, then it is resolved relative to the
current working directory.

### option: Page.addStyleTag.content
- `content` <[string]>

Raw CSS content to be injected into frame.

## async method: Page.bringToFront

Brings page to front (activates tab).

## async method: Page.check

This method checks an element matching [`param: selector`] by performing the following steps:
1. Find an element matching [`param: selector`]. If there is none, wait until a matching element is attached to
   the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws. If the element is already
   checked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is
   set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now checked. If not, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

Shortcut for main frame's [`method: Frame.check`].

### param: Page.check.selector = %%-input-selector-%%

### option: Page.check.position = %%-input-position-%%

### option: Page.check.force = %%-input-force-%%

### option: Page.check.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.check.timeout = %%-input-timeout-%%

### option: Page.check.trial = %%-input-trial-%%

## async method: Page.click

This method clicks an element matching [`param: selector`] by performing the following steps:
1. Find an element matching [`param: selector`]. If there is none, wait until a matching element is attached to
   the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is
   set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

Shortcut for main frame's [`method: Frame.click`].

### param: Page.click.selector = %%-input-selector-%%

### option: Page.click.button = %%-input-button-%%

### option: Page.click.clickCount = %%-input-click-count-%%

### option: Page.click.delay = %%-input-down-up-delay-%%

### option: Page.click.position = %%-input-position-%%

### option: Page.click.modifiers = %%-input-modifiers-%%

### option: Page.click.force = %%-input-force-%%

### option: Page.click.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.click.timeout = %%-input-timeout-%%

### option: Page.click.trial = %%-input-trial-%%

## async method: Page.close

If [`option: runBeforeUnload`] is `false`, does not run any unload handlers and waits for the page to be closed. If
[`option: runBeforeUnload`] is `true` the method will run unload handlers, but will **not** wait for the page to close.

By default, `page.close()` **does not** run `beforeunload` handlers.

:::note
if [`option: runBeforeUnload`] is passed as true, a `beforeunload` dialog might be summoned and should be handled
manually via [`event: Page.dialog`] event.
:::

### option: Page.close.runBeforeUnload
- `runBeforeUnload` <[boolean]>

Defaults to `false`. Whether to run the
[before unload](https://developer.mozilla.org/en-US/docs/Web/Events/beforeunload) page handlers.

## async method: Page.content
- returns: <[string]>

Gets the full HTML contents of the page, including the doctype.

## method: Page.context
- returns: <[BrowserContext]>

Get the browser context that the page belongs to.

## property: Page.coverage
* langs: js
- type: <[Coverage]>

:::note
Only available for Chromium atm.
:::

Browser-specific Coverage implementation. See [Coverage](#class-coverage) for more details.

## async method: Page.dblclick
* langs:
  - alias-csharp: DblClickAsync

This method double clicks an element matching [`param: selector`] by performing the following steps:
1. Find an element matching [`param: selector`]. If there is none, wait until a matching element is attached to
   the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is
   set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to double click in the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set. Note that
   if the first click of the `dblclick()` triggers a navigation event, this method will throw.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
`page.dblclick()` dispatches two `click` events and a single `dblclick` event.
:::

Shortcut for main frame's [`method: Frame.dblclick`].

### param: Page.dblclick.selector = %%-input-selector-%%

### option: Page.dblclick.button = %%-input-button-%%

### option: Page.dblclick.delay = %%-input-down-up-delay-%%

### option: Page.dblclick.position = %%-input-position-%%

### option: Page.dblclick.modifiers = %%-input-modifiers-%%

### option: Page.dblclick.force = %%-input-force-%%

### option: Page.dblclick.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.dblclick.timeout = %%-input-timeout-%%

### option: Page.dblclick.trial = %%-input-trial-%%

## async method: Page.dispatchEvent

The snippet below dispatches the `click` event on the element. Regardless of the visibility state of the element, `click`
is dispatched. This is equivalent to calling
[element.click()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLElement/click).

```js
await page.dispatchEvent('button#submit', 'click');
```

```java
page.dispatchEvent("button#submit", "click");
```

```python async
await page.dispatch_event("button#submit", "click")
```

```python sync
page.dispatch_event("button#submit", "click")
```

```csharp
await page.DispatchEventAsync("button#submit", "click");
```

Under the hood, it creates an instance of an event based on the given [`param: type`], initializes it with
[`param: eventInit`] properties and dispatches it on the element. Events are `composed`, `cancelable` and bubble by
default.

Since [`param: eventInit`] is event-specific, please refer to the events documentation for the lists of initial
properties:
* [DragEvent](https://developer.mozilla.org/en-US/docs/Web/API/DragEvent/DragEvent)
* [FocusEvent](https://developer.mozilla.org/en-US/docs/Web/API/FocusEvent/FocusEvent)
* [KeyboardEvent](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/KeyboardEvent)
* [MouseEvent](https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/MouseEvent)
* [PointerEvent](https://developer.mozilla.org/en-US/docs/Web/API/PointerEvent/PointerEvent)
* [TouchEvent](https://developer.mozilla.org/en-US/docs/Web/API/TouchEvent/TouchEvent)
* [Event](https://developer.mozilla.org/en-US/docs/Web/API/Event/Event)

You can also specify `JSHandle` as the property value if you want live objects to be passed into the event:

```js
// Note you can only create DataTransfer in Chromium and Firefox
const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
await page.dispatchEvent('#source', 'dragstart', { dataTransfer });
```

```java
// Note you can only create DataTransfer in Chromium and Firefox
JSHandle dataTransfer = page.evaluateHandle("() => new DataTransfer()");
Map<String, Object> arg = new HashMap<>();
arg.put("dataTransfer", dataTransfer);
page.dispatchEvent("#source", "dragstart", arg);
```

```python async
# note you can only create data_transfer in chromium and firefox
data_transfer = await page.evaluate_handle("new DataTransfer()")
await page.dispatch_event("#source", "dragstart", { "dataTransfer": data_transfer })
```

```python sync
# note you can only create data_transfer in chromium and firefox
data_transfer = page.evaluate_handle("new DataTransfer()")
page.dispatch_event("#source", "dragstart", { "dataTransfer": data_transfer })
```

```csharp
var dataTransfer = await page.EvaluateHandleAsync("() => new DataTransfer()");
await page.DispatchEventAsync("#source", "dragstart", new { dataTransfer });
```

### param: Page.dispatchEvent.selector = %%-input-selector-%%

### param: Page.dispatchEvent.type
- `type` <[string]>

DOM event type: `"click"`, `"dragstart"`, etc.

### param: Page.dispatchEvent.eventInit
- `eventInit` <[EvaluationArgument]>

Optional event-specific initialization properties.

### option: Page.dispatchEvent.timeout = %%-input-timeout-%%

## async method: Page.emulateMedia

This method changes the `CSS media type` through the `media` argument, and/or the `'prefers-colors-scheme'` media feature, using the `colorScheme` argument.

```js
await page.evaluate(() => matchMedia('screen').matches);
// → true
await page.evaluate(() => matchMedia('print').matches);
// → false

await page.emulateMedia({ media: 'print' });
await page.evaluate(() => matchMedia('screen').matches);
// → false
await page.evaluate(() => matchMedia('print').matches);
// → true

await page.emulateMedia({});
await page.evaluate(() => matchMedia('screen').matches);
// → true
await page.evaluate(() => matchMedia('print').matches);
// → false
```

```java
page.evaluate("() => matchMedia('screen').matches");
// → true
page.evaluate("() => matchMedia('print').matches");
// → false

page.emulateMedia(new Page.EmulateMediaOptions().setMedia(Media.PRINT));
page.evaluate("() => matchMedia('screen').matches");
// → false
page.evaluate("() => matchMedia('print').matches");
// → true

page.emulateMedia(new Page.EmulateMediaOptions());
page.evaluate("() => matchMedia('screen').matches");
// → true
page.evaluate("() => matchMedia('print').matches");
// → false
```

```python async
await page.evaluate("matchMedia('screen').matches")
# → True
await page.evaluate("matchMedia('print').matches")
# → False

await page.emulate_media(media="print")
await page.evaluate("matchMedia('screen').matches")
# → False
await page.evaluate("matchMedia('print').matches")
# → True

await page.emulate_media()
await page.evaluate("matchMedia('screen').matches")
# → True
await page.evaluate("matchMedia('print').matches")
# → False
```

```python sync
page.evaluate("matchMedia('screen').matches")
# → True
page.evaluate("matchMedia('print').matches")
# → False

page.emulate_media(media="print")
page.evaluate("matchMedia('screen').matches")
# → False
page.evaluate("matchMedia('print').matches")
# → True

page.emulate_media()
page.evaluate("matchMedia('screen').matches")
# → True
page.evaluate("matchMedia('print').matches")
# → False
```

```csharp
await page.EvaluateAsync("() => matchMedia('screen').matches");
// → true
await page.EvaluateAsync("() => matchMedia('print').matches");
// → false

await page.EmulateMediaAsync(new PageEmulateMediaOptions { Media = Media.Print });
await page.EvaluateAsync("() => matchMedia('screen').matches");
// → false
await page.EvaluateAsync("() => matchMedia('print').matches");
// → true

await page.EmulateMediaAsync(new PageEmulateMediaOptions { Media = Media.Screen });
await page.EvaluateAsync("() => matchMedia('screen').matches");
// → true
await page.EvaluateAsync("() => matchMedia('print').matches");
// → false
```

```js
await page.emulateMedia({ colorScheme: 'dark' });
await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
// → true
await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches);
// → false
await page.evaluate(() => matchMedia('(prefers-color-scheme: no-preference)').matches);
// → false
```

```java
page.emulateMedia(new Page.EmulateMediaOptions().setColorScheme(ColorScheme.DARK));
page.evaluate("() => matchMedia('(prefers-color-scheme: dark)').matches");
// → true
page.evaluate("() => matchMedia('(prefers-color-scheme: light)').matches");
// → false
page.evaluate("() => matchMedia('(prefers-color-scheme: no-preference)').matches");
// → false
```

```python async
await page.emulate_media(color_scheme="dark")
await page.evaluate("matchMedia('(prefers-color-scheme: dark)').matches")
# → True
await page.evaluate("matchMedia('(prefers-color-scheme: light)').matches")
# → False
await page.evaluate("matchMedia('(prefers-color-scheme: no-preference)').matches")
# → False
```

```python sync
page.emulate_media(color_scheme="dark")
page.evaluate("matchMedia('(prefers-color-scheme: dark)').matches")
# → True
page.evaluate("matchMedia('(prefers-color-scheme: light)').matches")
# → False
page.evaluate("matchMedia('(prefers-color-scheme: no-preference)').matches")
```

```csharp
await page.EmulateMediaAsync(new PageEmulateMediaOptions { ColorScheme = ColorScheme.Dark });
await page.EvaluateAsync("matchMedia('(prefers-color-scheme: dark)').matches");
// → true
await page.EvaluateAsync("matchMedia('(prefers-color-scheme: light)').matches");
// → false
await page.EvaluateAsync("matchMedia('(prefers-color-scheme: no-preference)').matches");
// → false
```

### option: Page.emulateMedia.media
* langs: js, python, java
- `media` <null|[Media]<"screen"|"print">>

Changes the CSS media type of the page. The only allowed values are `'screen'`, `'print'` and `null`.
Passing `null` disables CSS media emulation.

### option: Page.emulateMedia.media
* langs: csharp
- `media` <[Media]<"screen"|"print"|"null">>

Changes the CSS media type of the page. The only allowed values are `'Screen'`, `'Print'` and `'Null'`.
Passing `'Null'` disables CSS media emulation.

### option: Page.emulateMedia.colorScheme
* langs: js, python, java
- `colorScheme` <null|[ColorScheme]<"light"|"dark"|"no-preference">>

Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. Passing
`null` disables color scheme emulation.

### option: Page.emulateMedia.colorScheme
* langs: csharp
- `colorScheme` <[ColorScheme]<"light"|"dark"|"no-preference"|"null">>

Emulates `'prefers-colors-scheme'` media feature, supported values are `'light'`, `'dark'`, `'no-preference'`. Passing
`'Null'` disables color scheme emulation.

### option: Page.emulateMedia.reducedMotion
* langs: js, python, java
- `reducedMotion` <null|[ReducedMotion]<"reduce"|"no-preference">>

Emulates `'prefers-reduced-motion'` media feature, supported values are `'reduce'`, `'no-preference'`. Passing `null` disables reduced motion emulation.

### option: Page.emulateMedia.reducedMotion
* langs: csharp
- `reducedMotion` <[ReducedMotion]<"reduce"|"no-preference"|"null">>

Emulates `'prefers-reduced-motion'` media feature, supported values are `'reduce'`, `'no-preference'`. Passing `null` disables reduced motion emulation.

## async method: Page.evalOnSelector
* langs:
  - alias-python: eval_on_selector
  - alias-js: $eval
- returns: <[Serializable]>

The method finds an element matching the specified selector within the page and passes it as a first argument to
[`param: expression`]. If no elements match the selector, the method throws an error. Returns the value of
[`param: expression`].

If [`param: expression`] returns a [Promise], then [`method: Page.evalOnSelector`] would wait for the promise to resolve and
return its value.

Examples:

```js
const searchValue = await page.$eval('#search', el => el.value);
const preloadHref = await page.$eval('link[rel=preload]', el => el.href);
const html = await page.$eval('.main-container', (e, suffix) => e.outerHTML + suffix, 'hello');
// In TypeScript, this example requires an explicit type annotation (HTMLLinkElement) on el:
const preloadHrefTS = await page.$eval('link[rel=preload]', (el: HTMLLinkElement) => el.href);
```

```java
String searchValue = (String) page.evalOnSelector("#search", "el => el.value");
String preloadHref = (String) page.evalOnSelector("link[rel=preload]", "el => el.href");
String html = (String) page.evalOnSelector(".main-container", "(e, suffix) => e.outerHTML + suffix", "hello");
```

```python async
search_value = await page.eval_on_selector("#search", "el => el.value")
preload_href = await page.eval_on_selector("link[rel=preload]", "el => el.href")
html = await page.eval_on_selector(".main-container", "(e, suffix) => e.outer_html + suffix", "hello")
```

```python sync
search_value = page.eval_on_selector("#search", "el => el.value")
preload_href = page.eval_on_selector("link[rel=preload]", "el => el.href")
html = page.eval_on_selector(".main-container", "(e, suffix) => e.outer_html + suffix", "hello")
```

```csharp
var searchValue = await page.EvalOnSelectorAsync<string>("#search", "el => el.value");
var preloadHref = await page.EvalOnSelectorAsync<string>("link[rel=preload]", "el => el.href");
var html = await page.EvalOnSelectorAsync(".main-container", "(e, suffix) => e.outerHTML + suffix", "hello");
```

Shortcut for main frame's [`method: Frame.evalOnSelector`].

### param: Page.evalOnSelector.selector = %%-query-selector-%%

### param: Page.evalOnSelector.expression = %%-evaluate-expression-%%

### param: Page.evalOnSelector.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: Page.evalOnSelectorAll
* langs:
  - alias-python: eval_on_selector_all
  - alias-js: $$eval
- returns: <[Serializable]>

The method finds all elements matching the specified selector within the page and passes an array of matched elements as
a first argument to [`param: expression`]. Returns the result of [`param: expression`] invocation.

If [`param: expression`] returns a [Promise], then [`method: Page.evalOnSelectorAll`] would wait for the promise to resolve and
return its value.

Examples:

```js
const divCounts = await page.$$eval('div', (divs, min) => divs.length >= min, 10);
```

```java
boolean divCounts = (boolean) page.evalOnSelectorAll("div", "(divs, min) => divs.length >= min", 10);
```

```python async
div_counts = await page.eval_on_selector_all("div", "(divs, min) => divs.length >= min", 10)
```

```python sync
div_counts = page.eval_on_selector_all("div", "(divs, min) => divs.length >= min", 10)
```

```csharp
var divsCount = await page.EvalOnSelectorAllAsync<bool>("div", "(divs, min) => divs.length >= min", 10);
```

### param: Page.evalOnSelectorAll.selector = %%-query-selector-%%

### param: Page.evalOnSelectorAll.expression = %%-evaluate-expression-%%

### param: Page.evalOnSelectorAll.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: Page.evaluate
- returns: <[Serializable]>

Returns the value of the [`param: expression`] invocation.

If the function passed to the [`method: Page.evaluate`] returns a [Promise], then [`method: Page.evaluate`] would wait
for the promise to resolve and return its value.

If the function passed to the [`method: Page.evaluate`] returns a non-[Serializable] value, then
[`method: Page.evaluate`] resolves to `undefined`. Playwright also supports transferring some
additional values that are not serializable by `JSON`: `-0`, `NaN`, `Infinity`, `-Infinity`.

Passing argument to [`param: expression`]:

```js
const result = await page.evaluate(([x, y]) => {
  return Promise.resolve(x * y);
}, [7, 8]);
console.log(result); // prints "56"
```

```java
Object result = page.evaluate("([x, y]) => {\n" +
  "  return Promise.resolve(x * y);\n" +
  "}", Arrays.asList(7, 8));
System.out.println(result); // prints "56"
```

```python async
result = await page.evaluate("([x, y]) => Promise.resolve(x * y)", [7, 8])
print(result) # prints "56"
```

```python sync
result = page.evaluate("([x, y]) => Promise.resolve(x * y)", [7, 8])
print(result) # prints "56"
```

```csharp
var result = await page.EvaluateAsync<int>("([x, y]) => Promise.resolve(x * y)", new[] { 7, 8 });
Console.WriteLine(result);
```

A string can also be passed in instead of a function:

```js
console.log(await page.evaluate('1 + 2')); // prints "3"
const x = 10;
console.log(await page.evaluate(`1 + ${x}`)); // prints "11"
```

```java
System.out.println(page.evaluate("1 + 2")); // prints "3"
```

```python async
print(await page.evaluate("1 + 2")) # prints "3"
x = 10
print(await page.evaluate(f"1 + {x}")) # prints "11"
```

```python sync
print(page.evaluate("1 + 2")) # prints "3"
x = 10
print(page.evaluate(f"1 + {x}")) # prints "11"
```

```csharp
Console.WriteLine(await page.EvaluateAsync<int>("1 + 2")); // prints "3"
```

[ElementHandle] instances can be passed as an argument to the [`method: Page.evaluate`]:

```js
const bodyHandle = await page.$('body');
const html = await page.evaluate(([body, suffix]) => body.innerHTML + suffix, [bodyHandle, 'hello']);
await bodyHandle.dispose();
```

```java
ElementHandle bodyHandle = page.querySelector("body");
String html = (String) page.evaluate("([body, suffix]) => body.innerHTML + suffix", Arrays.asList(bodyHandle, "hello"));
bodyHandle.dispose();
```

```python async
body_handle = await page.query_selector("body")
html = await page.evaluate("([body, suffix]) => body.innerHTML + suffix", [body_handle, "hello"])
await body_handle.dispose()
```

```python sync
body_handle = page.query_selector("body")
html = page.evaluate("([body, suffix]) => body.innerHTML + suffix", [body_handle, "hello"])
body_handle.dispose()
```

```csharp
var bodyHandle = await page.QuerySelectorAsync("body");
var html = await page.EvaluateAsync<string>("([body, suffix]) => body.innerHTML + suffix", new object [] { bodyHandle, "hello" });
await bodyHandle.DisposeAsync();
```

Shortcut for main frame's [`method: Frame.evaluate`].

### param: Page.evaluate.expression = %%-evaluate-expression-%%

### param: Page.evaluate.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: Page.evaluateHandle
- returns: <[JSHandle]>

Returns the value of the [`param: expression`] invocation as a [JSHandle].

The only difference between [`method: Page.evaluate`] and [`method: Page.evaluateHandle`] is that [`method: Page.evaluateHandle`] returns [JSHandle].

If the function passed to the [`method: Page.evaluateHandle`] returns a [Promise], then [`method: Page.evaluateHandle`] would wait for the
promise to resolve and return its value.

```js
const aWindowHandle = await page.evaluateHandle(() => Promise.resolve(window));
aWindowHandle; // Handle for the window object.
```

```java
// Handle for the window object.
JSHandle aWindowHandle = page.evaluateHandle("() => Promise.resolve(window)");
```

```python async
a_window_handle = await page.evaluate_handle("Promise.resolve(window)")
a_window_handle # handle for the window object.
```

```python sync
a_window_handle = page.evaluate_handle("Promise.resolve(window)")
a_window_handle # handle for the window object.
```

```csharp
// Handle for the window object.
var aWindowHandle = await page.EvaluateHandleAsync("() => Promise.resolve(window)");
```

A string can also be passed in instead of a function:

```js
const aHandle = await page.evaluateHandle('document'); // Handle for the 'document'
```

```java
JSHandle aHandle = page.evaluateHandle("document"); // Handle for the "document".
```

```python async
a_handle = await page.evaluate_handle("document") # handle for the "document"
```

```python sync
a_handle = page.evaluate_handle("document") # handle for the "document"
```

```csharp
var docHandle = await page.EvalueHandleAsync("document"); // Handle for the `document`
```

[JSHandle] instances can be passed as an argument to the [`method: Page.evaluateHandle`]:

```js
const aHandle = await page.evaluateHandle(() => document.body);
const resultHandle = await page.evaluateHandle(body => body.innerHTML, aHandle);
console.log(await resultHandle.jsonValue());
await resultHandle.dispose();
```

```java
JSHandle aHandle = page.evaluateHandle("() => document.body");
JSHandle resultHandle = page.evaluateHandle("([body, suffix]) => body.innerHTML + suffix", Arrays.asList(aHandle, "hello"));
System.out.println(resultHandle.jsonValue());
resultHandle.dispose();
```

```python async
a_handle = await page.evaluate_handle("document.body")
result_handle = await page.evaluate_handle("body => body.innerHTML", a_handle)
print(await result_handle.json_value())
await result_handle.dispose()
```

```python sync
a_handle = page.evaluate_handle("document.body")
result_handle = page.evaluate_handle("body => body.innerHTML", a_handle)
print(result_handle.json_value())
result_handle.dispose()
```

```csharp
var handle = await page.EvaluateHandleAsync("() => document.body");
var resultHandle = await page.EvaluateHandleAsync("([body, suffix]) => body.innerHTML + suffix", new object[] { handle, "hello" });
Console.WriteLine(await resultHandle.JsonValueAsync<string>());
await resultHandle.DisposeAsync();
```

### param: Page.evaluateHandle.expression = %%-evaluate-expression-%%

### param: Page.evaluateHandle.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

## async method: Page.exposeBinding

The method adds a function called [`param: name`] on the `window` object of every frame in this page. When called, the
function executes [`param: callback`] and returns a [Promise] which resolves to the return value of [`param: callback`].
If the [`param: callback`] returns a [Promise], it will be awaited.

The first argument of the [`param: callback`] function contains information about the caller: `{ browserContext:
BrowserContext, page: Page, frame: Frame }`.

See [`method: BrowserContext.exposeBinding`] for the context-wide version.

:::note
Functions installed via [`method: Page.exposeBinding`] survive navigations.
:::

An example of exposing page URL to all frames in a page:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.exposeBinding('pageURL', ({ page }) => page.url());
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
      BrowserType webkit = playwright.webkit();
      Browser browser = webkit.launch({ headless: false });
      BrowserContext context = browser.newContext();
      Page page = context.newPage();
      page.exposeBinding("pageURL", (source, args) -> source.page().url());
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
    page = await context.new_page()
    await page.expose_binding("pageURL", lambda source: source["page"].url)
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
    page = context.new_page()
    page.expose_binding("pageURL", lambda source: source["page"].url)
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

class PageExamples
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Webkit.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless: false
        });
        var page = await browser.NewPageAsync();

        await page.ExposeBindingAsync("pageUrl", (source) => source.Page.Url);
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
await page.exposeBinding('clicked', async (source, element) => {
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
page.exposeBinding("clicked", (source, args) -> {
  ElementHandle element = (ElementHandle) args[0];
  System.out.println(element.textContent());
  return null;
}, new Page.ExposeBindingOptions().setHandle(true));
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

await page.expose_binding("clicked", print, handle=true)
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

page.expose_binding("clicked", print, handle=true)
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
await page.ExposeBindingAsync("clicked", async (BindingSource _, IJSHandle t) =>
{
    return result.TrySetResult(await t.AsElement().TextContentAsync());
});

await page.SetContentAsync("<script>\n" +
  "  document.addEventListener('click', event => window.clicked(event.target));\n" +
  "</script>\n" +
  "<div>Click me</div>\n" +
  "<div>Or click me</div>\n");

await page.ClickAsync("div");
Console.WriteLine(await result.Task);
```

### param: Page.exposeBinding.name
- `name` <[string]>

Name of the function on the window object.

### param: Page.exposeBinding.callback
- `callback` <[function]>

Callback function that will be called in the Playwright's context.

### option: Page.exposeBinding.handle
- `handle` <[boolean]>

Whether to pass the argument as a handle, instead of passing by value. When passing a handle, only one argument is
supported. When passing by value, multiple arguments are supported.

## async method: Page.exposeFunction

The method adds a function called [`param: name`] on the `window` object of every frame in the page. When called, the
function executes [`param: callback`] and returns a [Promise] which resolves to the return value of [`param: callback`].

If the [`param: callback`] returns a [Promise], it will be awaited.

See [`method: BrowserContext.exposeFunction`] for context-wide exposed function.

:::note
Functions installed via [`method: Page.exposeFunction`] survive navigations.
:::

An example of adding a `sha256` function to the page:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.
const crypto = require('crypto');

(async () => {
  const browser = await webkit.launch({ headless: false });
  const page = await browser.newPage();
  await page.exposeFunction('sha256', text => crypto.createHash('sha256').update(text).digest('hex'));
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
      BrowserType webkit = playwright.webkit();
      Browser browser = webkit.launch({ headless: false });
      Page page = browser.newPage();
      page.exposeFunction("sha256", args -> {
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
    page = await browser.new_page()
    await page.expose_function("sha256", sha256)
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
    page = browser.new_page()
    page.expose_function("sha256", sha256)
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

class PageExamples
{
    public static async Task Main()
    {
        using var playwright = await Playwright.CreateAsync();
        await using var browser = await playwright.Webkit.LaunchAsync(new BrowserTypeLaunchOptions
        {
            Headless: false
        });
        var page = await browser.NewPageAsync();

        await page.ExposeFunctionAsync("sha256", (string input) =>
        {
            return Convert.ToBase64String(
                SHA256.Create().ComputeHash(System.Text.Encoding.UTF8.GetBytes(input)));
        });

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

### param: Page.exposeFunction.name
- `name` <[string]>

Name of the function on the window object

### param: Page.exposeFunction.callback
- `callback` <[function]>

Callback function which will be called in Playwright's context.

## async method: Page.fill

This method waits for an element matching [`param: selector`], waits for [actionability](./actionability.md) checks, focuses the element, fills it and triggers an `input` event after filling. Note that you can pass an empty string to clear the input field.

If the target element is not an `<input>`, `<textarea>` or `[contenteditable]` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be filled instead.

To send fine-grained keyboard events, use [`method: Page.type`].

Shortcut for main frame's [`method: Frame.fill`].

### param: Page.fill.selector = %%-input-selector-%%

### param: Page.fill.value
- `value` <[string]>

Value to fill for the `<input>`, `<textarea>` or `[contenteditable]` element.

### option: Page.fill.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.fill.timeout = %%-input-timeout-%%

## async method: Page.focus

This method fetches an element with [`param: selector`] and focuses it. If there's no element matching
[`param: selector`], the method waits until a matching element appears in the DOM.

Shortcut for main frame's [`method: Frame.focus`].

### param: Page.focus.selector = %%-input-selector-%%

### option: Page.focus.timeout = %%-input-timeout-%%

## method: Page.frame
- returns: <[null]|[Frame]>

Returns frame matching the specified criteria. Either `name` or `url` must be specified.

```js
const frame = page.frame('frame-name');
```

```java
Frame frame = page.frame("frame-name");
```

```py
frame = page.frame(name="frame-name")
```

```csharp
var frame = page.Frame("frame-name");
```

```js
const frame = page.frame({ url: /.*domain.*/ });
```

```java
Frame frame = page.frameByUrl(Pattern.compile(".*domain.*");
```

```py
frame = page.frame(url=r".*domain.*")
```

```csharp
var frame = page.FrameByUrl(".*domain.*");
```

### param: Page.frame.frameSelector
* langs: js
- `frameSelector` <[string]|[Object]>
  - `name` <[string]> Frame name specified in the `iframe`'s `name` attribute. Optional.
  - `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]> A glob pattern, regex pattern or predicate receiving
    frame's `url` as a [URL] object. Optional.

Frame name or other frame lookup options.

### param: Page.frame.name
* langs: csharp, java
- `name` <[string]>

Frame name specified in the `iframe`'s `name` attribute.

## method: Page.frameByUrl
* langs: csharp, java
- returns: <[null]|[Frame]>

Returns frame with matching URL.

### param: Page.frameByUrl.url
* langs: csharp, java
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving frame's `url` as a [URL] object.

## method: Page.frames
- returns: <[Array]<[Frame]>>

An array of all frames attached to the page.

## async method: Page.getAttribute
- returns: <[null]|[string]>

Returns element attribute value.

### param: Page.getAttribute.selector = %%-input-selector-%%

### param: Page.getAttribute.name
- `name` <[string]>

Attribute name to get the value for.

### option: Page.getAttribute.timeout = %%-input-timeout-%%

## async method: Page.goBack
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect. If can not go back, returns `null`.

Navigate to the previous page in history.

### option: Page.goBack.waitUntil = %%-navigation-wait-until-%%

### option: Page.goBack.timeout = %%-navigation-timeout-%%

## async method: Page.goForward
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect. If can not go forward, returns `null`.

Navigate to the next page in history.

### option: Page.goForward.waitUntil = %%-navigation-wait-until-%%

### option: Page.goForward.timeout = %%-navigation-timeout-%%

## async method: Page.goto
* langs:
  - alias-java: navigate
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect.

`page.goto` will throw an error if:
* there's an SSL error (e.g. in case of self-signed certificates).
* target URL is invalid.
* the [`option: timeout`] is exceeded during navigation.
* the remote server does not respond or is unreachable.
* the main resource failed to load.

`page.goto` will not throw an error when any valid HTTP status code is returned by the remote server, including 404 "Not
Found" and 500 "Internal Server Error".  The status code for such responses can be retrieved by calling
[`method: Response.status`].

:::note
`page.goto` either throws an error or returns a main resource response. The only exceptions are navigation to
`about:blank` or navigation to the same URL with a different hash, which would succeed and return `null`.
:::

:::note
Headless mode doesn't support navigation to a PDF document. See the
[upstream issue](https://bugs.chromium.org/p/chromium/issues/detail?id=761295).
:::

Shortcut for main frame's [`method: Frame.goto`]

### param: Page.goto.url
- `url` <[string]>

URL to navigate page to. The url should include scheme, e.g. `https://`.

### option: Page.goto.waitUntil = %%-navigation-wait-until-%%

### option: Page.goto.timeout = %%-navigation-timeout-%%

### option: Page.goto.referer
- `referer` <[string]>

Referer header value. If provided it will take preference over the referer header value set by
[`method: Page.setExtraHTTPHeaders`].

## async method: Page.hover

This method hovers over an element matching [`param: selector`] by performing the following steps:
1. Find an element matching [`param: selector`]. If there is none, wait until a matching element is attached to
   the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is
   set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to hover over the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless `noWaitAfter` option is set.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

Shortcut for main frame's [`method: Frame.hover`].

### param: Page.hover.selector = %%-input-selector-%%

### option: Page.hover.position = %%-input-position-%%

### option: Page.hover.modifiers = %%-input-modifiers-%%

### option: Page.hover.force = %%-input-force-%%

### option: Page.hover.timeout = %%-input-timeout-%%

### option: Page.hover.trial = %%-input-trial-%%

## async method: Page.innerHTML
- returns: <[string]>

Returns `element.innerHTML`.

### param: Page.innerHTML.selector = %%-input-selector-%%

### option: Page.innerHTML.timeout = %%-input-timeout-%%

## async method: Page.innerText
- returns: <[string]>

Returns `element.innerText`.

### param: Page.innerText.selector = %%-input-selector-%%

### option: Page.innerText.timeout = %%-input-timeout-%%

## async method: Page.isChecked
- returns: <[boolean]>

Returns whether the element is checked. Throws if the element is not a checkbox or radio input.

### param: Page.isChecked.selector = %%-input-selector-%%

### option: Page.isChecked.timeout = %%-input-timeout-%%

## method: Page.isClosed
- returns: <[boolean]>

Indicates that the page has been closed.

## async method: Page.isDisabled
- returns: <[boolean]>

Returns whether the element is disabled, the opposite of [enabled](./actionability.md#enabled).

### param: Page.isDisabled.selector = %%-input-selector-%%

### option: Page.isDisabled.timeout = %%-input-timeout-%%

## async method: Page.isEditable
- returns: <[boolean]>

Returns whether the element is [editable](./actionability.md#editable).

### param: Page.isEditable.selector = %%-input-selector-%%

### option: Page.isEditable.timeout = %%-input-timeout-%%

## async method: Page.isEnabled
- returns: <[boolean]>

Returns whether the element is [enabled](./actionability.md#enabled).

### param: Page.isEnabled.selector = %%-input-selector-%%

### option: Page.isEnabled.timeout = %%-input-timeout-%%

## async method: Page.isHidden
- returns: <[boolean]>

Returns whether the element is hidden, the opposite of [visible](./actionability.md#visible).  [`option: selector`] that does not match any elements is considered hidden.

### param: Page.isHidden.selector = %%-input-selector-%%

### option: Page.isHidden.timeout = %%-input-timeout-%%

## async method: Page.isVisible
- returns: <[boolean]>

Returns whether the element is [visible](./actionability.md#visible). [`option: selector`] that does not match any elements is considered not visible.

### param: Page.isVisible.selector = %%-input-selector-%%

### option: Page.isVisible.timeout = %%-input-timeout-%%

## property: Page.keyboard
- type: <[Keyboard]>

## method: Page.mainFrame
- returns: <[Frame]>

The page's main frame. Page is guaranteed to have a main frame which persists during navigations.

## property: Page.mouse
- type: <[Mouse]>

## async method: Page.opener
- returns: <[null]|[Page]>

Returns the opener for popup pages and `null` for others. If the opener has been closed already the returns `null`.

## async method: Page.pause

Pauses script execution. Playwright will stop executing the script and wait for the user to either press 'Resume'
button in the page overlay or to call `playwright.resume()` in the DevTools console.

User can inspect selectors or perform manual steps while paused. Resume will continue running the original script from
the place it was paused.

:::note
This method requires Playwright to be started in a headed mode, with a falsy [`option: headless`] value in
the [`method: BrowserType.launch`].
:::

## async method: Page.pdf
- returns: <[Buffer]>

Returns the PDF buffer.

:::note
Generating a pdf is currently only supported in Chromium headless.
:::

`page.pdf()` generates a pdf of the page with `print` css media. To generate a pdf with `screen` media, call
[`method: Page.emulateMedia`] before calling `page.pdf()`:

:::note
By default, `page.pdf()` generates a pdf with modified colors for printing. Use the
[`-webkit-print-color-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-print-color-adjust) property to
force rendering of exact colors.
:::

```js
// Generates a PDF with 'screen' media type.
await page.emulateMedia({media: 'screen'});
await page.pdf({path: 'page.pdf'});
```

```java
// Generates a PDF with "screen" media type.
page.emulateMedia(new Page.EmulateMediaOptions().setMedia(Media.SCREEN));
page.pdf(new Page.PdfOptions().setPath(Paths.get("page.pdf")));
```

```python async
# generates a pdf with "screen" media type.
await page.emulate_media(media="screen")
await page.pdf(path="page.pdf")
```

```python sync
# generates a pdf with "screen" media type.
page.emulate_media(media="screen")
page.pdf(path="page.pdf")
```

```csharp
// Generates a PDF with 'screen' media type
await page.EmulateMediaAsync(new PageEmulateMediaOptions { Media = Media.Screen });
await page.PdfAsync(new PagePdfOptions { Path = "page.pdf" });
```

The [`option: width`], [`option: height`], and [`option: margin`] options accept values labeled with units. Unlabeled
values are treated as pixels.

A few examples:
* `page.pdf({width: 100})` - prints with width set to 100 pixels
* `page.pdf({width: '100px'})` - prints with width set to 100 pixels
* `page.pdf({width: '10cm'})` - prints with width set to 10 centimeters.

All possible units are:
* `px` - pixel
* `in` - inch
* `cm` - centimeter
* `mm` - millimeter

The [`option: format`] options are:
* `Letter`: 8.5in x 11in
* `Legal`: 8.5in x 14in
* `Tabloid`: 11in x 17in
* `Ledger`: 17in x 11in
* `A0`: 33.1in x 46.8in
* `A1`: 23.4in x 33.1in
* `A2`: 16.54in x 23.4in
* `A3`: 11.7in x 16.54in
* `A4`: 8.27in x 11.7in
* `A5`: 5.83in x 8.27in
* `A6`: 4.13in x 5.83in

:::note
[`option: headerTemplate`] and [`option: footerTemplate`] markup have the following limitations: > 1. Script tags inside
templates are not evaluated. > 2. Page styles are not visible inside templates.
:::

### option: Page.pdf.path
- `path` <[path]>

The file path to save the PDF to. If [`option: path`] is a relative path, then it is resolved relative to the current
working directory. If no path is provided, the PDF won't be saved to the disk.

### option: Page.pdf.scale
- `scale` <[float]>

Scale of the webpage rendering. Defaults to `1`. Scale amount must be between 0.1 and 2.

### option: Page.pdf.displayHeaderFooter
- `displayHeaderFooter` <[boolean]>

Display header and footer. Defaults to `false`.

### option: Page.pdf.headerTemplate
- `headerTemplate` <[string]>

HTML template for the print header. Should be valid HTML markup with following classes used to inject printing values
into them:
* `'date'` formatted print date
* `'title'` document title
* `'url'` document location
* `'pageNumber'` current page number
* `'totalPages'` total pages in the document

### option: Page.pdf.footerTemplate
- `footerTemplate` <[string]>

HTML template for the print footer. Should use the same format as the [`option: headerTemplate`].

### option: Page.pdf.printBackground
- `printBackground` <[boolean]>

Print background graphics. Defaults to `false`.

### option: Page.pdf.landscape
- `landscape` <[boolean]>

Paper orientation. Defaults to `false`.

### option: Page.pdf.pageRanges
- `pageRanges` <[string]>

Paper ranges to print, e.g., '1-5, 8, 11-13'. Defaults to the empty string, which means print all pages.

### option: Page.pdf.format
- `format` <[string]>

Paper format. If set, takes priority over [`option: width`] or [`option: height`] options. Defaults to 'Letter'.

### option: Page.pdf.width
* langs: js, python
- `width` <[string]|[float]>

Paper width, accepts values labeled with units.

### option: Page.pdf.width
* langs: csharp, java
- `width` <[string]>

Paper width, accepts values labeled with units.

### option: Page.pdf.height
* langs: js, python
- `height` <[string]|[float]>

Paper height, accepts values labeled with units.

### option: Page.pdf.height
* langs: csharp, java
- `height` <[string]>

Paper height, accepts values labeled with units.

### option: Page.pdf.margin
* langs: js, python
- `margin` <[Object]>
  - `top` <[string]|[float]> Top margin, accepts values labeled with units. Defaults to `0`.
  - `right` <[string]|[float]> Right margin, accepts values labeled with units. Defaults to `0`.
  - `bottom` <[string]|[float]> Bottom margin, accepts values labeled with units. Defaults to `0`.
  - `left` <[string]|[float]> Left margin, accepts values labeled with units. Defaults to `0`.

Paper margins, defaults to none.

### option: Page.pdf.margin
* langs: csharp, java
- `margin` <[Object]>
  - `top` <[string]> Top margin, accepts values labeled with units. Defaults to `0`.
  - `right` <[string]> Right margin, accepts values labeled with units. Defaults to `0`.
  - `bottom` <[string]> Bottom margin, accepts values labeled with units. Defaults to `0`.
  - `left` <[string]> Left margin, accepts values labeled with units. Defaults to `0`.

Paper margins, defaults to none.

### option: Page.pdf.preferCSSPageSize
- `preferCSSPageSize` <[boolean]>

Give any CSS `@page` size declared in the page priority over what is declared in [`option: width`] and
[`option: height`] or [`option: format`] options. Defaults to `false`, which will scale the content to fit the paper
size.

## async method: Page.press

Focuses the element, and then uses [`method: Keyboard.down`] and [`method: Keyboard.up`].

[`param: key`] can specify the intended
[keyboardEvent.key](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key) value or a single character to
generate the text for. A superset of the [`param: key`] values can be found
[here](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key/Key_Values). Examples of the keys are:

`F1` - `F12`, `Digit0`- `Digit9`, `KeyA`- `KeyZ`, `Backquote`, `Minus`, `Equal`, `Backslash`, `Backspace`, `Tab`,
`Delete`, `Escape`, `ArrowDown`, `End`, `Enter`, `Home`, `Insert`, `PageDown`, `PageUp`, `ArrowRight`, `ArrowUp`, etc.

Following modification shortcuts are also supported: `Shift`, `Control`, `Alt`, `Meta`, `ShiftLeft`.

Holding down `Shift` will type the text that corresponds to the [`param: key`] in the upper case.

If [`param: key`] is a single character, it is case-sensitive, so the values `a` and `A` will generate different
respective texts.

Shortcuts such as `key: "Control+o"` or `key: "Control+Shift+T"` are supported as well. When specified with the
modifier, modifier is pressed and being held while the subsequent key is being pressed.

```js
const page = await browser.newPage();
await page.goto('https://keycode.info');
await page.press('body', 'A');
await page.screenshot({ path: 'A.png' });
await page.press('body', 'ArrowLeft');
await page.screenshot({ path: 'ArrowLeft.png' });
await page.press('body', 'Shift+O');
await page.screenshot({ path: 'O.png' });
await browser.close();
```

```java
Page page = browser.newPage();
page.navigate("https://keycode.info");
page.press("body", "A");
page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("A.png")));
page.press("body", "ArrowLeft");
page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("ArrowLeft.png" )));
page.press("body", "Shift+O");
page.screenshot(new Page.ScreenshotOptions().setPath(Paths.get("O.png" )));
```

```python async
page = await browser.new_page()
await page.goto("https://keycode.info")
await page.press("body", "A")
await page.screenshot(path="a.png")
await page.press("body", "ArrowLeft")
await page.screenshot(path="arrow_left.png")
await page.press("body", "Shift+O")
await page.screenshot(path="o.png")
await browser.close()
```

```python sync
page = browser.new_page()
page.goto("https://keycode.info")
page.press("body", "A")
page.screenshot(path="a.png")
page.press("body", "ArrowLeft")
page.screenshot(path="arrow_left.png")
page.press("body", "Shift+O")
page.screenshot(path="o.png")
browser.close()
```

```csharp
var page = await browser.NewPageAsync();
await page.GotoAsync("https://keycode.info");
await page.PressAsync("body", "A");
await page.ScreenshotAsync(new PageScreenshotOptions { Path = "A.png" });
await page.PressAsync("body", "ArrowLeft");
await page.ScreenshotAsync(new PageScreenshotOptions { Path = "ArrowLeft.png" });
await page.PressAsync("body", "Shift+O");
await page.ScreenshotAsync(new PageScreenshotOptions { Path = "O.png" });
```

### param: Page.press.selector = %%-input-selector-%%

### param: Page.press.key
- `key` <[string]>

Name of the key to press or a character to generate, such as `ArrowLeft` or `a`.

### option: Page.press.delay
- `delay` <[float]>

Time to wait between `keydown` and `keyup` in milliseconds. Defaults to 0.

### option: Page.press.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.press.timeout = %%-input-timeout-%%

## async method: Page.querySelector
* langs:
  - alias-python: query_selector
  - alias-js: $
- returns: <[null]|[ElementHandle]>

The method finds an element matching the specified selector within the page. If no elements match the selector, the
return value resolves to `null`. To wait for an element on the page, use [`method: Page.waitForSelector`].

Shortcut for main frame's [`method: Frame.querySelector`].

### param: Page.querySelector.selector = %%-query-selector-%%

## async method: Page.querySelectorAll
* langs:
  - alias-python: query_selector_all
  - alias-js: $$
- returns: <[Array]<[ElementHandle]>>

The method finds all elements matching the specified selector within the page. If no elements match the selector, the
return value resolves to `[]`.

Shortcut for main frame's [`method: Frame.querySelectorAll`].

### param: Page.querySelectorAll.selector = %%-query-selector-%%

## async method: Page.reload
- returns: <[null]|[Response]>

Returns the main resource response. In case of multiple redirects, the navigation will resolve with the response of the
last redirect.

### option: Page.reload.waitUntil = %%-navigation-wait-until-%%

### option: Page.reload.timeout = %%-navigation-timeout-%%

## async method: Page.route

Routing provides the capability to modify network requests that are made by a page.

Once routing is enabled, every request matching the url pattern will stall unless it's continued, fulfilled or aborted.

:::note
The handler will only be called for the first url if the response is a redirect.
:::

An example of a naive handler that aborts all image requests:

```js
const page = await browser.newPage();
await page.route('**/*.{png,jpg,jpeg}', route => route.abort());
await page.goto('https://example.com');
await browser.close();
```

```java
Page page = browser.newPage();
page.route("**/*.{png,jpg,jpeg}", route -> route.abort());
page.navigate("https://example.com");
browser.close();
```

```python async
page = await browser.new_page()
await page.route("**/*.{png,jpg,jpeg}", lambda route: route.abort())
await page.goto("https://example.com")
await browser.close()
```

```python sync
page = browser.new_page()
page.route("**/*.{png,jpg,jpeg}", lambda route: route.abort())
page.goto("https://example.com")
browser.close()
```

```csharp
var page = await browser.NewPageAsync();
await page.RouteAsync("**/*.{png,jpg,jpeg}", async r => await r.AbortAsync());
await page.GotoAsync("https://www.microsoft.com");
```

or the same snippet using a regex pattern instead:

```js
const page = await browser.newPage();
await page.route(/(\.png$)|(\.jpg$)/, route => route.abort());
await page.goto('https://example.com');
await browser.close();
```

```java
Page page = browser.newPage();
page.route(Pattern.compile("(\\.png$)|(\\.jpg$)"),route -> route.abort());
page.navigate("https://example.com");
browser.close();
```

```python async
page = await browser.new_page()
await page.route(re.compile(r"(\.png$)|(\.jpg$)"), lambda route: route.abort())
await page.goto("https://example.com")
await browser.close()
```

```python sync
page = browser.new_page()
page.route(re.compile(r"(\.png$)|(\.jpg$)"), lambda route: route.abort())
page.goto("https://example.com")
browser.close()
```

```csharp
var page = await browser.NewPageAsync();
await page.RouteAsync(new Regex("(\\.png$)|(\\.jpg$)"), async r => await r.AbortAsync());
await page.GotoAsync("https://www.microsoft.com");
```

It is possible to examine the request to decide the route action. For example, mocking all requests that contain some post data, and leaving all other requests as is:

```js
await page.route('/api/**', route => {
  if (route.request().postData().includes('my-string'))
    route.fulfill({ body: 'mocked-data' });
  else
    route.continue();
});
```

```java
page.route("/api/**", route -> {
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
await page.route("/api/**", handle_route)
```

```python sync
def handle_route(route):
  if ("my-string" in route.request.post_data)
    route.fulfill(body="mocked-data")
  else
    route.continue_()
page.route("/api/**", handle_route)
```

```csharp
await page.RouteAsync("/api/**", async r =>
{
  if (r.Request.PostData.Contains("my-string"))
      await r.FulfillAsync(new RouteFulfillOptions { Body = "mocked-data" });
  else
      await r.ContinueAsync();
});
```

Page routes take precedence over browser context routes (set up with [`method: BrowserContext.route`]) when request
matches both handlers.

To remove a route with its handler you can use [`method: Page.unroute`].

:::note
Enabling routing disables http cache.
:::

### param: Page.route.url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while routing.

### param: Page.route.handler
* langs: js, python
- `handler` <[function]\([Route], [Request]\)>

handler function to route the request.

### param: Page.route.handler
* langs: csharp, java
- `handler` <[function]\([Route]\)>

handler function to route the request.

## async method: Page.screenshot
- returns: <[Buffer]>

Returns the buffer with the captured screenshot.

### option: Page.screenshot.path
- `path` <[path]>

The file path to save the image to. The screenshot type will be inferred from file extension. If [`option: path`] is a
relative path, then it is resolved relative to the current working directory. If no path is provided, the image won't be
saved to the disk.

### option: Page.screenshot.type = %%-screenshot-type-%%

### option: Page.screenshot.quality
- `quality` <[int]>

The quality of the image, between 0-100. Not applicable to `png` images.

### option: Page.screenshot.fullPage
- `fullPage` <[boolean]>

When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to
`false`.

### option: Page.screenshot.clip
- `clip` <[Object]>
  - `x` <[float]> x-coordinate of top-left corner of clip area
  - `y` <[float]> y-coordinate of top-left corner of clip area
  - `width` <[float]> width of clipping area
  - `height` <[float]> height of clipping area

An object which specifies clipping of the resulting image. Should have the following fields:

### option: Page.screenshot.omitBackground
- `omitBackground` <[boolean]>

Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images.
Defaults to `false`.

### option: Page.screenshot.timeout = %%-input-timeout-%%

## async method: Page.selectOption
- returns: <[Array]<[string]>>

This method waits for an element matching [`param: selector`], waits for [actionability](./actionability.md) checks, waits until all specified options are present in the `<select>` element and selects these options.

If the target element is not a `<select>` element, this method throws an error. However, if the element is inside the `<label>` element that has an associated [control](https://developer.mozilla.org/en-US/docs/Web/API/HTMLLabelElement/control), the control will be used instead.

Returns the array of option values that have been successfully selected.

Triggers a `change` and `input` event once all the provided options have been selected.

```js
// single selection matching the value
page.selectOption('select#colors', 'blue');

// single selection matching the label
page.selectOption('select#colors', { label: 'Blue' });

// multiple selection
page.selectOption('select#colors', ['red', 'green', 'blue']);

```

```java
// single selection matching the value
page.selectOption("select#colors", "blue");
// single selection matching both the value and the label
page.selectOption("select#colors", new SelectOption().setLabel("Blue"));
// multiple selection
page.selectOption("select#colors", new String[] {"red", "green", "blue"});
```

```python async
# single selection matching the value
await page.select_option("select#colors", "blue")
# single selection matching the label
await page.select_option("select#colors", label="blue")
# multiple selection
await page.select_option("select#colors", value=["red", "green", "blue"])
```

```python sync
# single selection matching the value
page.select_option("select#colors", "blue")
# single selection matching both the label
page.select_option("select#colors", label="blue")
# multiple selection
page.select_option("select#colors", value=["red", "green", "blue"])
```

```csharp
// single selection matching the value
await page.SelectOptionAsync("select#colors", new[] { "blue" });
// single selection matching both the value and the label
await page.SelectOptionAsync("select#colors", new[] { new SelectOptionValue() { Label = "blue" } });
// multiple 
await page.SelectOptionAsync("select#colors", new[] { "red", "green", "blue" });
```

Shortcut for main frame's [`method: Frame.selectOption`].

### param: Page.selectOption.selector = %%-input-selector-%%

### param: Page.selectOption.values = %%-select-options-values-%%

### option: Page.selectOption.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.selectOption.timeout = %%-input-timeout-%%

## async method: Page.setContent

### param: Page.setContent.html
- `html` <[string]>

HTML markup to assign to the page.

### option: Page.setContent.timeout = %%-navigation-timeout-%%

### option: Page.setContent.waitUntil = %%-navigation-wait-until-%%

## method: Page.setDefaultNavigationTimeout

This setting will change the default maximum navigation time for the following methods and related shortcuts:
* [`method: Page.goBack`]
* [`method: Page.goForward`]
* [`method: Page.goto`]
* [`method: Page.reload`]
* [`method: Page.setContent`]
* [`method: Page.waitForNavigation`]
* [`method: Page.waitForURL`]

:::note
[`method: Page.setDefaultNavigationTimeout`] takes priority over [`method: Page.setDefaultTimeout`],
[`method: BrowserContext.setDefaultTimeout`] and [`method: BrowserContext.setDefaultNavigationTimeout`].
:::

### param: Page.setDefaultNavigationTimeout.timeout
- `timeout` <[float]>

Maximum navigation time in milliseconds

## method: Page.setDefaultTimeout

This setting will change the default maximum time for all the methods accepting [`param: timeout`] option.

:::note
[`method: Page.setDefaultNavigationTimeout`] takes priority over [`method: Page.setDefaultTimeout`].
:::

### param: Page.setDefaultTimeout.timeout
- `timeout` <[float]>

Maximum time in milliseconds

## async method: Page.setExtraHTTPHeaders

The extra HTTP headers will be sent with every request the page initiates.

:::note
[`method: Page.setExtraHTTPHeaders`] does not guarantee the order of headers in the outgoing requests.
:::

### param: Page.setExtraHTTPHeaders.headers
- `headers` <[Object]<[string], [string]>>

An object containing additional HTTP headers to be sent with every request. All header values must be strings.

## async method: Page.setInputFiles

This method expects [`param: selector`] to point to an
[input element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input).

Sets the value of the file input to these file paths or files. If some of the `filePaths` are relative paths, then they
are resolved relative to the the current working directory. For empty array, clears the selected files.

### param: Page.setInputFiles.selector = %%-input-selector-%%

### param: Page.setInputFiles.files = %%-input-files-%%

### option: Page.setInputFiles.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.setInputFiles.timeout = %%-input-timeout-%%

## async method: Page.setViewportSize

In the case of multiple pages in a single browser, each page can have its own viewport size. However,
[`method: Browser.newContext`] allows to set viewport size (and more) for all pages in the context at once.

`page.setViewportSize` will resize the page. A lot of websites don't expect phones to change size, so you should set the
viewport size before navigating to the page.

```js
const page = await browser.newPage();
await page.setViewportSize({
  width: 640,
  height: 480,
});
await page.goto('https://example.com');
```

```java
Page page = browser.newPage();
page.setViewportSize(640, 480);
page.navigate("https://example.com");
```

```python async
page = await browser.new_page()
await page.set_viewport_size({"width": 640, "height": 480})
await page.goto("https://example.com")
```

```python sync
page = browser.new_page()
page.set_viewport_size({"width": 640, "height": 480})
page.goto("https://example.com")
```

```csharp
var page = await browser.NewPageAsync();
await page.SetViewportSizeAsync(640, 480);
await page.GotoAsync("https://www.microsoft.com");
```

### param: Page.setViewportSize.viewportSize
* langs: js, python
- `viewportSize` <[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

### param: Page.setViewportSize.width
* langs: csharp, java
- `width` <[int]> page width in pixels.

### param: Page.setViewportSize.height
* langs: csharp, java
- `height` <[int]> page height in pixels.

## async method: Page.tap

This method taps an element matching [`param: selector`] by performing the following steps:
1. Find an element matching [`param: selector`]. If there is none, wait until a matching element is attached to
   the DOM.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is
   set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.touchscreen`] to tap the center of the element, or the specified [`option: position`].
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

:::note
[`method: Page.tap`] requires that the [`option: hasTouch`] option of the browser context be set to true.
:::

Shortcut for main frame's [`method: Frame.tap`].

### param: Page.tap.selector = %%-input-selector-%%

### option: Page.tap.position = %%-input-position-%%

### option: Page.tap.modifiers = %%-input-modifiers-%%

### option: Page.tap.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.tap.force = %%-input-force-%%

### option: Page.tap.timeout = %%-input-timeout-%%

### option: Page.tap.trial = %%-input-trial-%%

## async method: Page.textContent
- returns: <[null]|[string]>

Returns `element.textContent`.

### param: Page.textContent.selector = %%-input-selector-%%

### option: Page.textContent.timeout = %%-input-timeout-%%

## async method: Page.title
- returns: <[string]>

Returns the page's title. Shortcut for main frame's [`method: Frame.title`].

## property: Page.touchscreen
- type: <[Touchscreen]>

## async method: Page.type

Sends a `keydown`, `keypress`/`input`, and `keyup` event for each character in the text. `page.type` can be used to send
fine-grained keyboard events. To fill values in form fields, use [`method: Page.fill`].

To press a special key, like `Control` or `ArrowDown`, use [`method: Keyboard.press`].

```js
await page.type('#mytextarea', 'Hello'); // Types instantly
await page.type('#mytextarea', 'World', {delay: 100}); // Types slower, like a user
```

```java
// Types instantly
page.type("#mytextarea", "Hello");
// Types slower, like a user
page.type("#mytextarea", "World", new Page.TypeOptions().setDelay(100));
```

```python async
await page.type("#mytextarea", "hello") # types instantly
await page.type("#mytextarea", "world", delay=100) # types slower, like a user
```

```python sync
page.type("#mytextarea", "hello") # types instantly
page.type("#mytextarea", "world", delay=100) # types slower, like a user
```

```csharp
await page.TypeAsync("#mytextarea", "hello"); // types instantly
await page.TypeAsync("#mytextarea", "world"); // types slower, like a user
```

Shortcut for main frame's [`method: Frame.type`].

### param: Page.type.selector = %%-input-selector-%%

### param: Page.type.text
- `text` <[string]>

A text to type into a focused element.

### option: Page.type.delay
- `delay` <[float]>

Time to wait between key presses in milliseconds. Defaults to 0.

### option: Page.type.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.type.timeout = %%-input-timeout-%%

## async method: Page.uncheck

This method unchecks an element matching [`param: selector`] by performing the following steps:
1. Find an element matching [`param: selector`]. If there is none, wait until a matching element is attached to
   the DOM.
1. Ensure that matched element is a checkbox or a radio input. If not, this method throws. If the element is already
   unchecked, this method returns immediately.
1. Wait for [actionability](./actionability.md) checks on the matched element, unless [`option: force`] option is
   set. If the element is detached during the checks, the whole action is retried.
1. Scroll the element into view if needed.
1. Use [`property: Page.mouse`] to click in the center of the element.
1. Wait for initiated navigations to either succeed or fail, unless [`option: noWaitAfter`] option is set.
1. Ensure that the element is now unchecked. If not, this method throws.

When all steps combined have not finished during the specified [`option: timeout`], this method throws a
[TimeoutError]. Passing zero timeout disables this.

Shortcut for main frame's [`method: Frame.uncheck`].

### param: Page.uncheck.selector = %%-input-selector-%%

### option: Page.uncheck.position = %%-input-position-%%

### option: Page.uncheck.force = %%-input-force-%%

### option: Page.uncheck.noWaitAfter = %%-input-no-wait-after-%%

### option: Page.uncheck.timeout = %%-input-timeout-%%

### option: Page.uncheck.trial = %%-input-trial-%%

## async method: Page.unroute

Removes a route created with [`method: Page.route`]. When [`param: handler`] is not specified, removes all routes for
the [`param: url`].

### param: Page.unroute.url
- `url` <[string]|[RegExp]|[function]\([URL]\):[boolean]>

A glob pattern, regex pattern or predicate receiving [URL] to match while routing.

### param: Page.unroute.handler
* langs: js, python
- `handler` <[function]\([Route], [Request]\)>

Optional handler function to route the request.

### param: Page.unroute.handler
* langs: csharp, java
- `handler` <[function]\([Route]\)>

Optional handler function to route the request.

## method: Page.url
- returns: <[string]>

Shortcut for main frame's [`method: Frame.url`].

## method: Page.video
- returns: <[null]|[Video]>

Video object associated with this page.

## method: Page.viewportSize
- returns: <[null]|[Object]>
  - `width` <[int]> page width in pixels.
  - `height` <[int]> page height in pixels.

## async method: Page.waitForClose
* langs: java
- returns: <[Page]>

Performs action and waits for the Page to close.

### option: Page.waitForClose.timeout = %%-wait-for-event-timeout-%%

## async method: Page.waitForConsoleMessage
* langs: java, python, csharp
  - alias-python: expect_console_message
  - alias-csharp: RunAndWaitForConsoleMessage
- returns: <[ConsoleMessage]>

Performs action and waits for a [ConsoleMessage] to be logged by in the page. If predicate is provided, it passes
[ConsoleMessage] value into the `predicate` function and waits for `predicate(message)` to return a truthy value.
Will throw an error if the page is closed before the [`event: Page.console`] event is fired.

### option: Page.waitForConsoleMessage.predicate =
- `predicate` <[function]\([ConsoleMessage]\):[boolean]>

Receives the [ConsoleMessage] object and resolves to truthy value when the waiting should resolve.

### option: Page.waitForConsoleMessage.timeout = %%-wait-for-event-timeout-%%

## async method: Page.waitForDownload
* langs: java, python, csharp
  - alias-python: expect_download
  - alias-csharp: RunAndWaitForDownload
- returns: <[Download]>

Performs action and waits for a new [Download]. If predicate is provided, it passes
[Download] value into the `predicate` function and waits for `predicate(download)` to return a truthy value.
Will throw an error if the page is closed before the download event is fired.

### option: Page.waitForDownload.predicate =
- `predicate` <[function]\([Download]\):[boolean]>

Receives the [Download] object and resolves to truthy value when the waiting should resolve.

### option: Page.waitForDownload.timeout = %%-wait-for-event-timeout-%%

## async method: Page.waitForEvent
* langs: js, python
  - alias-python: expect_event
- returns: <[any]>

Waits for event to fire and passes its value into the predicate function. Returns when the predicate returns truthy
value. Will throw an error if the page is closed before the event is fired. Returns the event data value.

```js
const [frame, _] = await Promise.all([
  page.waitForEvent('framenavigated'),
  page.click('button')
]);
```

```python async
async with page.expect_event("framenavigated") as event_info:
    await page.click("button")
frame = await event_info.value
```

```python sync
with page.expect_event("framenavigated") as event_info:
    page.click("button")
frame = event_info.value
```

### param: Page.waitForEvent.event = %%-wait-for-event-event-%%

### param: Page.waitForEvent.optionsOrPredicate
* langs: js
- `optionsOrPredicate` <[function]|[Object]>
  - `predicate` <[function]> receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` <[float]> maximum time to wait for in milliseconds. Defaults to `30000` (30 seconds). Pass `0` to
    disable timeout. The default value can be changed by using the [`method: BrowserContext.setDefaultTimeout`].

Either a predicate that receives an event or an options object. Optional.

## async method: Page.waitForFileChooser
* langs: java, python, csharp
  - alias-python: expect_file_chooser
  - alias-csharp: RunAndWaitForFileChooser
- returns: <[FileChooser]>

Performs action and waits for a new [FileChooser] to be created. If predicate is provided, it passes
[FileChooser] value into the `predicate` function and waits for `predicate(fileChooser)` to return a truthy value.
Will throw an error if the page is closed before the file chooser is opened.

### option: Page.waitForFileChooser.predicate =
- `predicate` <[function]\([FileChooser]\):[boolean]>

Receives the [FileChooser] object and resolves to truthy value when the waiting should resolve.

### option: Page.waitForFileChooser.timeout = %%-wait-for-event-timeout-%%

## async method: Page.waitForFunction
- returns: <[JSHandle]>

Returns when the [`param: expression`] returns a truthy value. It resolves to a JSHandle of the truthy value.

The [`method: Page.waitForFunction`] can be used to observe viewport size change:

```js
const { webkit } = require('playwright');  // Or 'chromium' or 'firefox'.

(async () => {
  const browser = await webkit.launch();
  const page = await browser.newPage();
  const watchDog = page.waitForFunction(() => window.innerWidth < 100);
  await page.setViewportSize({width: 50, height: 50});
  await watchDog;
  await browser.close();
})();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType webkit = playwright.webkit();
      Browser browser = webkit.launch();
      Page page = browser.newPage();
      page.setViewportSize(50,  50);
      page.waitForFunction("() => window.innerWidth < 100");
      browser.close();
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    webkit = playwright.webkit
    browser = await webkit.launch()
    page = await browser.new_page()
    await page.evaluate("window.x = 0; setTimeout(() => { window.x = 100 }, 1000);")
    await page.wait_for_function("() => window.x > 0")
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    webkit = playwright.webkit
    browser = webkit.launch()
    page = browser.new_page()
    page.evaluate("window.x = 0; setTimeout(() => { window.x = 100 }, 1000);")
    page.wait_for_function("() => window.x > 0")
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System.Threading.Tasks;

class FrameExamples
{
  public static async Task WaitForFunction()
  {
    using var playwright = await Playwright.CreateAsync();
    await using var browser = await playwright.Webkit.LaunchAsync();
    var page = await browser.NewPageAsync();
    await page.SetViewportSizeAsync(50, 50);
    await page.MainFrame.WaitForFunctionAsync("window.innerWidth < 100");
  }
}
```

To pass an argument to the predicate of [`method: Page.waitForFunction`] function:

```js
const selector = '.foo';
await page.waitForFunction(selector => !!document.querySelector(selector), selector);
```

```java
String selector = ".foo";
page.waitForFunction("selector => !!document.querySelector(selector)", selector);
```

```python async
selector = ".foo"
await page.wait_for_function("selector => !!document.querySelector(selector)", selector)
```

```python sync
selector = ".foo"
page.wait_for_function("selector => !!document.querySelector(selector)", selector)
```

```csharp
var selector = ".foo";
await page.WaitForFunctionAsync("selector => !!document.querySelector(selector)", selector);
```

Shortcut for main frame's [`method: Frame.waitForFunction`].

### param: Page.waitForFunction.expression = %%-evaluate-expression-%%

### param: Page.waitForFunction.arg
- `arg` <[EvaluationArgument]>

Optional argument to pass to [`param: expression`].

### option: Page.waitForFunction.polling = %%-js-python-wait-for-function-polling-%%

### option: Page.waitForFunction.polling = %%-csharp-java-wait-for-function-polling-%%

### option: Page.waitForFunction.timeout = %%-wait-for-timeout-%%

## async method: Page.waitForLoadState

Returns when the required load state has been reached.

This resolves when the page reaches a required load state, `load` by default. The navigation must have been committed
when this method is called. If current document has already reached the required state, resolves immediately.

```js
await page.click('button'); // Click triggers navigation.
await page.waitForLoadState(); // The promise resolves after 'load' event.
```

```java
page.click("button"); // Click triggers navigation.
page.waitForLoadState(); // The promise resolves after "load" event.
```

```python async
await page.click("button") # click triggers navigation.
await page.wait_for_load_state() # the promise resolves after "load" event.
```

```python sync
page.click("button") # click triggers navigation.
page.wait_for_load_state() # the promise resolves after "load" event.
```

```csharp
await page.ClickAsync("button"); // Click triggers navigation.
await page.WaitForLoadStateAsync(); // The promise resolves after 'load' event.
```

```js
const [popup] = await Promise.all([
  page.waitForEvent('popup'),
  page.click('button'), // Click triggers a popup.
])
await popup.waitForLoadState('domcontentloaded'); // The promise resolves after 'domcontentloaded' event.
console.log(await popup.title()); // Popup is ready to use.
```

```java
Page popup = page.waitForPopup(() -> {
  page.click("button"); // Click triggers a popup.
});
popup.waitForLoadState(LoadState.DOMCONTENTLOADED);
System.out.println(popup.title()); // Popup is ready to use.
```

```python async
async with page.expect_popup() as page_info:
    await page.click("button") # click triggers a popup.
popup = await page_info.value
 # Following resolves after "domcontentloaded" event.
await popup.wait_for_load_state("domcontentloaded")
print(await popup.title()) # popup is ready to use.
```

```python sync
with page.expect_popup() as page_info:
    page.click("button") # click triggers a popup.
popup = page_info.value
 # Following resolves after "domcontentloaded" event.
popup.wait_for_load_state("domcontentloaded")
print(popup.title()) # popup is ready to use.
```

```csharp
var popup = await page.RunAndWaitForPopupAsync(async () =>
{
    await page.ClickAsync("button"); // click triggers the popup/
});
await popup.WaitForLoadStateAsync(LoadState.DOMContentLoaded);
Console.WriteLine(await popup.TitleAsync()); // popup is ready to use.
```

Shortcut for main frame's [`method: Frame.waitForLoadState`].

### param: Page.waitForLoadState.state = %%-wait-for-load-state-state-%%

### option: Page.waitForLoadState.timeout = %%-navigation-timeout-%%

## async method: Page.waitForNavigation
* langs:
  * alias-python: expect_navigation
  * alias-csharp: RunAndWaitForNavigation
- returns: <[null]|[Response]>

Waits for the main frame navigation and returns the main resource response. In case of multiple redirects, the navigation
will resolve with the response of the last redirect. In case of navigation to a different anchor or navigation due to
History API usage, the navigation will resolve with `null`.

This resolves when the page navigates to a new URL or reloads. It is useful for when you run code which will indirectly
cause the page to navigate. e.g. The click target has an `onclick` handler that triggers navigation from a `setTimeout`.
Consider this example:

```js
const [response] = await Promise.all([
  page.waitForNavigation(), // The promise resolves after navigation has finished
  page.click('a.delayed-navigation'), // Clicking the link will indirectly cause a navigation
]);
```

```java
// The method returns after navigation has finished
Response response = page.waitForNavigation(() -> {
  page.click("a.delayed-navigation"); // Clicking the link will indirectly cause a navigation
});
```

```python async
async with page.expect_navigation():
    await page.click("a.delayed-navigation") # clicking the link will indirectly cause a navigation
# Resolves after navigation has finished
```

```python sync
with page.expect_navigation():
    page.click("a.delayed-navigation") # clicking the link will indirectly cause a navigation
# Resolves after navigation has finished
```

```csharp
await page.RunAndWaitForNavigationAsync(async () =>
{
    // Clicking the link will indirectly cause a navigation.
    await page.ClickAsync("a.delayed-navigation");
});

// The method continues after navigation has finished
```

:::note
Usage of the [History API](https://developer.mozilla.org/en-US/docs/Web/API/History_API) to change the URL is considered
a navigation.
:::

Shortcut for main frame's [`method: Frame.waitForNavigation`].

### option: Page.waitForNavigation.url = %%-wait-for-navigation-url-%%

### option: Page.waitForNavigation.waitUntil = %%-navigation-wait-until-%%

### option: Page.waitForNavigation.timeout = %%-navigation-timeout-%%

## async method: Page.waitForPopup
* langs: java, python, csharp
  - alias-python: expect_popup
  - alias-csharp: RunAndWaitForPopup
- returns: <[Page]>

Performs action and waits for a popup [Page]. If predicate is provided, it passes
[Popup] value into the `predicate` function and waits for `predicate(page)` to return a truthy value.
Will throw an error if the page is closed before the popup event is fired.

### option: Page.waitForPopup.predicate =
- `predicate` <[function]\([Page]\):[boolean]>

Receives the [Page] object and resolves to truthy value when the waiting should resolve.

### option: Page.waitForPopup.timeout = %%-wait-for-event-timeout-%%

## async method: Page.waitForRequest
* langs:
  * alias-python: expect_request
  * alias-csharp: RunAndWaitForRequest
- returns: <[Request]>

Waits for the matching request and returns it.  See [waiting for event](./events.md#waiting-for-event) for more details about events.

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for the request.
const [request] = await Promise.all([
  // Waits for the next request with the specified url
  page.waitForRequest('https://example.com/resource'),
  // Triggers the request
  page.click('button.triggers-request'),
]);

// Alternative way with a predicate.
const [request] = await Promise.all([
  // Waits for the next request matching some conditions
  page.waitForRequest(request => request.url() === 'https://example.com' && request.method() === 'GET'),
  // Triggers the request
  page.click('button.triggers-request'),
]);
```

```java
// Waits for the next request with the specified url
Request request = page.waitForRequest("https://example.com/resource", () -> {
  // Triggers the request
  page.click("button.triggers-request");
});

// Waits for the next request matching some conditions
Request request = page.waitForRequest(request -> "https://example.com".equals(request.url()) && "GET".equals(request.method()), () -> {
  // Triggers the request
  page.click("button.triggers-request");
});
```

```python async
async with page.expect_request("http://example.com/resource") as first:
    await page.click('button')
first_request = await first.value

# or with a lambda
async with page.expect_request(lambda request: request.url == "http://example.com" and request.method == "get") as second:
    await page.click('img')
second_request = await second.value
```

```python sync
with page.expect_request("http://example.com/resource") as first:
    page.click('button')
first_request = first.value

# or with a lambda
with page.expect_request(lambda request: request.url == "http://example.com" and request.method == "get") as second:
    page.click('img')
second_request = second.value
```

```csharp
// Waits for the next request with the specified url.
await page.RunAndWaitForRequestAsync(async () =>
{
    await page.ClickAsync("button");
}, "http://example.com/resource");

// Alternative way with a predicate.
await page.RunAndWaitForRequestAsync(async () =>
{
    await page.ClickAsync("button");
}, request => request.Url == "https://example.com" && request.Method == "GET");
```

### param: Page.waitForRequest.action = %%-csharp-wait-for-event-action-%%

### param: Page.waitForRequest.urlOrPredicate
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Request]\):[boolean]>

Request URL string, regex or predicate receiving [Request] object.

### param: Page.waitForRequest.urlOrPredicate
* langs: js
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Request]\):[boolean]|[Promise]<[boolean]>>

Request URL string, regex or predicate receiving [Request] object.

### option: Page.waitForRequest.timeout
- `timeout` <[float]>

Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be
changed by using the [`method: Page.setDefaultTimeout`] method.


## async method: Page.waitForRequestFinished
* langs: java, python, csharp
  - alias-python: expect_request_finished
  - alias-csharp: RunAndWaitForRequestFinished
- returns: <[Request]>

Performs action and waits for a [Request] to finish loading. If predicate is provided, it passes
[Request] value into the `predicate` function and waits for `predicate(request)` to return a truthy value.
Will throw an error if the page is closed before the [`event: Page.requestFinished`] event is fired.

### option: Page.waitForRequestFinished.predicate =
- `predicate` <[function]\([Request]\):[boolean]>

Receives the [Request] object and resolves to truthy value when the waiting should resolve.

### option: Page.waitForRequestFinished.timeout = %%-wait-for-event-timeout-%%


## async method: Page.waitForResponse
* langs:
  * alias-python: expect_response
  * alias-csharp: RunAndWaitForResponse
- returns: <[Response]>

Returns the matched response. See [waiting for event](./events.md#waiting-for-event) for more details about events.

```js
// Note that Promise.all prevents a race condition
// between clicking and waiting for the response.
const [response] = await Promise.all([
  // Waits for the next response with the specified url
  page.waitForResponse('https://example.com/resource'),
  // Triggers the response
  page.click('button.triggers-response'),
]);

// Alternative way with a predicate.
const [response] = await Promise.all([
  // Waits for the next response matching some conditions
  page.waitForResponse(response => response.url() === 'https://example.com' && response.status() === 200),
  // Triggers the response
  page.click('button.triggers-response'),
]);
```

```java
// Waits for the next response with the specified url
Response response = page.waitForResponse("https://example.com/resource", () -> {
  // Triggers the response
  page.click("button.triggers-response");
});

// Waits for the next response matching some conditions
Response response = page.waitForResponse(response -> "https://example.com".equals(response.url()) && response.status() == 200, () -> {
  // Triggers the response
  page.click("button.triggers-response");
});
```

```python async
async with page.expect_response("https://example.com/resource") as response_info:
    await page.click("input")
response = response_info.value
return response.ok

# or with a lambda
async with page.expect_response(lambda response: response.url == "https://example.com" and response.status === 200) as response_info:
    await page.click("input")
response = response_info.value
return response.ok
```

```python sync
with page.expect_response("https://example.com/resource") as response_info:
    page.click("input")
response = response_info.value
return response.ok

# or with a lambda
with page.expect_response(lambda response: response.url == "https://example.com" and response.status === 200) as response_info:
    page.click("input")
response = response_info.value
return response.ok
```

```csharp
// Waits for the next response with the specified url.
await page.RunAndWaitForResponseAsync(async () =>
{
    await page.ClickAsync("button.triggers-response");
}, "http://example.com/resource");

// Alternative way with a predicate.
await page.RunAndWaitForResponseAsync(async () =>
{
    await page.ClickAsync("button");
}, response => response.Url == "https://example.com" && response.Status == 200);
```

### param: Page.waitForResponse.action = %%-csharp-wait-for-event-action-%%

### param: Page.waitForResponse.urlOrPredicate
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Response]\):[boolean]>

Request URL string, regex or predicate receiving [Response] object.

### param: Page.waitForResponse.urlOrPredicate
* langs: js
- `urlOrPredicate` <[string]|[RegExp]|[function]\([Response]\):[boolean]|[Promise]<[boolean]>>

Request URL string, regex or predicate receiving [Response] object.

### option: Page.waitForResponse.timeout
- `timeout` <[float]>

Maximum wait time in milliseconds, defaults to 30 seconds, pass `0` to disable the timeout. The default value can be
changed by using the [`method: BrowserContext.setDefaultTimeout`] or [`method: Page.setDefaultTimeout`] methods.

## async method: Page.waitForSelector
- returns: <[null]|[ElementHandle]>

Returns when element specified by selector satisfies [`option: state`] option. Returns `null` if waiting for `hidden` or
`detached`.

Wait for the [`param: selector`] to satisfy [`option: state`] option (either appear/disappear from dom, or become
visible/hidden). If at the moment of calling the method [`param: selector`] already satisfies the condition, the method
will return immediately. If the selector doesn't satisfy the condition for the [`option: timeout`] milliseconds, the
function will throw.

This method works across navigations:

```js
const { chromium } = require('playwright');  // Or 'firefox' or 'webkit'.

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  for (let currentURL of ['https://google.com', 'https://bbc.com']) {
    await page.goto(currentURL);
    const element = await page.waitForSelector('img');
    console.log('Loaded image: ' + await element.getAttribute('src'));
  }
  await browser.close();
})();
```

```java
import com.microsoft.playwright.*;

public class Example {
  public static void main(String[] args) {
    try (Playwright playwright = Playwright.create()) {
      BrowserType chromium = playwright.chromium();
      Browser browser = chromium.launch();
      Page page = browser.newPage();
      for (String currentURL : Arrays.asList("https://google.com", "https://bbc.com")) {
        page.navigate(currentURL);
        ElementHandle element = page.waitForSelector("img");
        System.out.println("Loaded image: " + element.getAttribute("src"));
      }
      browser.close();
    }
  }
}
```

```python async
import asyncio
from playwright.async_api import async_playwright

async def run(playwright):
    chromium = playwright.chromium
    browser = await chromium.launch()
    page = await browser.new_page()
    for current_url in ["https://google.com", "https://bbc.com"]:
        await page.goto(current_url, wait_until="domcontentloaded")
        element = await page.wait_for_selector("img")
        print("Loaded image: " + str(await element.get_attribute("src")))
    await browser.close()

async def main():
    async with async_playwright() as playwright:
        await run(playwright)
asyncio.run(main())
```

```python sync
from playwright.sync_api import sync_playwright

def run(playwright):
    chromium = playwright.chromium
    browser = chromium.launch()
    page = browser.new_page()
    for current_url in ["https://google.com", "https://bbc.com"]:
        page.goto(current_url, wait_until="domcontentloaded")
        element = page.wait_for_selector("img")
        print("Loaded image: " + str(element.get_attribute("src")))
    browser.close()

with sync_playwright() as playwright:
    run(playwright)
```

```csharp
using Microsoft.Playwright;
using System;
using System.Threading.Tasks;

class FrameExamples
{
  public static async Task Images()
  {
      using var playwright = await Playwright.CreateAsync();
      await using var browser = await playwright.Chromium.LaunchAsync();
      var page = await browser.NewPageAsync();

      foreach (var currentUrl in new[] { "https://www.google.com", "https://bbc.com" })
      {
          await page.GotoAsync(currentUrl);
          var element = await page.WaitForSelectorAsync("img");
          Console.WriteLine($"Loaded image: {await element.GetAttributeAsync("src")}");
      }

      await browser.CloseAsync();
  }
}
```

### param: Page.waitForSelector.selector = %%-query-selector-%%

### option: Page.waitForSelector.state = %%-wait-for-selector-state-%%

### option: Page.waitForSelector.timeout = %%-input-timeout-%%

## async method: Page.waitForTimeout

Waits for the given [`param: timeout`] in milliseconds.

Note that `page.waitForTimeout()` should only be used for debugging. Tests using the timer in production are going to be
flaky. Use signals such as network events, selectors becoming visible and others instead.

```js
// wait for 1 second
await page.waitForTimeout(1000);
```

```java
// wait for 1 second
page.waitForTimeout(1000);
```

```python async
# wait for 1 second
await page.wait_for_timeout(1000)
```

```python sync
# wait for 1 second
page.wait_for_timeout(1000)
```

```csharp
// Wait for 1 second
await page.WaitForTimeoutAsync(1000);
```

Shortcut for main frame's [`method: Frame.waitForTimeout`].

### param: Page.waitForTimeout.timeout
- `timeout` <[float]>

A timeout to wait for

## async method: Page.waitForURL

Waits for the main frame to navigate to the given URL.

```js
await page.click('a.delayed-navigation'); // Clicking the link will indirectly cause a navigation
await page.waitForURL('**/target.html');
```

```java
page.click("a.delayed-navigation"); // Clicking the link will indirectly cause a navigation
page.waitForURL("**/target.html");
```

```python async
await page.click("a.delayed-navigation") # clicking the link will indirectly cause a navigation
await page.wait_for_url("**/target.html")
```

```python sync
page.click("a.delayed-navigation") # clicking the link will indirectly cause a navigation
page.wait_for_url("**/target.html")
```

```csharp
await page.ClickAsync("a.delayed-navigation"); // clicking the link will indirectly cause a navigation
await page.WaitForURLAsync("**/target.html");
```

Shortcut for main frame's [`method: Frame.waitForURL`].

### param: Page.waitForURL.url = %%-wait-for-navigation-url-%%
### option: Page.waitForURL.timeout = %%-navigation-timeout-%%
### option: Page.waitForURL.waitUntil = %%-navigation-wait-until-%%

## async method: Page.waitForWebSocket
* langs: java, python, csharp
  - alias-python: expect_websocket
  - alias-csharp: RunAndWaitForWebSocket
- returns: <[WebSocket]>

Performs action and waits for a new [WebSocket]. If predicate is provided, it passes
[WebSocket] value into the `predicate` function and waits for `predicate(webSocket)` to return a truthy value.
Will throw an error if the page is closed before the WebSocket event is fired.

### option: Page.waitForWebSocket.predicate =
- `predicate` <[function]\([WebSocket]\):[boolean]>

Receives the [WebSocket] object and resolves to truthy value when the waiting should resolve.

### option: Page.waitForWebSocket.timeout = %%-wait-for-event-timeout-%%

## async method: Page.waitForWorker
* langs: java, python, csharp
  - alias-python: expect_worker
  - alias-csharp: RunAndWaitForWorker
- returns: <[Worker]>

Performs action and waits for a new [Worker]. If predicate is provided, it passes
[Worker] value into the `predicate` function and waits for `predicate(worker)` to return a truthy value.
Will throw an error if the page is closed before the worker event is fired.

### option: Page.waitForWorker.predicate =
- `predicate` <[function]\([Worker]\):[boolean]>

Receives the [Worker] object and resolves to truthy value when the waiting should resolve.

### option: Page.waitForWorker.timeout = %%-wait-for-event-timeout-%%

## method: Page.workers
- returns: <[Array]<[Worker]>>

This method returns all of the dedicated [WebWorkers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API)
associated with the page.

:::note
This does not contain ServiceWorkers
:::

## async method: Page.waitForEvent2
* langs: python
  - alias-python: wait_for_event
- returns: <[any]>

:::note
In most cases, you should use [`method: Page.waitForEvent`].
:::

Waits for given `event` to fire. If predicate is provided, it passes
event's value into the `predicate` function and waits for `predicate(event)` to return a truthy value.
Will throw an error if the page is closed before the `event` is fired.

### param: Page.waitForEvent2.event = %%-wait-for-event-event-%%
### option: Page.waitForEvent2.predicate = %%-wait-for-event-predicate-%%
### option: Page.waitForEvent2.timeout = %%-wait-for-event-timeout-%%
