# Selector engines

Playwright supports multiple selector engines to query elements on a web page. Element selectors can be used to obtain `ElementHandle` objects (see [page.$()](api.md#pageselector) for example), or shortcut element operations that avoid intermediate handles (see [page.click()](api.md#pageclickselector-options) for example).

* [Selector syntax](#selector-syntax)
   * [Examples](#examples)
* [Built-in selector engines](#built-in-selector-engines)
   * [css](#css)
   * [xpath](#xpath)
   * [text](#text)
   * [id, data-testid, data-test-id, data-test](#id-data-testid-data-test-id-data-test)
   * [zs](#zs)
* [Custom selector engines](#custom-selector-engines)

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

### Examples

```js
// queries 'div' css selector
const handle = await page.$('css=div');

// queries '//html/body/div' xpath selector
const handle = await page.$('xpath=//html/body/div');

// queries '"foo"' zs selector
const handle = await page.$('zs="foo"');

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

### zs

The z-selector is an experimental engine to define selectors that can **survive future refactorings**. UI selectors that depend on the DOM hierarchy can be susceptible to markup changes. `data-*` attributes can be used to establish contracts that avoid nested node relationships, but they are not always available.

Z-selector attempts to be a readable selector that does not depend on strict nesting, thereby being resilient to certain markup changes. Within a `zs` definition, you can use the following to select nodes: text content (`"Login"`), element type (`input`) and CSS classnames (`.container`). Node relationships are defined with the `~` combinator. Z-selector can also be combined with other selectors using the `>>` combinator as described above.

#### The `~` combinator

The `~` combinator defines a common ancestral relationship between nodes: it separates two nodes and matches the second node if the two share a common ancestor. This defines a node relationship that is flexible, and does not rely on strict nesting.

To understand how the selector engine traverses the hierarchy, let's see how `zs="Foo" ~ "Bar" ~ "Baz"` works. From the root, it will look for a node with the text "Foo". It will then start climbing up the hierarchy, until it finds a node in the sub-tree with text "Bar". From that node, it will start climbing until it finds a node "Baz".

<img src="https://raw.githubusercontent.com/arjun27/tsgr/master/zs.png" width="400" />

Let's try this on a more real example. In the HTML snippet below, `zs="Username" ~ input` can be used to select the `input` element.

```html
<form>
  <label>Username</label>
  <input type="text">
</form>
```

```js
await page.$eval(`zs="Username" ~ input`, e => e.outerHTML); // returns <input type="text">
```

If this markup were to change, with `label` becoming a `div`, and the `input` getting wrapped inside another `div`, the same selector can still be used to locate the `input` element. `"Username"` helps keep the search resilient to layout changes, and the `input` gives us last-mile precision in a sub-tree around `"Username"`.

```html
<form>
  <div>Username</div>
  <div>
    <input type="text">
  </div>
</form>
```

#### Other combinators

In some cases, relationships defined with the `~` combinator can be insufficient to locate elements. For last-resort selections, z-selector also supports the `^` and `#` combinators.

* The `^` combinator can be used to go up one level in the DOM hierarchy and select the parent element. In the modified example above, `zs=input^` will select the `div` which wraps the `input` element.
* The `#n` combinator works as an ordinal selector. In the modified example above, `zs=div#0` will select the first `div` element. `zs=div#1` will select the second.

If you have an feedback on the Z-selector engine, we would love to hear about it. Please [file an issue](https://github.com/microsoft/playwright/issues) and help us make it work better for you.

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
