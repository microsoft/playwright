# class: WebMCP
* since: v1.64
* langs: js

[WebMCP] exposes the tools that a frame registers through the experimental [WebMCP](https://webmachinelearning.github.io/webmcp/) browser API, `navigator.modelContext`. It lists the tools and calls them.

Instances are accessed through [`property: Frame.webmcp`]. [`property: Page.webmcp`] is the instance of the main frame.

:::note
WebMCP is an experimental browser feature. Chromium enables it with the `--enable-features=WebMCP` launch argument, Firefox with the `dom.modelcontext.enabled` and `dom.modelcontext.testing.enabled` preferences. WebKit does not implement it.
:::

Tool names, descriptions, input schemas and results are provided by the page, so treat them as untrusted input.

```js
const browser = await chromium.launch({ args: ['--enable-features=WebMCP'] });
const page = await browser.newPage();
await page.goto('https://example.com');

for (const tool of await page.webmcp.tools())
  console.log(tool.name, tool.description);

const result = await page.webmcp.callTool('add', { a: 2, b: 40 });
```

## async method: WebMCP.callTool
* since: v1.64
- returns: <[Serializable]>

Calls a tool registered by the frame and returns its result. The result is whatever the tool's `execute` function resolved to, typically an object with a `content` array. A result with `isError: true` is returned as is. The method throws when the tool is not registered or its `execute` function throws.

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

### option: WebMCP.callTool.timeout = %%-input-timeout-js-%%
* since: v1.64

## async method: WebMCP.tools
* since: v1.64
- returns: <[Array]<[Object]>>
  * alias: WebMCPTool
  - `name` <[string]> Tool name, unique within the frame.
  - `description` <[string]> Tool description.
  - `inputSchema` ?<[Serializable]> JSON Schema of the tool input, when the page provides one.
  - `annotations` ?<[Object]> Hints the page provides about the tool.
    - `readOnly` ?<[boolean]> The tool does not modify any state.
    - `untrustedContent` ?<[boolean]> The tool output may contain third-party content.
    - `consequential` ?<[boolean]> The tool takes a consequential action, such as placing an order.

Returns the tools currently registered by the frame. Throws if the browser was launched without WebMCP support, see the note above for the launch options that enable it.

[`property: Page.webmcp`] covers the main frame only, child frames list their tools through their own [`property: Frame.webmcp`].

### option: WebMCP.tools.timeout = %%-input-timeout-js-%%
* since: v1.64
