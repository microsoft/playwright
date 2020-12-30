<!-- THIS FILE IS NOW GENERATED -->

# Test Runners

With a few lines of code, you can hook up Playwright to your favorite JavaScript
test runner.

<!-- GEN:toc -->
- [Jest / Jasmine](#jest--jasmine)
- [AVA](#ava)
- [Mocha](#mocha)
- [Multiple Browsers](#multiple-browsers)
<!-- GEN:stop -->

<br>

<br>

## Jest / Jasmine

For Jest,
[jest-playwright](https://github.com/playwright-community/jest-playwright) can
be used. However for a light-weight solution, requiring playwright directly
works fine. Jest shares it's syntax with Jasmine, so this applies to Jasmine as
well.

```js
const {chromium} = require('playwright');
const expect = require('expect');
let browser;
let page;
beforeAll(async () => {
  browser = await chromium.launch();
});
afterAll(async () => {
  await browser.close();
});
beforeEach(async () => {
  page = await browser.newPage();
});
afterEach(async () => {
  await page.close();
});

it('should work', async () => {
  await page.goto('https://www.example.com/');
  expect(await page.title()).toBe('Example Domain');
});
```

<br>

## AVA

Tests run concurrently in AVA, so a single page variable cannot be shared
between tests. Instead, create new pages with a macro function.

```js
const {chromium} = require('playwright');
const test = require('ava').default;
const browserPromise = chromium.launch();

async function pageMacro(t, callback) {
  const browser = await browserPromise;
  const page = await browser.newPage();
  try {
    await callback(t, page);
  } finally {
    await page.close();
  }
}

test('should work', pageMacro, async (t, page) => {
  await page.goto('https://www.example.com/');
  t.is(await page.title(), 'Example Domain');
});
```

<br>

## Mocha

Mocha looks very similar to the Jest/Jasmine setup, and functions in the same
way.

```js
const {chromium} = require('playwright');
const assert = require('assert');
let browser;
before(async() => {
  browser = await chromium.launch();
});
after(async () => {
  await browser.close();
});
let page;
beforeEach(async() => {
  page = await browser.newPage();
});
afterEach(async () => {
  await page.close();
});

it('should work', async () => {
  await page.goto('https://www.example.com/');
  assert.equal(await page.title(), 'Example Domain');
});
```

<br>

## Multiple Browsers

These simple examples can be extended to support multiple browsers using an
environment variable.

```js
const {chromium, webkit, firefox} = require('playwright');
const browserName = process.env.BROWSER || 'webkit';
let browser;
beforeAll(async() => {
  browser = await {chromium, webkit, firefox}[browserName].launch();
});
```

Then set `BROWSER=firefox` to run your tests with firefox, or any other browser.
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
