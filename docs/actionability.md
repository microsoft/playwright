<!-- THIS FILE IS NOW GENERATED -->

# Actionability

Playwright does a range of actionability checks on the elements before
performing certain actions. These checks ensure that action behaves as expected,
for example Playwright does not click on a disabled button.

Playwright waits until all the relevant actionability checks pass before
performing an action. This means that action will fail with `TimeoutError` if
checks do not pass within the specified `timeout`.

Some actions like `page.click()` support `{force: true}` option that disable
non-essential actionability checks, for example passing `force` to `click()`
method will not check that the target element actually receives click events.

| Actions | Performed checks |
| ------ | ------- |
| `check()`<br>`click()`<br>`dblclick()`<br>`tap()`<br>`uncheck()` | [Visible]<br>[Stable]<br>[Enabled]<br>[Receiving Events]<br>[Attached] |
| `hover()` | [Visible]<br>[Stable]<br>[Receiving Events]<br>[Attached] |
| `fill()` | [Visible]<br>[Enabled]<br>[Editable]<br>[Attached] |
| `dispatchEvent()`<br>`focus()`<br>`press()`<br>`setInputFiles()`<br>`selectOption()`<br>`type()` | [Attached] |
| `scrollIntoViewIfNeeded()`<br>`screenshot()` | [Visible]<br>[Stable]<br>[Attached] |
| `selectText()` | [Visible]<br>[Attached] |
| `getAttribute()`<br>`innerText()`<br>`innerHTML()`<br>`textContent()` | [Attached] |

### Visible

Element is considered visible when it has non-empty bounding box and does not
have `visibility:hidden` computed style. Note that elements of zero size or with
`display:none` are not considered visible.

### Stable

Element is considered stable when it has maintained the same bounding box for at
least two consecutive animation frames.

### Enabled

Element is considered enabled when it is not a `<button>`, `<select>` or
`<input>` with a `disabled` property set.

### Editable

Element is considered editable when it does not have `readonly` property set.

### Receiving events

Element is considered receiving pointer events when it is the hit target of the
pointer event at the action point. For example, when clicking at the point
`(10;10)`, Playwright checks whether some other element (usually an overlay)
will instead capture the click at `(10;10)`.

### Attached

Element is considered attached when it is
[connected](https://developer.mozilla.org/en-US/docs/Web/API/Node/isConnected)
to a Document or a ShadowRoot.

Attached check differs between selector-based and handle-based actions, like
`page.click(selector, options)` as opposite to `elementHandle.click(options)`:
- For selector-based actions, Playwright first waits for an element matching
  `selector` to be attached to the DOM, and then checks that element is still
  attached before performing the action. If element was detached, the action
  is retried from the start.
- For handle-based actions, Playwright throws if the element is not attached.

For example, consider a scenario where Playwright will click `Sign Up` button
regardless of when the `page.click()` call was made:
- page is checking that user name is unique and `Sign Up` button is disabled;
- after checking with the server, the disabled `Sign Up` button is replaced
  with another one that is now enabled.

[Visible]: #visible "Visible"
[Stable]: #stable "Stable"
[Enabled]: #enabled "Enabled"
[Editable]: #editable "Editable"
[Receiving Events]: #receiving-events "Receiving Events"
[Attached]: #attached "Attached"
[Playwright]: api.md#class-playwright "Playwright"
[Browser]: api.md#class-browser "Browser"
[BrowserContext]: api.md#class-browsercontext "BrowserContext"
[Page]: api.md#class-page "Page"
[Frame]: api.md#class-frame "Frame"
[ElementHandle]: api.md#class-elementhandle "ElementHandle"
[JSHandle]: api.md#class-jshandle "JSHandle"
[ConsoleMessage]: api.md#class-consolemessage "ConsoleMessage"
[Dialog]: api.md#class-dialog "Dialog"
[Download]: api.md#class-download "Download"
[Video]: api.md#class-video "Video"
[FileChooser]: api.md#class-filechooser "FileChooser"
[Keyboard]: api.md#class-keyboard "Keyboard"
[Mouse]: api.md#class-mouse "Mouse"
[Touchscreen]: api.md#class-touchscreen "Touchscreen"
[Request]: api.md#class-request "Request"
[Response]: api.md#class-response "Response"
[Selectors]: api.md#class-selectors "Selectors"
[Route]: api.md#class-route "Route"
[WebSocket]: api.md#class-websocket "WebSocket"
[TimeoutError]: api.md#class-timeouterror "TimeoutError"
[Accessibility]: api.md#class-accessibility "Accessibility"
[Worker]: api.md#class-worker "Worker"
[BrowserServer]: api.md#class-browserserver "BrowserServer"
[BrowserType]: api.md#class-browsertype "BrowserType"
[Logger]: api.md#class-logger "Logger"
[ChromiumBrowser]: api.md#class-chromiumbrowser "ChromiumBrowser"
[ChromiumBrowserContext]: api.md#class-chromiumbrowsercontext "ChromiumBrowserContext"
[ChromiumCoverage]: api.md#class-chromiumcoverage "ChromiumCoverage"
[CDPSession]: api.md#class-cdpsession "CDPSession"
[FirefoxBrowser]: api.md#class-firefoxbrowser "FirefoxBrowser"
[WebKitBrowser]: api.md#class-webkitbrowser "WebKitBrowser"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[EvaluationArgument]: #evaluationargument "Evaluation Argument"
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
