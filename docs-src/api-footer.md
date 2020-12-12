### EvaluationArgument

Playwright evaluation methods like [page.evaluate(pageFunction[, arg])](#pageevaluatepagefunction-arg) take a single optional argument. This argument can be a mix of [Serializable] values and [JSHandle] or [ElementHandle] instances. Handles are automatically converted to the value they represent.

See examples for various scenarios:

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

// Obejct destructuring works. Note that property names must match
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

### Environment Variables

> **NOTE** [playwright-core](https://www.npmjs.com/package/playwright-core) **does not** respect environment variables.

Playwright looks for certain [environment variables](https://en.wikipedia.org/wiki/Environment_variable) to aid its operations.
If Playwright doesn't find them in the environment, a lowercased variant of these variables will be used from the [npm config](https://docs.npmjs.com/cli/config).

- `PLAYWRIGHT_DOWNLOAD_HOST` - overwrite URL prefix that is used to download browsers. Note: this includes protocol and might even include path prefix. By default, Playwright uses `https://storage.googleapis.com` to download Chromium and `https://playwright.azureedge.net` to download Webkit & Firefox. You can also use browser-specific download hosts that superceed the `PLAYWRIGHT_DOWNLOAD_HOST` variable:
  - `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST` - host to specify Chromium downloads
  - `PLAYWRIGHT_FIREFOX_DOWNLOAD_HOST` - host to specify Firefox downloads
  - `PLAYWRIGHT_WEBKIT_DOWNLOAD_HOST` - host to specify Webkit downloads
- `PLAYWRIGHT_BROWSERS_PATH` - specify a shared directory that playwright will use to download browsers and to look for browsers when launching browser instances.
- `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` - set to non-empty value to skip browser downloads altogether.

```sh
# Linux/macOS
# Install browsers to the shared location.
$ PLAYWRIGHT_BROWSERS_PATH=$HOME/playwright-browsers npm install --save-dev playwright
# Use shared location to find browsers.
$ PLAYWRIGHT_BROWSERS_PATH=$HOME/playwright-browsers node playwright-script.js

# Windows
# Install browsers to the shared location.
$ set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\playwright-browsers
$ npm install --save-dev playwright
# Use shared location to find browsers.
$ set PLAYWRIGHT_BROWSERS_PATH=%USERPROFILE%\playwright-browsers
$ node playwright-script.js
```


### Working with selectors

Selector describes an element in the page. It can be used to obtain `ElementHandle` (see [page.$()](#pageselector) for example) or shortcut element operations to avoid intermediate handle (see [page.click()](#pageclickselector-options) for example).

Selector has the following format: `engine=body [>> engine=body]*`. Here `engine` is one of the supported [selector engines](selectors.md) (e.g. `css` or `xpath`), and `body` is a selector body in the format of the particular engine. When multiple `engine=body` clauses are present (separated by `>>`), next one is queried relative to the previous one's result.

Playwright also supports the following CSS extensions:
* `:text("string")` - Matches elements that contain specific text node. Learn more about [text selector](./selectors.md#css-extension-text).
* `:visible` - Matches only visible elements. Learn more about [visible selector](./selectors.md#css-extension-visible).
* `:light(selector)` - Matches in the light DOM only as opposite to piercing open shadow roots. Learn more about [shadow piercing](./selectors.md#shadow-piercing).
<!--
* `:right-of(selector)`, `:left-of(selector)`, `:above(selector)`, `:below(selector)`, `:near(selector)`, `:within(selector)` - Match elements based on their relative position to another element. Learn more about [proximity selectors](./selectors.md#css-extension-proximity).
-->

For convenience, selectors in the wrong format are heuristically converted to the right format:
- selector starting with `//` or `..` is assumed to be `xpath=selector`;
- selector starting and ending with a quote (either `"` or `'`) is assumed to be `text=selector`;
- otherwise selector is assumed to be `css=selector`.

```js
// queries 'div' css selector
const handle = await page.$('css=div');

// queries '//html/body/div' xpath selector
const handle = await page.$('xpath=//html/body/div');

// queries '"foo"' text selector
const handle = await page.$('text="foo"');

// queries 'span' css selector inside the result of '//html/body/div' xpath selector
const handle = await page.$('xpath=//html/body/div >> css=span');

// converted to 'css=div'
const handle = await page.$('div');

// converted to 'xpath=//html/body/div'
const handle = await page.$('//html/body/div');

// converted to 'text="foo"'
const handle = await page.$('"foo"');

// queries '../span' xpath selector starting with the result of 'div' css selector
const handle = await page.$('div >> ../span');

// queries 'span' css selector inside the div handle
const handle = await divHandle.$('css=span');
```

### Working with Chrome Extensions

Playwright can be used for testing Chrome Extensions.

> **NOTE** Extensions in Chrome / Chromium currently only work in non-headless mode.

The following is code for getting a handle to the [background page](https://developer.chrome.com/extensions/background_pages) of an extension whose source is located in `./my-extension`:
```js
const { chromium } = require('playwright');

(async () => {
  const pathToExtension = require('path').join(__dirname, 'my-extension');
  const userDataDir = '/tmp/test-user-data-dir';
  const browserContext = await chromium.launchPersistentContext(userDataDir,{
    headless: false,
    args: [
      `--disable-extensions-except=${pathToExtension}`,
      `--load-extension=${pathToExtension}`
    ]
  });
  const backgroundPage = browserContext.backgroundPages()[0];
  // Test the background page as you would any other page.
  await browserContext.close();
})();
```

> **NOTE** It is not yet possible to test extension popups or content scripts.


[AXNode]: #accessibilitysnapshotoptions "AXNode"
[Accessibility]: #class-accessibility "Accessibility"
[Array]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array "Array"
[Body]: #class-body  "Body"
[BrowserServer]: #class-browserserver  "BrowserServer"
[BrowserContext]: #class-browsercontext  "BrowserContext"
[BrowserType]: #class-browsertype "BrowserType"
[Browser]: #class-browser  "Browser"
[Buffer]: https://nodejs.org/api/buffer.html#buffer_class_buffer "Buffer"
[ChildProcess]: https://nodejs.org/api/child_process.html "ChildProcess"
[ChromiumBrowser]: #class-chromiumbrowser "ChromiumBrowser"
[ChromiumBrowserContext]: #class-chromiumbrowsercontext "ChromiumBrowserContext"
[ChromiumCoverage]: #class-chromiumcoverage "ChromiumCoverage"
[CDPSession]: #class-cdpsession  "CDPSession"
[ConsoleMessage]: #class-consolemessage "ConsoleMessage"
[Dialog]: #class-dialog "Dialog"
[Download]: #class-download "Download"
[ElementHandle]: #class-elementhandle "ElementHandle"
[Element]: https://developer.mozilla.org/en-US/docs/Web/API/element "Element"
[Error]: https://nodejs.org/api/errors.html#errors_class_error "Error"
[EvaluationArgument]: #evaluationargument "Evaluation Argument"
[File]: #class-file "https://developer.mozilla.org/en-US/docs/Web/API/File"
[FileChooser]: #class-filechooser "FileChooser"
[FirefoxBrowser]: #class-firefoxbrowser "FirefoxBrowser"
[Frame]: #class-frame "Frame"
[JSHandle]: #class-jshandle "JSHandle"
[Keyboard]: #class-keyboard "Keyboard"
[Logger]: #class-logger "Logger"
[Map]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Map "Map"
[Mouse]: #class-mouse "Mouse"
[Object]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object "Object"
[Page]: #class-page "Page"
[Playwright]: #class-playwright "Playwright"
[Promise]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise "Promise"
[RegExp]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp
[Request]: #class-request  "Request"
[Response]: #class-response  "Response"
[Route]: #class-route  "Route"
[Selectors]: #class-selectors  "Selectors"
[Serializable]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify#Description "Serializable"
[TimeoutError]: #class-timeouterror "TimeoutError"
[Touchscreen]: #class-touchscreen "Touchscreen"
[UIEvent.detail]: https://developer.mozilla.org/en-US/docs/Web/API/UIEvent/detail "UIEvent.detail"
[URL]: https://nodejs.org/api/url.html
[USKeyboardLayout]: ../src/usKeyboardLayout.ts "USKeyboardLayout"
[UnixTime]: https://en.wikipedia.org/wiki/Unix_time "Unix Time"
[Video]: #class-video "Video"
[WebKitBrowser]: #class-webkitbrowser "WebKitBrowser"
[WebSocket]: #class-websocket "WebSocket"
[Worker]: #class-worker "Worker"
[boolean]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Boolean_type "Boolean"
[function]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function "Function"
[iterator]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Iteration_protocols "Iterator"
[null]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/null
[number]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#Number_type "Number"
[origin]: https://developer.mozilla.org/en-US/docs/Glossary/Origin "Origin"
[selector]: https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Selectors "selector"
[Readable]: https://nodejs.org/api/stream.html#stream_class_stream_readable "Readable"
[string]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Data_structures#String_type "String"
[xpath]: https://developer.mozilla.org/en-US/docs/Web/XPath "xpath"
