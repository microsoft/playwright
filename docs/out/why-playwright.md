---
id: why-playwright
title: "Why Playwright?"
---

Playwright enables fast, reliable and capable automation across all modern browsers. This guide covers those key differentiators to help you decide on the right tool for your automated tests.

- [Support for all browsers](#support-for-all-browsers)
- [Fast and reliable execution](#fast-and-reliable-execution)
- [Powerful automation capabilities](#powerful-automation-capabilities)
- [Integrates with your workflow](#integrates-with-your-workflow)
- [Limitations](#limitations)

## Support for all browsers
* **Test on Chromium, Firefox and WebKit**. Playwright has full API coverage for all modern browsers, including Google Chrome and Microsoft Edge (with [Chromium](https://www.chromium.org/)), Apple Safari (with [WebKit](https://webkit.org/)) and Mozilla Firefox.
* **Cross-platform WebKit testing**. With Playwright, test how your app behaves in Apple Safari with WebKit builds for Windows, Linux and macOS. Test locally and on CI.
* **Test for mobile**. Use [device emulation](./emulation.md) to test your responsive web apps in mobile web browsers.
* **Headless and headful**. Playwright supports headless (without browser UI) and headful (with browser UI) modes for all browsers and all platforms. Headful is great for debugging, and headless is faster and suited for CI/cloud executions.

## Fast and reliable execution
* **Auto-wait APIs**. Playwright interactions [auto-wait for elements](./actionability.md) to be ready. This improves reliability and simplifies test authoring.
* **Timeout-free automation**. Playwright receives browser signals, like network requests, page navigations and page load events to eliminate the need for sleep timeouts that cause flakiness.
* **Lean parallelization with browser contexts**. Reuse a single browser instance for multiple parallelized, isolated execution environments with [browser contexts](core-concepts.md).
* **Resilient element selectors**. Playwright can rely on user-facing strings, like text content and accessibility labels to [select elements](./selectors.md). These strings are more resilient than selectors tightly-coupled to the DOM structure.

## Powerful automation capabilities
* **Multiple domains, pages and frames**. Playwright is an out-of-process automation driver that is not limited by the scope of in-page JavaScript execution and can automate scenarios with [multiple pages](multi-pages.md).
* **Powerful network control**. Playwright introduces context-wide [network interception](./network.md) to stub and mock network requests.
* **Modern web features**. Playwright supports web components through [shadow-piercing selectors](./selectors.md), [geolocation, permissions](./emulation.md), web workers and other modern web APIs. 
* **Capabilities to cover all scenarios**. Support for [file downloads](./network.md) and [uploads](./input.md), out-of-process iframes, native [input events](./input.md), and even [dark mode](./emulation.md).

## Integrates with your workflow
* **One-line installation**. Running `npm i playwright` auto-downloads browser dependencies for your team to be onboarded quickly.
* **TypeScript support**. Playwright ships with built-in types for auto-completion and other benefits.
* **Debugging tools**. Playwright works with the [editor debugger and browser developer tools](./debug.md) to pause execution and inspect the web page.
* **Language bindings**. Playwright is also available in [Python](https://github.com/microsoft/playwright-python) and [C#](https://github.com/microsoft/playwright-sharp). Learn about [supported languages](./languages.md).
* **Deploy tests to CI**. First-party [Docker image](./docker.md) and [GitHub Actions](https://github.com/microsoft/playwright-github-action) to deploy tests to [your preferred CI/CD provider](./ci.md).

## Limitations
* **Legacy Edge and IE11 support**. Playwright does not support legacy Microsoft Edge or IE11 ([deprecation notice](https://techcommunity.microsoft.com/t5/microsoft-365-blog/microsoft-365-apps-say-farewell-to-internet-explorer-11-and/ba-p/1591666)). The new Microsoft Edge (on Chromium) is supported.
* **Java language bindings**: The Playwright API cannot be used in Java or Ruby today. This is a temporary limitation as Playwright is built to support bindings for any language.
* **Test on real mobile devices**: Playwright uses desktop browsers to emulate mobile devices. If you are interested in running on real mobile devices, please [upvote this issue](https://github.com/microsoft/playwright/issues/1122).

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
