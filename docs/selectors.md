# Selector engines

Playwright supports multiple selector engines used to query elements in the web page.

Selector can be used to obtain `ElementHandle` (see [page.$()](api.md#pageselector) for example) or shortcut element operations to avoid intermediate handle (see [page.click()](api.md#pageclickselector-options) for example).

## Selector syntax

Selector is a string that consists of one or more clauses separated by `>>` token, e.g. `clause1 >> clause2 >> clause3`.  When multiple clauses are present, next one is queried relative to the previous one's result.

Each clause contains a selector engine name and selector body, e.g. `engine=body`. Here `engine` is one of the supported engines (e.g. `css` or a custom one). Selector `body` follows the format of the particular engine, e.g. for `css` engine it should be a [css selector](https://developer.mozilla.org/en/docs/Web/CSS/CSS_Selectors). Body format is assumed to ignore leading and trailing whitespaces, so that extra whitespace can be added for readability. If selector engine needs to include `>>` in the body, it should be escaped inside a string to not be confused with clause separator, e.g. `text="some >> text"`.

For example,
```
css=article >> css=.bar > .baz >> css=span[attr=value]
```
is equivalent to
```js
document
  .querySelector('article')
  .querySelector('.bar > .baz')
  .querySelector('span[attr=value]')
```

For convenience, selectors in the wrong format are heuristically converted to the right format:
- Selector starting with `//` is assumed to be `xpath=selector`. Example: `page.click('//html')` is converted to `page.click('xpath=//html')`.
- Selector starting with `"` is assumed to be `text=selector`. Example: `page.click('"foo"')` is converted to `page.click('text="foo"')`.
- Otherwise, selector is assumed to be `css=selector`. Example: `page.click('div')` is converted to `page.click('css=div')`.

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

## Built-in selector engines

### css and css:light

`css` is a default engine - any malformed selector not starting with `//` nor with `"` is assumed to be a css selector. For example, Playwright converts `page.$('span > button')` to `page.$('css=span > button')`.

`css:light` engine is equivalent to [`Document.querySelector`](https://developer.mozilla.org/en/docs/Web/API/Document/querySelector) and behaves according to the CSS spec. However, it does not pierce shadow roots, which may be incovenient when working with [Shadow DOM and Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM). For that reason, `css` engine pierces shadow roots. More specifically, every [Descendant combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Descendant_combinator) pierces an arbitrary number of open shadow roots, including the implicit descendant combinator at the start of the selector.

`css` engine first searches for elements in the light dom in the iteration order, and then recursively inside open shadow roots in the iteration order. It does not search inside closed shadow roots or iframes.

#### Examples

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

### xpath

XPath engine is equivalent to [`Document.evaluate`](https://developer.mozilla.org/en/docs/Web/API/Document/evaluate). Example: `xpath=//html/body`.

Malformed selector starting with `//` is assumed to be an xpath selector. For example, Playwright converts `page.$('//html/body')` to `page.$('xpath=//html/body')`.

Note that `xpath` does not pierce shadow roots.

### text and text:light

Text engine finds an element that contains a text node with the passed text. For example, `page.click('text=Login')` clicks on a login button, and `page.waitForSelector('"lazy loaded text")` waits for the `"lazy loaded text"` to appear in the page.

- By default, the match is case-insensitive, ignores leading/trailing whitespace and searches for a substring. This means `text= Login` matches `<button>Button loGIN (click me)</button>`.
- Text body can be escaped with double quotes for precise matching, insisting on exact match, including specified whitespace and case. This means `text="Login "` will only match `<button>Login </button>` with exactly one space after "Login".
- Text body can also be a JavaScript-like regex wrapped in `/` symbols. This means `text=/^\\s*Login$/i` will match `<button> loGIN</button>` with any number of spaces before "Login" and no spaces after.
- Input elements of the type `button` and `submit` are rendered with their value as text, and text engine finds them. For example, `text=Login` matches `<input type=button value="Login">`.

Malformed selector starting with `"` is assumed to be a text selector. For example, Playwright converts `page.click('"Login"')` to `page.click('text="Login"')`.

`text` engine open pierces shadow roots similarly to `css`, while `text:light` does not. Text engine first searches for elements in the light dom in the iteration order, and then recursively inside open shadow roots in the iteration order. It does not search inside closed shadow roots or iframes.

### id, data-testid, data-test-id, data-test and their :light counterparts

Attribute engines are selecting based on the corresponding atrribute value. For example: `data-test-id=foo` is equivalent to `css=[data-test-id="foo"]`, and `id:light=foo` is equivalent to `css:light=[id="foo"]`.

## Custom selector engines

Playwright supports custom selector engines, registered with [selectors.register(name, script[, options])](api.md#selectorsregistername-script-options).

Selector engine should have the following properties:

- `create` function to create a relative selector from `root` (root is either a `Document`, `ShadowRoot` or `Element`) to a `target` element.
- `query` function to query first element matching `selector` relative to the `root`.
- `queryAll` function to query all elements matching `selector` relative to the `root`.

By default the engine is run directly in the frame's JavaScript context and, for example, can call an application-defined function. To isolate the engine from any JavaScript in the frame, but leave access to the DOM, resgister the engine with `{contentScript: true}` option. Content script engine is safer because it is protected from any tampering with the global objects, for example altering `Node.prototype` methods. All built-in selector engines run as content scripts. Note that running as a content script is not guaranteed when the engine is used together with other custom engines.

An example of registering selector engine that queries elements based on a tag name:
```js
// Must be a function that evaluates to a selector engine instance.
const createTagNameEngine = () => ({
  // Creates a selector that matches given target when queried at the root.
  // Can return undefined if unable to create one.
  create(root, target) {
    return root.querySelector(target.tagName) === target ? target.tagName : undefined;
  },

  // Returns the first element matching given selector in the root's subtree.
  query(root, selector) {
    return root.querySelector(selector);
  },

  // Returns all elements matching given selector in the root's subtree.
  queryAll(root, selector) {
    return Array.from(root.querySelectorAll(selector));
  }
});

// Register the engine. Selectors will be prefixed with "tag=".
await selectors.register('tag', createTagNameEngine);

// Now we can use 'tag=' selectors.
const button = await page.$('tag=button');

// We can combine it with other selector engines using `>>` combinator.
await page.click('tag=div >> span >> "Click me"');

// We can use it in any methods supporting selectors.
const buttonCount = await page.$$eval('tag=button', buttons => buttons.length);
```
