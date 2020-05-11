# Extensibility

<!-- GEN:toc-top-level -->
- [Custom selector engines](#custom-selector-engines)
<!-- GEN:stop -->

## Custom selector engines

Playwright supports custom selector engines, registered with [selectors.register(name, script[, options])](api.md#selectorsregistername-script-options).

Selector engine should have the following properties:

- `create` function to create a relative selector from `root` (root is either a `Document`, `ShadowRoot` or `Element`) to a `target` element.
- `query` function to query first element matching `selector` relative to the `root`.
- `queryAll` function to query all elements matching `selector` relative to the `root`.

By default the engine is run directly in the frame's JavaScript context and, for example, can call an application-defined function. To isolate the engine from any JavaScript in the frame, but leave access to the DOM, register the engine with `{contentScript: true}` option. Content script engine is safer because it is protected from any tampering with the global objects, for example altering `Node.prototype` methods. All built-in selector engines run as content scripts. Note that running as a content script is not guaranteed when the engine is used together with other custom engines.

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
