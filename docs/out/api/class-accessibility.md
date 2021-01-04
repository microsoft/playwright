---
id: class-accessibility
title: "Accessibility"
---


The Accessibility class provides methods for inspecting Chromium's accessibility tree. The accessibility tree is used by assistive technology such as [screen readers](https://en.wikipedia.org/wiki/Screen_reader) or [switches](https://en.wikipedia.org/wiki/Switch_access).

Accessibility is a very platform-specific thing. On different platforms, there are different screen readers that might have wildly different output.

Blink - Chromium's rendering engine - has a concept of "accessibility tree", which is then translated into different platform-specific APIs. Accessibility namespace gives users access to the Blink Accessibility Tree.

Most of the accessibility tree gets filtered out when converting from Blink AX Tree to Platform-specific AX-Tree or by assistive technologies themselves. By default, Playwright tries to approximate this filtering, exposing only the "interesting" nodes of the tree.


- [accessibility.snapshot([options])](api/class-accessibility.md#accessibilitysnapshotoptions)

## accessibility.snapshot([options])
- `options` <[Object]>
  - `interestingOnly` <[boolean]> Prune uninteresting nodes from the tree. Defaults to `true`.
  - `root` <[ElementHandle]> The root DOM element for the snapshot. Defaults to the whole page.
- returns: <[Promise]<[null]|[Object]>>
  - `role` <[string]> The [role](https://www.w3.org/TR/wai-aria/#usage_intro).
  - `name` <[string]> A human readable name for the node.
  - `value` <[string]|[number]> The current value of the node, if applicable.
  - `description` <[string]> An additional human readable description of the node, if applicable.
  - `keyshortcuts` <[string]> Keyboard shortcuts associated with this node, if applicable.
  - `roledescription` <[string]> A human readable alternative to the role, if applicable.
  - `valuetext` <[string]> A description of the current value, if applicable.
  - `disabled` <[boolean]> Whether the node is disabled, if applicable.
  - `expanded` <[boolean]> Whether the node is expanded or collapsed, if applicable.
  - `focused` <[boolean]> Whether the node is focused, if applicable.
  - `modal` <[boolean]> Whether the node is [modal](https://en.wikipedia.org/wiki/Modal_window), if applicable.
  - `multiline` <[boolean]> Whether the node text input supports multiline, if applicable.
  - `multiselectable` <[boolean]> Whether more than one child can be selected, if applicable.
  - `readonly` <[boolean]> Whether the node is read only, if applicable.
  - `required` <[boolean]> Whether the node is required, if applicable.
  - `selected` <[boolean]> Whether the node is selected in its parent node, if applicable.
  - `checked` <[boolean]|"mixed"> Whether the checkbox is checked, or "mixed", if applicable.
  - `pressed` <[boolean]|"mixed"> Whether the toggle button is checked, or "mixed", if applicable.
  - `level` <[number]> The level of a heading, if applicable.
  - `valuemin` <[number]> The minimum value in a node, if applicable.
  - `valuemax` <[number]> The maximum value in a node, if applicable.
  - `autocomplete` <[string]> What kind of autocomplete is supported by a control, if applicable.
  - `haspopup` <[string]> What kind of popup is currently being shown for a node, if applicable.
  - `invalid` <[string]> Whether and in what way this node's value is invalid, if applicable.
  - `orientation` <[string]> Whether the node is oriented horizontally or vertically, if applicable.
  - `children` <[Array]<[Object]>> Child nodes, if any, if applicable.

Captures the current state of the accessibility tree. The returned object represents the root accessible node of the page.

> **NOTE** The Chromium accessibility tree contains nodes that go unused on most platforms and by most screen readers. Playwright will discard them as well for an easier to process tree, unless `interestingOnly` is set to `false`.

An example of dumping the entire accessibility tree:

```js
const snapshot = await page.accessibility.snapshot();
console.log(snapshot);
```

An example of logging the focused node's name:

```js
const snapshot = await page.accessibility.snapshot();
const node = findFocusedNode(snapshot);
console.log(node && node.name);

function findFocusedNode(node) {
  if (node.focused)
    return node;
  for (const child of node.children || []) {
    const foundNode = findFocusedNode(child);
    return foundNode;
  }
  return null;
}
```


[Playwright]: api/class-playwright.md "Playwright"
[Browser]: api/class-browser.md "Browser"
[BrowserContext]: api/class-browsercontext.md "BrowserContext"
[Page]: api/class-page.md "Page"
[Frame]: api/class-frame.md "Frame"
[ElementHandle]: api/class-elementhandle.md "ElementHandle"
[JSHandle]: api/class-jshandle.md "JSHandle"
[ConsoleMessage]: api/class-consolemessage.md "ConsoleMessage"
[Dialog]: api/class-dialog.md "Dialog"
[Download]: api/class-download.md "Download"
[Video]: api/class-video.md "Video"
[FileChooser]: api/class-filechooser.md "FileChooser"
[Keyboard]: api/class-keyboard.md "Keyboard"
[Mouse]: api/class-mouse.md "Mouse"
[Touchscreen]: api/class-touchscreen.md "Touchscreen"
[Request]: api/class-request.md "Request"
[Response]: api/class-response.md "Response"
[Selectors]: api/class-selectors.md "Selectors"
[Route]: api/class-route.md "Route"
[WebSocket]: api/class-websocket.md "WebSocket"
[TimeoutError]: api/class-timeouterror.md "TimeoutError"
[Accessibility]: api/class-accessibility.md "Accessibility"
[Worker]: api/class-worker.md "Worker"
[BrowserServer]: api/class-browserserver.md "BrowserServer"
[BrowserType]: api/class-browsertype.md "BrowserType"
[Logger]: api/class-logger.md "Logger"
[ChromiumBrowser]: api/class-chromiumbrowser.md "ChromiumBrowser"
[ChromiumBrowserContext]: api/class-chromiumbrowsercontext.md "ChromiumBrowserContext"
[ChromiumCoverage]: api/class-chromiumcoverage.md "ChromiumCoverage"
[CDPSession]: api/class-cdpsession.md "CDPSession"
[FirefoxBrowser]: api/class-firefoxbrowser.md "FirefoxBrowser"
[WebKitBrowser]: api/class-webkitbrowser.md "WebKitBrowser"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[Evaluation Argument]: ./core-concepts.md#evaluationargument "Evaluation Argument"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[RegExp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp "RegExp"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[URL]: https://nodejs.org/api/url.html "URL"
[USKeyboardLayout]: ../src/usKeyboardLayout.ts "USKeyboardLayout"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null "null"
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "string"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
