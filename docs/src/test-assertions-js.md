---
id: test-assertions
title: "Assertions"
---

## Introduction

Playwright includes test assertions in the form of `expect` function. To make an assertion, call `expect(value)` and choose a matcher that reflects the expectation. There are many [generic matchers](./api/class-genericassertions.md) like `toEqual`, `toContain`, `toBeTruthy` that can be used to assert any conditions.

```js
expect(success).toBeTruthy();
```

Playwright also includes web-specific [async matchers](./api/class-locatorassertions.md) that will wait until
the expected condition is met. Consider the following example:

```js
await expect(page.getByTestId('status')).toHaveText('Submitted');
```

Playwright will be re-testing the element with the test id of `status` until the fetched element has the `"Submitted"` text. It will re-fetch the element and check it over and over, until the condition is met or until the timeout is reached. You can either pass this timeout or configure it once via the [`property: TestConfig.expect`] value in the test config.

By default, the timeout for assertions is set to 5 seconds. Learn more about [various timeouts](./test-timeouts.md).

## Auto-retrying assertions

The following assertions will retry until the assertion passes, or the assertion timeout is reached.
Note that retrying assertions are async, so you must `await` them.

| Assertion | Description |
| :- | :- |
| [await expect(locator).toBeAttached()](./api/class-locatorassertions.md#locator-assertions-to-be-attached) | Element is attached |
| [await expect(locator).toBeChecked()](./api/class-locatorassertions.md#locator-assertions-to-be-checked) | Checkbox is checked |
| [await expect(locator).toBeDisabled()](./api/class-locatorassertions.md#locator-assertions-to-be-disabled) | Element is disabled |
| [await expect(locator).toBeEditable()](./api/class-locatorassertions.md#locator-assertions-to-be-editable) | Element is editable |
| [await expect(locator).toBeEmpty()](./api/class-locatorassertions.md#locator-assertions-to-be-empty) | Container is empty |
| [await expect(locator).toBeEnabled()](./api/class-locatorassertions.md#locator-assertions-to-be-enabled) | Element is enabled |
| [await expect(locator).toBeFocused()](./api/class-locatorassertions.md#locator-assertions-to-be-focused) | Element is focused |
| [await expect(locator).toBeHidden()](./api/class-locatorassertions.md#locator-assertions-to-be-hidden) | Element is not visible |
| [await expect(locator).toBeInViewport()](./api/class-locatorassertions.md#locator-assertions-to-be-in-viewport) | Element intersects viewport |
| [await expect(locator).toBeVisible()](./api/class-locatorassertions.md#locator-assertions-to-be-visible) | Element is visible |
| [await expect(locator).toContainText()](./api/class-locatorassertions.md#locator-assertions-to-contain-text) | Element contains text |
| [await expect(locator).toHaveAccessibleDescription()](./api/class-locatorassertions.md#locator-assertions-to-have-accessible-description) | Element has a matching [accessible description](https://w3c.github.io/accname/#dfn-accessible-description) |
| [await expect(locator).toHaveAccessibleName()](./api/class-locatorassertions.md#locator-assertions-to-have-accessible-name) | Element has a matching [accessible name](https://w3c.github.io/accname/#dfn-accessible-name) |
| [await expect(locator).toHaveAttribute()](./api/class-locatorassertions.md#locator-assertions-to-have-attribute) | Element has a DOM attribute |
| [await expect(locator).toHaveClass()](./api/class-locatorassertions.md#locator-assertions-to-have-class) | Element has a class property |
| [await expect(locator).toHaveCount()](./api/class-locatorassertions.md#locator-assertions-to-have-count) | List has exact number of children |
| [await expect(locator).toHaveCSS()](./api/class-locatorassertions.md#locator-assertions-to-have-css) | Element has CSS property |
| [await expect(locator).toHaveId()](./api/class-locatorassertions.md#locator-assertions-to-have-id) | Element has an ID |
| [await expect(locator).toHaveJSProperty()](./api/class-locatorassertions.md#locator-assertions-to-have-js-property) | Element has a JavaScript property |
| [await expect(locator).toHaveRole()](./api/class-locatorassertions.md#locator-assertions-to-have-role) | Element has a specific [ARIA role](https://www.w3.org/TR/wai-aria-1.2/#roles) |
| [await expect(locator).toHaveScreenshot()](./api/class-locatorassertions.md#locator-assertions-to-have-screenshot-1) | Element has a screenshot |
| [await expect(locator).toHaveText()](./api/class-locatorassertions.md#locator-assertions-to-have-text) | Element matches text |
| [await expect(locator).toHaveValue()](./api/class-locatorassertions.md#locator-assertions-to-have-value) | Input has a value |
| [await expect(locator).toHaveValues()](./api/class-locatorassertions.md#locator-assertions-to-have-values) | Select has options selected |
| [await expect(page).toHaveScreenshot()](./api/class-pageassertions.md#page-assertions-to-have-screenshot-1) | Page has a screenshot |
| [await expect(page).toHaveTitle()](./api/class-pageassertions.md#page-assertions-to-have-title) | Page has a title |
| [await expect(page).toHaveURL()](./api/class-pageassertions.md#page-assertions-to-have-url) | Page has a URL |
| [await expect(response).toBeOK()](./api/class-apiresponseassertions.md#api-response-assertions-to-be-ok) | Response has an OK status |

## Non-retrying assertions

These assertions allow to test any conditions, but do not auto-retry. Most of the time, web pages show information asynchronously, and using non-retrying assertions can lead to a flaky test.

Prefer [auto-retrying](#auto-retrying-assertions) assertions whenever possible. For more complex assertions that need to be retried, use [`expect.poll`](#expectpoll) or [`expect.toPass`](#expecttopass).

| Assertion | Description |
| :- | :- |
| [`method: GenericAssertions.toBe`] | Value is the same |
| [`method: GenericAssertions.toBeCloseTo`] | Number is approximately equal |
| [`method: GenericAssertions.toBeDefined`] | Value is not `undefined` |
| [`method: GenericAssertions.toBeFalsy`] | Value is falsy, e.g. `false`, `0`, `null`, etc. |
| [`method: GenericAssertions.toBeGreaterThan`] | Number is more than |
| [`method: GenericAssertions.toBeGreaterThanOrEqual`] | Number is more than or equal |
| [`method: GenericAssertions.toBeInstanceOf`] | Object is an instance of a class |
| [`method: GenericAssertions.toBeLessThan`] | Number is less than |
| [`method: GenericAssertions.toBeLessThanOrEqual`] | Number is less than or equal |
| [`method: GenericAssertions.toBeNaN`] | Value is `NaN` |
| [`method: GenericAssertions.toBeNull`] | Value is `null` |
| [`method: GenericAssertions.toBeTruthy`] | Value is truthy, i.e. not `false`, `0`, `null`, etc. |
| [`method: GenericAssertions.toBeUndefined`] | Value is `undefined` |
| [`method: GenericAssertions.toContain#1`] | String contains a substring |
| [`method: GenericAssertions.toContain#2`] | Array or set contains an element |
| [`method: GenericAssertions.toContainEqual`] | Array or set contains a similar element |
| [`method: GenericAssertions.toEqual`] | Value is similar - deep equality and pattern matching |
| [`method: GenericAssertions.toHaveLength`] | Array or string has length |
| [`method: GenericAssertions.toHaveProperty`] | Object has a property |
| [`method: GenericAssertions.toMatch`] | String matches a regular expression |
| [`method: GenericAssertions.toMatchObject`] | Object contains specified properties |
| [`method: GenericAssertions.toStrictEqual`] | Value is similar, including property types |
| [`method: GenericAssertions.toThrow`] | Function throws an error |
| [`method: GenericAssertions.any`] | Matches any instance of a class/primitive |
| [`method: GenericAssertions.anything`] | Matches anything |
| [`method: GenericAssertions.arrayContaining`] | Array contains specific elements |
| [`method: GenericAssertions.closeTo`] | Number is approximately equal |
| [`method: GenericAssertions.objectContaining`] | Object contains specific properties |
| [`method: GenericAssertions.stringContaining`] | String contains a substring |
| [`method: GenericAssertions.stringMatching`] | String matches a regular expression |

## Negating matchers

In general, we can expect the opposite to be true by adding a `.not` to the front
of the matchers:

```js
expect(value).not.toEqual(0);
await expect(locator).not.toContainText('some text');
```

## Soft assertions

By default, failed assertion will terminate test execution. Playwright also
supports *soft assertions*: failed soft assertions **do not** terminate test execution,
but mark the test as failed.

```js
// Make a few checks that will not stop the test when failed...
await expect.soft(page.getByTestId('status')).toHaveText('Success');
await expect.soft(page.getByTestId('eta')).toHaveText('1 day');

// ... and continue the test to check more things.
await page.getByRole('link', { name: 'next page' }).click();
await expect.soft(page.getByRole('heading', { name: 'Make another order' })).toBeVisible();
```

At any point during test execution, you can check whether there were any
soft assertion failures:

```js
// Make a few checks that will not stop the test when failed...
await expect.soft(page.getByTestId('status')).toHaveText('Success');
await expect.soft(page.getByTestId('eta')).toHaveText('1 day');

// Avoid running further if there were soft assertion failures.
expect(test.info().errors).toHaveLength(0);
```

Note that soft assertions only work with Playwright test runner.

## Custom expect message

You can specify a custom expect message as a second argument to the `expect` function, for example:

```js
await expect(page.getByText('Name'), 'should be logged in').toBeVisible();
```

This message will be shown in reporters, both for passing and failing expects, providing more context about the assertion.

When expect passes, you might see a successful step like this:

```txt
✅ should be logged in    @example.spec.ts:18
```

When expect fails, the error would look like this:

```bash
    Error: should be logged in

    Call log:
      - expect.toBeVisible with timeout 5000ms
      - waiting for "getByText('Name')"


      2 |
      3 | test('example test', async({ page }) => {
    > 4 |   await expect(page.getByText('Name'), 'should be logged in').toBeVisible();
        |                                                                  ^
      5 | });
      6 |
```

Soft assertions also support custom message:

```js
expect.soft(value, 'my soft assertion').toBe(56);
```

## expect.configure

You can create your own pre-configured `expect` instance to have its own
defaults such as `timeout` and `soft`.

```js
const slowExpect = expect.configure({ timeout: 10000 });
await slowExpect(locator).toHaveText('Submit');

// Always do soft assertions.
const softExpect = expect.configure({ soft: true });
await softExpect(locator).toHaveText('Submit');
```

## expect.poll

You can convert any synchronous `expect` to an asynchronous polling one using `expect.poll`.

The following method will poll given function until it returns HTTP status 200:

```js
await expect.poll(async () => {
  const response = await page.request.get('https://api.example.com');
  return response.status();
}, {
  // Custom expect message for reporting, optional.
  message: 'make sure API eventually succeeds',
  // Poll for 10 seconds; defaults to 5 seconds. Pass 0 to disable timeout.
  timeout: 10000,
}).toBe(200);
```

You can also specify custom polling intervals:

```js
await expect.poll(async () => {
  const response = await page.request.get('https://api.example.com');
  return response.status();
}, {
  // Probe, wait 1s, probe, wait 2s, probe, wait 10s, probe, wait 10s, probe
  // ... Defaults to [100, 250, 500, 1000].
  intervals: [1_000, 2_000, 10_000],
  timeout: 60_000
}).toBe(200);
```

## expect.toPass

You can retry blocks of code until they are passing successfully.

```js
await expect(async () => {
  const response = await page.request.get('https://api.example.com');
  expect(response.status()).toBe(200);
}).toPass();
```

You can also specify custom timeout and retry intervals:

```js
await expect(async () => {
  const response = await page.request.get('https://api.example.com');
  expect(response.status()).toBe(200);
}).toPass({
  // Probe, wait 1s, probe, wait 2s, probe, wait 10s, probe, wait 10s, probe
  // ... Defaults to [100, 250, 500, 1000].
  intervals: [1_000, 2_000, 10_000],
  timeout: 60_000
});
```

Note that by default `toPass` has timeout 0 and does not respect custom [expect timeout](./test-timeouts.md#expect-timeout).

## Add custom matchers using expect.extend

You can extend Playwright assertions by providing custom matchers. These matchers will be available on the `expect` object.

In this example we add a custom `toHaveAmount` function. Custom matcher should return a `message` callback and a `pass` flag indicating whether the assertion passed.

```js title="fixtures.ts"
import { expect as baseExpect } from '@playwright/test';
import type { Page, Locator } from '@playwright/test';

export { test } from '@playwright/test';

export const expect = baseExpect.extend({
  async toHaveAmount(locator: Locator, expected: number, options?: { timeout?: number }) {
    const assertionName = 'toHaveAmount';
    let pass: boolean;
    let matcherResult: any;
    try {
      await baseExpect(locator).toHaveAttribute('data-amount', String(expected), options);
      pass = true;
    } catch (e: any) {
      matcherResult = e.matcherResult;
      pass = false;
    }

    const message = pass
      ? () => this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
          '\n\n' +
          `Locator: ${locator}\n` +
          `Expected: ${this.isNot ? 'not' : ''}${this.utils.printExpected(expected)}\n` +
          (matcherResult ? `Received: ${this.utils.printReceived(matcherResult.actual)}` : '')
      : () =>  this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }) +
          '\n\n' +
          `Locator: ${locator}\n` +
          `Expected: ${this.utils.printExpected(expected)}\n` +
          (matcherResult ? `Received: ${this.utils.printReceived(matcherResult.actual)}` : '');

    return {
      message,
      pass,
      name: assertionName,
      expected,
      actual: matcherResult?.actual,
    };
  },
});
```

Now we can use `toHaveAmount` in the test.

```js title="example.spec.ts"
import { test, expect } from './fixtures';

test('amount', async () => {
  await expect(page.locator('.cart')).toHaveAmount(4);
});
```

### Compatibility with expect library

:::note
Do not confuse Playwright's `expect` with the [`expect` library](https://jestjs.io/docs/expect). The latter is not fully integrated with Playwright test runner, so make sure to use Playwright's own `expect`.
:::

### Combine custom matchers from multiple modules

You can combine custom matchers from multiple files or modules.

```js title="fixtures.ts"
import { mergeTests, mergeExpects } from '@playwright/test';
import { test as dbTest, expect as dbExpect } from 'database-test-utils';
import { test as a11yTest, expect as a11yExpect } from 'a11y-test-utils';

export const expect = mergeExpects(dbExpect, a11yExpect);
export const test = mergeTests(dbTest, a11yTest);
```

```js title="test.spec.ts"
import { test, expect } from './fixtures';

test('passes', async ({ database }) => {
  await expect(database).toHaveDatabaseUser('admin');
});
```
