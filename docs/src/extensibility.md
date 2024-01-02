---
id: extensibility
title: "Extensibility"
---
## Custom selector engines

Playwright supports custom selector engines, registered with [`method: Selectors.register`].

Selector engine should have the following properties:
- `query` function to query first element matching `selector` relative to the `root`.
- `queryAll` function to query all elements matching `selector` relative to the `root`.

By default the engine is run directly in the frame's JavaScript context and, for example, can call an
application-defined function. To isolate the engine from any JavaScript in the frame, but leave access to the DOM,
register the engine with `{contentScript: true}` option. Content script engine is safer because it is protected from any
tampering with the global objects, for example altering `Node.prototype` methods. All built-in selector engines run as
content scripts. Note that running as a content script is not guaranteed when the engine is used together with other
custom engines.

Selectors must be registered before creating the page.

An example of registering selector engine that queries elements based on a tag name:


```js title="baseTest.ts"
import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';

// Must be a function that evaluates to a selector engine instance.
const createTagNameEngine = () => ({
  // Returns the first element matching given selector in the root's subtree.
  query(root, selector) {
    return root.querySelector(selector);
  },

  // Returns all elements matching given selector in the root's subtree.
  queryAll(root, selector) {
    return Array.from(root.querySelectorAll(selector));
  }
});

export const test = base.extend<{}, { selectorRegistration: void }>({
  // Register selectors once per worker.
  selectorRegistration: [async ({ playwright }, use) => {
    // Register the engine. Selectors will be prefixed with "tag=".
    await playwright.selectors.register('tag', createTagNameEngine);
    await use();
  }, { scope: 'worker', auto: true }],
});
```

```js title="example.spec.ts"
import { test, expect } from './baseTest';

test('selector engine test', async ({ page }) => {
  // Now we can use 'tag=' selectors.
  const button = page.locator('tag=button');
  await button.click();

  // We can combine it with built-in locators.
  await page.locator('tag=div').getByText('Click me').click();

  // We can use it in any methods supporting selectors.
  await expect(page.locator('tag=button')).toHaveCount(3);
});
```

```java
// Must be a script that evaluates to a selector engine instance.  The script is evaluated in the page context.
String createTagNameEngine = "{\n" +
  "  // Returns the first element matching given selector in the root's subtree.\n" +
  "  query(root, selector) {\n" +
  "    return root.querySelector(selector);\n" +
  "  },\n" +
  "\n" +
  "  // Returns all elements matching given selector in the root's subtree.\n" +
  "  queryAll(root, selector) {\n" +
  "    return Array.from(root.querySelectorAll(selector));\n" +
  "  }\n" +
  "}";

// Register the engine. Selectors will be prefixed with "tag=".
playwright.selectors().register("tag", createTagNameEngine);

// Now we can use "tag=" selectors.
Locator button = page.locator("tag=button");
button.click();

// We can combine it with built-in locators.
page.locator("tag=div").getByText("Click me").click();

// We can use it in any methods supporting selectors.
int buttonCount = (int) page.locator("tag=button").count();
```

```python async
tag_selector = """
    // Must evaluate to a selector engine instance.
    {
      // Returns the first element matching given selector in the root's subtree.
      query(root, selector) {
        return root.querySelector(selector);
      },

      // Returns all elements matching given selector in the root's subtree.
      queryAll(root, selector) {
        return Array.from(root.querySelectorAll(selector));
      }
    }"""

# register the engine. selectors will be prefixed with "tag=".
await playwright.selectors.register("tag", tag_selector)

# now we can use "tag=" selectors.
button = page.locator("tag=button")
await button.click()

# we can combine it with built-in locators.
await page.locator("tag=div").get_by_text("click me").click()

# we can use it in any methods supporting selectors.
button_count = await page.locator("tag=button").count()
```

```python sync
tag_selector = """
    // Must evaluate to a selector engine instance.
    {
      // Returns the first element matching given selector in the root's subtree.
      query(root, selector) {
        return root.querySelector(selector);
      },

      // Returns all elements matching given selector in the root's subtree.
      queryAll(root, selector) {
        return Array.from(root.querySelectorAll(selector));
      }
    }"""

# register the engine. selectors will be prefixed with "tag=".
playwright.selectors.register("tag", tag_selector)

# now we can use "tag=" selectors.
button = page.locator("tag=button")
button.click()

# we can combine it with built-in locators.
page.locator("tag=div").get_by_text("click me").click()

# we can use it in any methods supporting selectors.
button_count = page.locator("tag=button").count()
```

```csharp
// Register the engine. Selectors will be prefixed with "tag=".
// The script is evaluated in the page context.
await playwright.Selectors.Register("tag", new() {
  Script = @"
  // Must evaluate to a selector engine instance.
  {
    // Returns the first element matching given selector in the root's subtree.
    query(root, selector) {
      return root.querySelector(selector);
    },

    // Returns all elements matching given selector in the root's subtree.
    queryAll(root, selector) {
      return Array.from(root.querySelectorAll(selector));
    }
  }"
});

// Now we can use "tag=" selectors.
await page.Locator("tag=button").ClickAsync();

// We can combine it with built-in locators.
await page.Locator("tag=div").GetByText("Click me").ClickAsync();
```
