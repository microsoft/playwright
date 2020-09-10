# Element selectors

Selectors query elements on the web page for interactions, like [page.click](api.md#pageclickselector-options), and to obtain `ElementHandle` through [page.$](api.md#pageselector). Built-in selectors auto-pierce [shadow DOM](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM).

<!-- GEN:toc-top-level -->
- [Syntax](#syntax)
- [Best practices](#best-practices)
- [Examples](#examples)
- [Selector engines](#selector-engines)
<!-- GEN:stop -->

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
is equivalent to
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

`css:light` engine is equivalent to [`Document.querySelector`](https://developer.mozilla.org/en/docs/Web/API/Document/querySelector) and behaves according to the CSS spec. However, it does not pierce shadow roots, which may be inconvenient when working with [Shadow DOM and Web Components](https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM). For that reason, `css` engine pierces shadow roots. More specifically, every [Descendant combinator](https://developer.mozilla.org/en-US/docs/Web/CSS/Descendant_combinator) pierces an arbitrary number of open shadow roots, including the implicit descendant combinator at the start of the selector.

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