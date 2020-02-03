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
- selector starting with `//` is assumed to be `xpath=selector`;
- selector starting with `"` is assumed to be `text=selector`;
- otherwise selector is assumed to be `css=selector`.

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

### css

CSS engine is equivalent to [`Document.querySelector`](https://developer.mozilla.org/en/docs/Web/API/Document/querySelector). Example: `css=.article > span:nth-child(2) li`.

> **NOTE** Malformed selector not starting with `//` nor with `#` is automatically transformed to css selector. For example, Playwright converts `page.$('span > button')` to `page.$('css=span > button')`. Selectors starting with `#` are converted to [text](#text). Selectors starting with `//` are converted to [xpath](#xpath).

### xpath

XPath engine is equivalent to [`Document.evaluate`](https://developer.mozilla.org/en/docs/Web/API/Document/evaluate). Example: `xpath=//html/body`.

> **NOTE** Malformed selector starting with `//` is automatically transformed to xpath selector. For example, Playwright converts `page.$('//html/body')` to `page.$('xpath=//html/body')`.

### text

Text engine finds an element that contains a text node with passed text. Example: `text=Login`.
- By default, the match is case-insensitive, and ignores leading/trailing whitespace. This means `text= Login` matches `<button>loGIN </button>`.
- Text body can be escaped with double quotes for precise matching, insisting on specific whitespace and case. This means `text="Login "` will only match `<button>Login </button>` with exactly one space after "Login".
- Text body can also be a JavaScript-like regex wrapped in `/` symbols. This means `text=/^\\s*Login$/i` will match `<button> loGIN</button>` with any number of spaces before "Login" and no spaces after.

> **NOTE** Malformed selector starting with `"` is automatically transformed to text selector. For example, Playwright converts `page.click('"Login"')` to `page.click('text="Login"')`.

### id, data-testid, data-test-id, data-test

Id engines are selecting based on the corresponding atrribute value. For example: `data-test-id=foo` is equivalent to `querySelector('*[data-test-id=foo]')`.

## Custom selector engines

Playwright supports custom selector engines, registered with [selectors.register(engineFunction[, ...args])](api.md#selectorsregisterenginefunction-args).

Selector engine should have the following properties:

- `name` Selector name used in selector strings.
- `create` Function to create a relative selector from `root` (root is either a `Document`, `ShadowRoot` or `Element`) to a `target` element.
- `query` Function to query first element matching `selector` relative to the `root`.
- `queryAll` Function to query all elements matching `selector` relative to the `root`.

An example of registering selector engine that queries elements based on a tag name:
```js
// Must be a function that evaluates to a selector engine instance.
const createTagNameEngine = () => ({
  // Selectors will be prefixed with "tag=".
  name: 'tag',

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

// Register the engine.
await selectors.register(createTagNameEngine);

// Now we can use 'tag=' selectors.
const button = await page.$('tag=button');

// We can combine it with other selector engines.
await page.click('tag=div >> text="Click me"');

// We can use it in any methods supporting selectors.
const buttonCount = await page.$$eval('tag=button', buttons => buttons.length);
```
