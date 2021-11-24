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
the expected condition is met. In general, we can expect the opposite to be true by adding a `.not` to the front
of the matchers:

```js
expect(value).not.toEqual(0);
await expect(locator).not.toContainText("some text");
```

<!-- TOC -->
- [`method: LocatorAssertions.toBeChecked`]
- [`method: LocatorAssertions.toBeDisabled`]
- [`method: LocatorAssertions.toBeEditable`]
- [`method: LocatorAssertions.toBeEmpty`]
- [`method: LocatorAssertions.toBeEnabled`]
- [`method: LocatorAssertions.toBeFocused`]
- [`method: LocatorAssertions.toBeHidden`]
- [`method: LocatorAssertions.toBeVisible`]
- [`method: LocatorAssertions.toContainText`]
- [`method: LocatorAssertions.toHaveAttribute`]
- [`method: LocatorAssertions.toHaveClass`]
- [`method: LocatorAssertions.toHaveCount`]
- [`method: LocatorAssertions.toHaveCSS`]
- [`method: LocatorAssertions.toHaveId`]
- [`method: LocatorAssertions.toHaveJSProperty`]
- [`method: LocatorAssertions.toHaveText`]
- [`method: LocatorAssertions.toHaveValue`]
- [`method: PageAssertions.toHaveTitle`]
- [`method: PageAssertions.toHaveURL`]

## Matching

Consider the following example:

```js
await expect(page.locator('.status')).toHaveText('Submitted');
```

Playwright Test will be re-testing the node with the selector `.status` until fetched Node has the `"Submitted"`
text. It will be re-fetching the node and checking it over and over, until the condition is met or until the timeout is
reached. You can either pass this timeout or configure it once via the [`property: TestConfig.expect`] value
in test config.

By default, the timeout for assertions is set to 5 seconds. Learn more about [various timeouts](./test-timeouts.md).

## expect(value).toMatchSnapshot(name[, options])
- `name` <[string] | [Array]<[string]>> Snapshot name.
- `options`
  - `threshold` <[float]> Image matching threshold between zero (strict) and one (lax), default is configurable with [`property: TestConfig.expect`].

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
