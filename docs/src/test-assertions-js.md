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

## Polling

You can convert any synchronous `expect` to an asynchronous polling one using `expect.poll`.

The following method will poll given function until it returns HTTP status 200:

```js
await expect.poll(async () => {
  const response = await page.request.get('https://api.example.com');
  return response.status();
}, {
  // Custom error message
  message: 'make sure API eventually succeeds', // custom error message
  // Poll for 10 seconds; defaults to 5 seconds. Pass 0 to disable timeout.
  timeout: 10000,
}).toBe(200);
```


## API reference
See the following pages for Playwright-specific assertions:
- [APIResponseAssertions] assertions for [APIResponse]
- [LocatorAssertions] assertions for [Locator]
- [PageAssertions] assertions for [Page]
- [ScreenshotAssertions] for comparing screenshot with stored value
