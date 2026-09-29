# class: WebMCP
* since: v1.64
* langs: js

[WebMCP] exposes the tools that a page registers through the experimental [WebMCP](https://webmachinelearning.github.io/webmcp/) browser API, `navigator.modelContext`. It lists the tools across all frames of the page, reports when the set of tools changes, and calls the tools.

Instances are accessed through [`property: Page.webmcp`]. Call [`method: WebMCP.enable`] before using the other methods.

:::note
WebMCP is an experimental browser feature. Chromium enables it with the `--enable-features=WebMCP` launch argument, Firefox with the `dom.modelcontext.enabled` preference. WebKit does not implement it.
:::

Tool names, descriptions, input schemas and results are provided by the page, so treat them as untrusted input.

```js
const browser = await chromium.launch({ args: ['--enable-features=WebMCP'] });
const page = await browser.newPage();
await page.webmcp.enable();
await page.goto('https://example.com');

for (const tool of await page.webmcp.tools())
  console.log(tool.name, tool.description);

const result = await page.webmcp.callTool('add', { a: 2, b: 40 });
```

## event: WebMCP.toolsChanged
* since: v1.64
- argument: <[Array]<[Object]>>
  * alias: WebMCPTool
  - `name` <[string]> Tool name, unique within the frame that registered it.
  - `description` <[string]> Tool description.
  - `inputSchema` ?<[Serializable]> JSON Schema of the tool input, when the page provides one.
  - `annotations` ?<[Object]> Hints the page provides about the tool.
    - `readOnly` ?<[boolean]> The tool does not modify any state.
    - `untrustedContent` ?<[boolean]> The tool output may contain third-party content.
    - `consequential` ?<[boolean]> The tool takes a consequential action, such as placing an order.
  - `frame` <[Frame]> Frame that registered the tool.

Emitted while WebMCP is enabled, whenever the set of tools registered by the page changes, for example when the page registers or unregisters a tool, or when a frame that registered tools navigates away. The argument is the new list of tools, the same one [`method: WebMCP.tools`] returns.

```js
page.webmcp.on('toolschanged', tools => {
  console.log('tools are now', tools.map(tool => tool.name));
});
```

## async method: WebMCP.callTool
* since: v1.64
- returns: <[Serializable]>

Calls a tool registered by the page and returns its result. The result is whatever the tool's `execute` function resolved to, typically an object with a `content` array. A result with `isError: true` is returned as is. The method throws when the tool is not registered or its `execute` function throws.

When the same tool name is registered in several frames, pass [`option: frame`] to pick one.

```js
const result = await page.webmcp.callTool('add', { a: 2, b: 40 });
console.log(result.content[0].text); // "42"
```

### param: WebMCP.callTool.name
* since: v1.64
- `name` <[string]>

Name of the tool, as reported by [`method: WebMCP.tools`].

### param: WebMCP.callTool.input
* since: v1.64
- `input` ?<[Serializable]>

Input for the tool, matching its `inputSchema`. Defaults to an empty object.

### option: WebMCP.callTool.frame
* since: v1.64
- `frame` <[Frame]>

Frame that registered the tool. Required when the same tool name is registered in more than one frame.

### option: WebMCP.callTool.timeout = %%-input-timeout-js-%%
* since: v1.64

## async method: WebMCP.disable
* since: v1.64

Stops tracking the tools that the page registers and stops emitting [`event: WebMCP.toolsChanged`]. Disposing the [Disposable] returned by [`method: WebMCP.enable`] does the same.

## async method: WebMCP.enable
* since: v1.64
- returns: <[Disposable]>

Starts tracking the tools that the page registers, so that [`method: WebMCP.tools`], [`method: WebMCP.callTool`] and [`event: WebMCP.toolsChanged`] work. Throws if the browser was launched without WebMCP support, see the note above for the launch options that enable it. Returns a [Disposable] that disables the tracking again.

Chromium reports tool registrations natively. Firefox does not, so Playwright instruments `navigator.modelContext` in every frame of the page to observe registrations. Tools registered before the call are picked up as well.

```js
await page.webmcp.enable();
await page.goto('https://example.com');
console.log(await page.webmcp.tools());
```

## async method: WebMCP.tools
* since: v1.64
- returns: <[Array]<[Object]>>
  * alias: WebMCPTool
  - `name` <[string]> Tool name, unique within the frame that registered it.
  - `description` <[string]> Tool description.
  - `inputSchema` ?<[Serializable]> JSON Schema of the tool input, when the page provides one.
  - `annotations` ?<[Object]> Hints the page provides about the tool.
    - `readOnly` ?<[boolean]> The tool does not modify any state.
    - `untrustedContent` ?<[boolean]> The tool output may contain third-party content.
    - `consequential` ?<[boolean]> The tool takes a consequential action, such as placing an order.
  - `frame` <[Frame]> Frame that registered the tool.

Returns the tools currently registered by the page, across all of its frames. Tools registered by the main frame come first.

### option: WebMCP.tools.timeout = %%-input-timeout-js-%%
* since: v1.64

## async method: WebMCP.waitForEvent
* since: v1.64
* langs: js
- returns: <[any]>

Waits for the event to fire and passes its value into the predicate function. Returns when the predicate returns a truthy value. Throws if the page is closed before the event is fired. Returns the event data value.

```js
const toolsPromise = page.webmcp.waitForEvent('toolschanged');
await page.getByRole('button', { name: 'Sign in' }).click();
const tools = await toolsPromise;
```

### param: WebMCP.waitForEvent.event = %%-wait-for-event-event-%%
* since: v1.64

### param: WebMCP.waitForEvent.optionsOrPredicate
* since: v1.64
* langs: js
- `optionsOrPredicate` ?<[function]|[Object]>
  - `predicate` <[function]> Receives the event data and resolves to truthy value when the waiting should resolve.
  - `timeout` ?<[float]> Maximum time to wait for in milliseconds. Defaults to `0` - no timeout. The default value can be changed via `actionTimeout` option in the config, or by using the [`method: BrowserContext.setDefaultTimeout`] or [`method: Page.setDefaultTimeout`] methods.

Either a predicate that receives an event or an options object. Optional.

### option: WebMCP.waitForEvent.predicate = %%-wait-for-event-predicate-%%
* since: v1.64

### option: WebMCP.waitForEvent.timeout = %%-wait-for-event-timeout-%%
* since: v1.64

### option: WebMCP.waitForEvent.signal = %%-wait-for-event-signal-%%
* since: v1.64
