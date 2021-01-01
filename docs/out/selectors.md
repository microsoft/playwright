---
id: selectors
title: "Element selectors"
---

Selectors query elements on the web page for interactions, like [page.click(selector[, options])](api/class-page.md#pageclickselector-options), and to obtain `ElementHandle` through [page.$(selector)](api/class-page.md#pageselector). Built-in selectors auto-pierce [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM).

- [Working with selectors](#working-with-selectors)
- [Syntax](#syntax)
- [Best practices](#best-practices)
- [Examples](#examples)
- [Selector engines](#selector-engines)

## Working with selectors

Selector describes an element in the page. It can be used to obtain `ElementHandle` (see [page.$(selector)](api/class-page.md#pageselector) for example) or shortcut element operations to avoid intermediate handle (see [page.click(selector[, options])](api/class-page.md#pageclickselector-options) for example).

Selector has the following format: `engine=body [>> engine=body]*`. Here `engine` is one of the supported [selector engines](./selectors.md) (e.g. `css` or `xpath`), and `body` is a selector body in the format of the particular engine. When multiple `engine=body` clauses are present (separated by `>>`), next one is queried relative to the previous one's result.

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

## Syntax

Selectors are defined by selector engine name and selector body, `engine=body`.
* `engine` refers to one of the [supported engines](#selector-engines)
  * Built-in selector engines: [css], [text], [xpath] and [id selectors][id]
  * Learn more about [custom selector engines](./extensibility.md)
* `body` refers to the query string for the respective engine
  * For `text`, body is the text content
  * For `css`, body is a [css selector](https://developer.mozilla.org/en/docs/Web/CSS/CSS_Selectors)

Body format is assumed to ignore leading and trailing white spaces, so that extra whitespace can be added for readability.

### Short-forms

For convenience, common selectors have short-forms:
- Selector starting with `//` or `..` is assumed to be `xpath=selector`
  - Example: `page.click('//html')` is converted to `page.click('xpath=//html')`.
- Selector starting and ending with a quote (either `"` or `'`) is assumed to be `text=selector`
  - Example: `page.click('"foo"')` is converted to `page.click('text="foo"')`.
- Otherwise, selector is assumed to be `css=selector`
  - Example: `page.click('div')` is converted to `page.click('css=div')`.

### Chaining selectors

Selectors defined as `engine=body` or in short-form can be combined with the `>>` token, e.g. `selector1 >> selector2 >> selectors3`. When selectors are chained, next one is queried relative to the previous one's result.

For example,

```
css=article >> css=.bar > .baz >> css=span[attr=value]
```

```js
document
  .querySelector('article')
  .querySelector('.bar > .baz')
  .querySelector('span[attr=value]')
```

If a selector needs to include `>>` in the body, it should be escaped inside a string to not be confused with chaining separator, e.g. `text="some >> text"`.

### Intermediate matches

By default, chained selectors resolve to an element queried by the last selector. A selector can be prefixed with `*` to capture elements that are queried by an intermediate selector.

For example, `css=article >> text=Hello` captures the element with the text `Hello`, and `*css=article >> text=Hello` (note the `*`) captures the `article` element that contains some element with the text `Hello`.

## Best practices

The choice of selectors determines the resiliency of automation scripts. To reduce the maintenance burden, we recommend prioritizing user-facing attributes and explicit contracts.

### Prioritize user-facing attributes

Attributes like text content, input placeholder, accessibility roles and labels are user-facing attributes that change rarely. These attributes are not impacted by DOM structure changes.

The following examples use the built-in [text] and [css] selector engines.

```js
// queries "Login" text selector
await page.click('text="Login"');
await page.click('"Login"'); // short-form

// queries "Search GitHub" placeholder attribute
await page.fill('css=[placeholder="Search GitHub"]');
await page.fill('[placeholder="Search GitHub"]'); // short-form

// queries "Close" accessibility label
await page.click('css=[aria-label="Close"]');
await page.click('[aria-label="Close"]'); // short-form

// combine role and text queries
await page.click('css=nav >> text=Login');
```

### Define explicit contract

When user-facing attributes change frequently, it is recommended to use explicit test ids, like `data-test-id`. These `data-*` attributes are supported by the [css] and [id selectors][id].

```html
<button data-test-id="directions">Itinéraire</button>
```

```js
// queries data-test-id attribute with css
await page.click('css=[data-test-id=directions]');
await page.click('[data-test-id=directions]'); // short-form

// queries data-test-id with id
await page.click('data-test-id=directions');
```

### Avoid selectors tied to implementation

[xpath] and [css] can be tied to the DOM structure or implementation. These selectors can break when the DOM structure changes.

```js
// avoid long css or xpath chains
await page.click('#tsf > div:nth-child(2) > div.A8SBwf > div.RNNXgb > div > div.a4bIc > input');
await page.click('//*[@id="tsf"]/div[2]/div[1]/div[1]/div/div[2]/input');
```

## Examples

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

// queries 'span' css selector inside the div handle
const handle = await divHandle.$('css=span');
```

## Selector engines

### css and css:light

`css` is a default engine - any malformed selector not starting with `//` nor starting and ending with a quote is assumed to be a css selector. For example, Playwright converts `page.$('span > button')` to `page.$('css=span > button')`.

Playwright augments standard CSS selectors in two ways, see below for more details:
* `css` engine pierces open shadow DOM by default.
* Playwright adds a few custom pseudo-classes like `:visible`.

#### Shadow piercing

`css:light` engine is equivalent to [`Document.querySelector`](https://developer.mozilla.org/en/docs/Web/API/Document/querySelector) and behaves according to the CSS spec. However, it does not pierce shadow roots, which may be inconvenient when working with [Shadow DOM and Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM). For that reason, `css` engine pierces shadow roots. More specifically, any [Descendant combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Descendant_combinator) or [Child combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Child_combinator) pierces an arbitrary number of open shadow roots, including the implicit descendant combinator at the start of the selector.

`css` engine first searches for elements in the light dom in the iteration order, and then recursively inside open shadow roots in the iteration order. It does not search inside closed shadow roots or iframes.

```html
<article>
  <div>In the light dom</div>
  <div slot='myslot'>In the light dom, but goes into the shadow slot</div>
  <open mode shadow root>
    <div class='in-the-shadow'>
      <span class='content'>
        In the shadow dom
        <open mode shadow root>
          <li id='target'>Deep in the shadow</li>
        </open mode shadow root>
      </span>
    </div>
    <slot name='myslot'></slot>
  </open mode shadow root>
</article>
```

Note that `<open mode shadow root>` is not an html element, but rather a shadow root created with `element.attachShadow({mode: 'open'})`.
- Both `"css=article div"` and `"css:light=article div"` match the first `<div>In the light dom</div>`.
- Both `"css=article > div"` and `"css:light=article > div"` match two `div` elements that are direct children of the `article`.
- `"css=article .in-the-shadow"` matches the `<div class='in-the-shadow'>`, piercing the shadow root, while `"css:light=article .in-the-shadow"` does not match anything.
- `"css:light=article div > span"` does not match anything, because both light-dom `div` elements do not contain a `span`.
- `"css=article div > span"` matches the `<span class='content'>`, piercing the shadow root.
- `"css=article > .in-the-shadow"` does not match anything, because `<div class='in-the-shadow'>` is not a direct child of `article`
- `"css:light=article > .in-the-shadow"` does not match anything.
- `"css=article li#target"` matches the `<li id='target'>Deep in the shadow</li>`, piercing two shadow roots.

#### CSS extension: visible

The `:visible` pseudo-class matches elements that are visible as defined in the [actionability](./actionability.md#visible) guide. For example, `input` matches all the inputs on the page, while `input:visible` matches only visible inputs. This is useful to distinguish elements that are very similar but differ in visibility.

```js
// Clicks the first button.
await page.click('button');
// Clicks the first visible button. If there are some invisible buttons, this click will just ignore them.
await page.click('button:visible');
```

Use `:visible` with caution, because it has two major drawbacks:
* When elements change their visibility dynamically, `:visible` will give upredictable results based on the timing.
* `:visible` forces a layout and may lead to querying being slow, especially when used with `page.waitForSelector(selector[, options])` method.

#### CSS extension: text

The `:text` pseudo-class matches elements that have a text node child with specific text. It is similar to the [text engine](#text-and-textlight). There are a few variations that support different arguments:
* `:text("substring")` - Matches when element's text contains "substring" somewhere. Matching is case-insensitive. Matching also normalizes whitespace, for example it turns multiple spaces into one, trusn line breaks into spaces and ignores leading and trailing whitespace.
* `:text-is("string")` - Matches when element's text equals the "string". Matching is case-insensitive and normalizes whitespace.
* `button:text("Sign in")` - Text selector may be combined with regular CSS.
* `:text-matches("[+-]?\\d+")` - Matches text against a regular expression. Note that special characters like back-slash `\`, quotes `"`, square brackets `[]` and more should be escaped. Learn more about [regular expressions](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/RegExp).
* `:text-matches("value", "i")` - Matches text against a regular expression with specified flags.

```js
// Click a button with text "Sign in".
await page.click('button:text("Sign in")');
```

#### CSS extension: light

`css` engine [pierces shadow](#shadow-piercing) by default. It is possible to disable this behavior by wrapping a selector in `:light` pseudo-class: `:light(section > button.class)` matches in light DOM only.

```js
await page.click(':light(.article > .header)');
```

<!--

#### CSS extension: proximity

Playwright provides a few proximity selectors based on the page layout. These can be combined with regular CSS for better results, for example `input:right-of(:text("Password"))` matches an input field that is to the right of text "Password".

Note that Playwright uses some heuristics to determine whether one element should be considered to the left/right/above/below/near/within another. Therefore, using proximity selectors may produce unpredictable results. For example, selector could stop matching when element moves by one pixel.
* `:right-of(css > selector)` - Matches elements that are to the right of any element matching the inner selector.
* `:left-of(css > selector)` - Matches elements that are to the left of any element matching the inner selector.
* `:above(css > selector)` - Matches elements that are above any of the elements matching the inner selector.
* `:below(css > selector)` - Matches elements that are below any of the elements matching the inner selector.
* `:near(css > selector)` - Matches elements that are near any of the elements matching the inner selector.
* `:within(css > selector)` - Matches elements that are within any of the elements matching the inner selector.

```js
// Fill an input to the right of "Username".
await page.fill('input:right-of(:text("Username"))');

// Click a button near the promo card.
await page.click('button:near(.promo-card)');
```

-->

### xpath

XPath engine is equivalent to [`Document.evaluate`](https://developer.mozilla.org/en/docs/Web/API/Document/evaluate). Example: `xpath=//html/body`.

Malformed selector starting with `//` or `..` is assumed to be an xpath selector. For example, Playwright converts `page.$('//html/body')` to `page.$('xpath=//html/body')`.

Note that `xpath` does not pierce shadow roots.

### text and text:light

Text engine finds an element that contains a text node with the passed text. For example, `page.click('text=Login')` clicks on a login button, and `page.waitForSelector('"lazy loaded text")` waits for the `"lazy loaded text"` to appear in the page.
- By default, the match is case-insensitive, ignores leading/trailing whitespace and searches for a substring. This means `text= Login` matches `<button>Button loGIN (click me)</button>`.
- Text body can be escaped with single or double quotes for precise matching, insisting on exact match, including specified whitespace and case. This means `text="Login "` will only match `<button>Login </button>` with exactly one space after "Login". Quoted text follows the usual escaping rules, e.g. use `\"` to escape double quote in a double-quoted string: `text="foo\"bar"`.
- Text body can also be a JavaScript-like regex wrapped in `/` symbols. This means `text=/^\\s*Login$/i` will match `<button> loGIN</button>` with any number of spaces before "Login" and no spaces after.
- Input elements of the type `button` and `submit` are rendered with their value as text, and text engine finds them. For example, `text=Login` matches `<input type=button value="Login">`.

Malformed selector starting and ending with a quote (either `"` or `'`) is assumed to be a text selector. For example, Playwright converts `page.click('"Login"')` to `page.click('text="Login"')`.

`text` engine open pierces shadow roots similarly to `css`, while `text:light` does not. Text engine first searches for elements in the light dom in the iteration order, and then recursively inside open shadow roots in the iteration order. It does not search inside closed shadow roots or iframes.

### id, data-testid, data-test-id, data-test and their :light counterparts

Attribute engines are selecting based on the corresponding attribute value. For example: `data-test-id=foo` is equivalent to `css=[data-test-id="foo"]`, and `id:light=foo` is equivalent to `css:light=[id="foo"]`.

[css]: #css-and-csslight
[text]: #text-and-textlight
[xpath]: #xpath
[id]: #id-data-testid-data-test-id-data-test-and-their-light-counterparts

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
