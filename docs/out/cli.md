---
id: cli
title: "Command Line Interface"
---

Playwright comes with the command line tools that run via `npx` or as a part of the `npm` scripts.

- [Usage](#usage)
- [Generate code](#generate-code)
- [Open pages](#open-pages)
- [Inspect selectors](#inspect-selectors)
- [Take screenshot](#take-screenshot)
- [Generate PDF](#generate-pdf)
- [Known limitations](#known-limitations)

## Usage

```sh
$ npx playwright --help
```

Running from `package.json` script

```json
{
  "scripts": {
    "help": "playwright --help"
  }
}
```

## Generate code

```sh
$ npx playwright codegen wikipedia.org
```

Run `codegen` and perform actions in the browser. Playwright CLI will generate JavaScript code for the user interactions. `codegen` will attempt to generate resilient text-based selectors.

<img src="https://user-images.githubusercontent.com/284612/92536033-7e7ebe00-f1ed-11ea-9e1a-7cbd912e3391.gif"></img>

### Preserve authenticated state

Run `codegen` with `--save-storage` to save [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) at the end. This is useful to separately record authentication step and reuse it later.

```sh
$ npx playwright --save-storage=auth.json codegen
# Perform authentication and exit.
# auth.json will contain the storage state.
```

Run with `--load-storage` to consume previously loaded storage. This way, all [cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies) and [localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage) will be restored, bringing most web apps to the authenticated state.

```sh
$ npx playwright --load-storage=auth.json open my.web.app
$ npx playwright --load-storage=auth.json codegen my.web.app
# Perform actions in authenticated state.
```

## Open pages

With `open`, you can use Playwright bundled browsers to browse web pages. Playwright provides cross-platform WebKit builds that can be used to reproduce Safari rendering across Windows, Linux and macOS.

```sh
# Open page in Chromium
npx playwright open example.com
```

```sh
# Open page in WebKit
npx playwright wk example.com
```

### Emulate devices

`open` can emulate mobile and tablet devices ([see all devices](https://github.com/microsoft/playwright/blob/master/src/server/deviceDescriptors.ts)).

```sh
# Emulate iPhone 11.
npx playwright --device="iPhone 11" open wikipedia.org
```

### Emulate color scheme and viewport size

```sh
# Emulate screen size and color scheme.
npx playwright --viewport-size=800,600 --color-scheme=dark open twitter.com
```

### Emulate geolocation, language and timezone

```sh
# Emulate timezone, language & location
# Once page opens, click the "my location" button to see geolocation in action
npx playwright --timezone="Europe/Rome" --geolocation="41.890221,12.492348" --lang="it-IT" open maps.google.com
```

## Inspect selectors

During `open` or `codegen`, you can use following API inside the developer tools console of any browser.

<img src="https://user-images.githubusercontent.com/284612/92536317-37dd9380-f1ee-11ea-875d-daf1b206dd56.png"></img>

#### playwright.$(selector)

Query Playwright selector, using the actual Playwright query engine, for example:

```js
> playwright.$('.auth-form >> text=Log in');

<button>Log in</button>
```

#### playwright.$$(selector)

Same as `playwright.$`, but returns all matching elements.

```js
> playwright.$$('li >> text=John')

> [<li>, <li>, <li>, <li>]
```

#### playwright.inspect(selector)

Reveal element in the Elements panel (if DevTools of the respective browser supports it).

```js
> playwright.inspect('text=Log in')
```

#### playwright.selector(element)

Generates selector for the given element.

```js
> playwright.selector($0)

"div[id="glow-ingress-block"] >> text=/.*Hello.*/"
```

## Take screenshot

```sh
# See command help
$ npx playwright screenshot --help
```

```sh
# Wait 3 seconds before capturing a screenshot after page loads ('load' event fires)
npx playwright \
  --device="iPhone 11" \
  --color-scheme=dark \
  screenshot \
    --wait-for-timeout=3000 \
    twitter.com twitter-iphone.png
```

```sh
# Capture a full page screenshot
npx playwright screenshot --full-page en.wikipedia.org wiki-full.png
```

## Generate PDF

PDF generation only works in Headless Chromium.

```sh
# See command help
$ npx playwright pdf https://en.wikipedia.org/wiki/PDF wiki.pdf
```

## Known limitations

Opening WebKit Web Inspector will disconnect Playwright from the browser. In such cases, code generation will stop.

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
