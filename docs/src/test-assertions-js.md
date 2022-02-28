---
id: test-assertions
title: "Assertions"
---

Playwright Test uses [expect](https://jestjs.io/docs/expect) library for test assertions. This library provides
a lot of matchers like `toEqual`, `toContain`, `toMatch`, `toMatchSnapshot` and many more:

```js
expect(success).toBeTruthy();
```

Playwright also extends it with convenience async matchers that will wait until
the expected condition is met. Consider the following example:

```js
await expect(page.locator('.status')).toHaveText('Submitted');
```

Playwright Test will be re-testing the node with the selector `.status` until fetched Node has the `"Submitted"`
text. It will be re-fetching the node and checking it over and over, until the condition is met or until the timeout is
reached. You can either pass this timeout or configure it once via the [`property: TestConfig.expect`] value
in test config.

By default, the timeout for assertions is set to 5 seconds. Learn more about [various timeouts](./test-timeouts.md).

<!-- TOC -->

## Negating Matchers

In general, we can expect the opposite to be true by adding a `.not` to the front
of the matchers:

```js
expect(value).not.toEqual(0);
await expect(locator).not.toContainText("some text");
```

## Soft Assertions

By default, failed assertion will terminate test execution. Playwright also
supports *soft assertions*: failed soft assertions **do not** terminate test execution,
but mark the test as failed.

```js
// Make a few checks that will not stop the test when failed...
await expect.soft(page.locator('#status')).toHaveText('Success');
await expect.soft(page.locator('#eta')).toHaveText('1 day');

// ... and continue the test to check more things.
await page.locator('#next-page').click();
await expect.soft(page.locator('#title')).toHaveText('Make another order');
```

At any point during test execution, you can check whether there were any
soft assertion failures:

```js
// Make a few checks that will not stop the test when failed...
await expect.soft(page.locator('#status')).toHaveText('Success');
await expect.soft(page.locator('#eta')).toHaveText('1 day');

// Avoid running further if there were soft assertion failures.
expect(test.info().errors).toBeEmpty();
```

## Custom Expect Message

You can specify a custom error message as a second argument to the `expect` function, for example:

```js
await expect(page.locator('text=Name'), 'should be logged in').toBeVisible();
```

The error would look like this:

```bash
    Error: should be logged in

    Call log:
      - expect.toBeVisible with timeout 5000ms
      - waiting for selector "text=Name"


      2 |
      3 | test('example test', async({ page }) => {
    > 4 |   await expect(page.locator('text=Name'), 'should be logged in').toBeVisible();
        |                                                                  ^
      5 | });
      6 |
```

The same works with soft assertions:

```js
expect.soft(value, 'my soft assertion').toBe(56);
```

## expect(locator).toBeChecked([options])
- `options`
  - `checked` <[boolean]>
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to the checked input.

```js
const locator = page.locator('.subscribe');
await expect(locator).toBeChecked();
```

## expect(locator).toBeDisabled([options])
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to a disabled element.

```js
const locator = page.locator('button.submit');
await expect(locator).toBeDisabled();
```

## expect(locator).toBeEditable([options])
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to an editable element.

```js
const locator = page.locator('input');
await expect(locator).toBeEditable();
```

## expect(locator).toBeEmpty([options])
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to an empty editable element or to a DOM node that has no text.

```js
const locator = page.locator('div.warning');
await expect(locator).toBeEmpty();
```

## expect(locator).toBeEnabled([options])
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to an enabled element.

```js
const locator = page.locator('button.submit');
await expect(locator).toBeEnabled();
```

## expect(locator).toBeFocused([options])
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to a focused DOM node.

```js
const locator = page.locator('input');
await expect(locator).toBeFocused();
```

## expect(locator).toBeHidden([options])
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to a hidden DOM node, which is the opposite of [visible](./actionability.md#visible).

```js
const locator = page.locator('.my-element');
await expect(locator).toBeHidden();
```

## expect(locator).toBeVisible([options])
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to a [visible](./actionability.md#visible) DOM node.

```js
const locator = page.locator('.my-element');
await expect(locator).toBeVisible();
```

## expect(locator).toContainText(expected[, options])
- `expected` <[string] | [RegExp] | [Array]<[string]|[RegExp]>>
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].
  - `useInnerText` <[boolean]> Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

Ensures [Locator] points to an element that contains the given text. You can use regular expressions for the value as well.

```js
const locator = page.locator('.title');
await expect(locator).toContainText('substring');
await expect(locator).toContainText(/\d messages/);
```

Note that if array is passed as an expected value, entire lists can be asserted:

```js
const locator = page.locator('list > .list-item');
await expect(locator).toContainText(['Text 1', 'Text 4', 'Text 5']);
```

## expect(locator).toHaveAttribute(name, value[, options])
- `name` <[string]> Attribute name
- `value` <[string]|[RegExp]> Attribute value
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to an element with given attribute.

```js
const locator = page.locator('input');
await expect(locator).toHaveAttribute('type', 'text');
```

## expect(locator).toHaveClass(expected[, options])
- `expected` <[string] | [RegExp] | [Array]<[string]|[RegExp]>>
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to an element with given CSS class.

```js
const locator = page.locator('#component');
await expect(locator).toHaveClass(/selected/);
```

Note that if array is passed as an expected value, entire lists can be asserted:

```js
const locator = page.locator('list > .component');
await expect(locator).toHaveClass(['component', 'component selected', 'component']);
```

## expect(locator).toHaveCount(count[, options])
- `count` <[number]>
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] resolves to an exact number of DOM nodes.

```js
const list = page.locator('list > .component');
await expect(list).toHaveCount(3);
```

## expect(locator).toHaveCSS(name, value[, options])
- `name` <[string]> CSS property name
- `value` <[string]|[RegExp]> CSS property value
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] resolves to an element with the given computed CSS style.

```js
const locator = page.locator('button');
await expect(locator).toHaveCSS('display', 'flex');
```

## expect(locator).toHaveId(id[, options])
- `id` <[string]> Element id
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to an element with the given DOM Node ID.

```js
const locator = page.locator('input');
await expect(locator).toHaveId('lastname');
```

## expect(locator).toHaveJSProperty(name, value[, options])
- `name` <[string]> Property name
- `value` <[any]> Property value
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to an element with given JavaScript property. Note that this property can be
of a primitive type as well as a plain serializable JavaScript object.

```js
const locator = page.locator('.component');
await expect(locator).toHaveJSProperty('loaded', true);
```

## expect(locator).toHaveText(expected[, options])
- `expected` <[string] | [RegExp] | [Array]<[string]|[RegExp]>>
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].
  - `useInnerText` <[boolean]> Whether to use `element.innerText` instead of `element.textContent` when retrieving DOM node text.

Ensures [Locator] points to an element with the given text. You can use regular expressions for the value as well.

```js
const locator = page.locator('.title');
await expect(locator).toHaveText(/Welcome, Test User/);
await expect(locator).toHaveText(/Welcome, .*/);
```

Note that if array is passed as an expected value, entire lists can be asserted:

```js
const locator = page.locator('list > .component');
await expect(locator).toHaveText(['Text 1', 'Text 2', 'Text 3']);
```

## expect(locator).toHaveValue(value[, options])
- `value` <[string] | [RegExp]>
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures [Locator] points to an element with the given input value. You can use regular expressions for the value as well.

```js
const locator = page.locator('input[type=number]');
await expect(locator).toHaveValue(/[0-9]/);
```

## expect(page).toHaveTitle(title[, options])
- `title` <[string] | [RegExp]>
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures page has a given title.

```js
await expect(page).toHaveTitle(/.*checkout/);
```

## expect(page).toHaveURL(url[, options])
- `url` <[string] | [RegExp]>
- `options`
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures page is navigated to a given URL.

```js
await expect(page).toHaveURL(/.*checkout/);
```

## expect(value).toMatchSnapshot(name[, options])
- `name` <[string] | [Array]<[string]>> Snapshot name.
- `options`
  - `threshold` <[float]> an acceptable percieved color difference in the [YIQ color space](https://en.wikipedia.org/wiki/YIQ) between pixels in compared images, between zero (strict) and one (lax), default is configurable with [`property: TestConfig.expect`]. Defaults to `0.2`.
  - `pixelCount` <[int]> an acceptable amount of pixels that could be different, unset by default.
  - `pixelRatio` <[float]> an acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1`, unset by default.

Ensures that passed value, either a [string] or a [Buffer], matches the expected snapshot stored in the test snapshots directory.

```js
// Basic usage.
expect(await page.screenshot()).toMatchSnapshot('landing-page.png');

// Configure image matching threshold.
expect(await page.screenshot()).toMatchSnapshot('landing-page.png', { threshold: 0.3 });

// Bring some structure to your snapshot files by passing file path segments.
expect(await page.screenshot()).toMatchSnapshot(['landing', 'step2.png']);
expect(await page.screenshot()).toMatchSnapshot(['landing', 'step3.png']);
```

Learn more about [visual comparisons](./test-snapshots.md).

## expect(pageOrLocator).toHaveScreenshot([options])
- `options`
  - `name` <[string] | [Array]<[string]>> Optional snapshot name.
  - `disableAnimations` <[boolean]> When true, stops CSS animations, CSS transitions and Web Animations. Animations get different treatment depending on their duration:
    - finite animations are fast-forwarded to completion, so they'll fire `transitionend` event.
    - infinite animations are canceled to initial state, and then played over after the screenshot.
  - `omitBackground` <[boolean]> Hides default white background and allows capturing screenshots with transparency. Defaults to `false`.
  - `fullPage` <[boolean]> When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to `false`.
  - `mask` <[Array]<[Locator]>> Specify locators that should be masked when the screenshot is taken. Masked elements will be overlayed with
a pink box `#FF00FF` that completely covers its bounding box.
  - `clip` <[Object]> An object which specifies clipping of the resulting image.
    - `x` <[float]> x-coordinate of top-left corner of clip area
    - `y` <[float]> y-coordinate of top-left corner of clip area
    - `width` <[float]> width of clipping area
    - `height` <[float]> height of clipping area
  - `threshold` <[float]> an acceptable percieved color difference in the [YIQ color space](https://en.wikipedia.org/wiki/YIQ) between pixels in compared images, between zero (strict) and one (lax), default is configurable with [`property: TestConfig.expect`]. Defaults to `0.2`.
  - `pixelCount` <[int]> an acceptable amount of pixels that could be different, unset by default.
  - `pixelRatio` <[float]> an acceptable ratio of pixels that are different to the total amount of pixels, between `0` and `1`, unset by default.
  - `timeout` <[number]> Time to retry assertion for, defaults to `timeout` in [`property: TestConfig.expect`].

Ensures that passed value, either a [string] or a [Buffer], matches the expected snapshot stored in the test snapshots directory.

```js
// Basic usage.
await expect(page).toHaveScreenshot({ name: 'landing-page.png' });
await expect(page.locator('text=Submit')).toHaveScreenshot();

// Take a full page screenshot and auto-generate screenshot name
await expect(page).toHaveScreenshot({ fullPage: true });

// Configure image matching properties.
await expect(page.locator('text=Submit').toHaveScreenshot({ pixelRatio: 0.01 });
```
