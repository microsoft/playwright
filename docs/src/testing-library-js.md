---
id: testing-library
title: "Migrating from Testing Library"
---

<!-- TOC -->

## Migration Principes

If you use DOM Testing Library in the browser (for example, you bundle tests with webpack), follow this guide for straightforward migration to Playwright Test.
If you use JSDOM + Testing Library setup, you'll need to switch from `render`ing markup to serving the page under test and navigating to it with [`method: Page.goto`].

- Testing Lirbary [`screen`](https://testing-library.com/docs/queries/about#screen) ⇄ Playwright [page](./api/class-page).
- Testing Library [quieries](https://testing-library.com/docs/queries/about) ⇄ Playwright [locators](./locators.md).
- Testing Library [async helpers](https://testing-library.com/docs/dom-testing-library/api-async) ⇄ Playwright [assertions](./test-assertions).
- Testing Library [user events](https://testing-library.com/docs/user-event/intro) ⇄ Playwright locator [actions](./api/class-locator).

## Cheat Sheet

| Testing Library                                         | Playwright                                    |
|---------------------------------------------------------|-----------------------------------------------|
| `await user.click(screen.getByText('Click me'))`        | `await page.locator('text=Click me').click()` |
| `await user.click(await screen.findByText('Click me'))` | `await page.locator('text=Click me').click()` |
| `await user.type(screen.getByLabelText('Password'), 'secret')` | `await page.locator('text=Password').fill('secret')` |
| `expect(screen.getByLabelText('Password')).toHaveValue('secret')` | `await expect(page.locator('text=Password')).toHaveValue('secret')` |
| `screen.findByText('...')`                              | `page.locator('text=...')`                    |
| `screen.getByTestId('...')`                             | `page.locator('data-testid=...')`             |
| `screen.queryByPlaceholderText('...')`                  | `page.locator('[placeholder="..."]')`         |
| `screen.getAllByRole('button', { pressed: true })`      | `page.locator('role=button[pressed]')`        |

## Example

Testing Library:

```js
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('should sign in', async () => {
  // Setup the page.
  const user = userEvent.setup();
  render(<SignInPage />);

  // Perform actions.
  await user.type(screen.getByLabelText('Username'), 'John');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByText('Sign in'));

  // Verify signed in state by waiting until "Welcome" message appears.
  await screen.findByText('Welcome, John');
});
```

Line-by-line migration to Playwright Test:

```js
const { test, expect } = require('@playwright/test'); // 1

test('should sign in', async ({ page }) => { // 2
  // Setup the page.
  await page.goto('https://localhost:3000/signin'); // 3

  // Perform actions.
  await page.locator('text=Username').fill('John'); // 4
  await page.locator('text=Password').fill('secret');
  await page.locator('text=Sign in').click();

  // Verify signed in state by waiting until "Welcome" message appears.
  await expect(page.locator('text=Welcome, John')).toBeVisible(); // 5
});
```

Migration highlights (see inline comments in the Playwright Test code snippet):

1. Import everything from `@playwright/test` package.
1. Test function is given a `page` that is isolated from other tests. This is one of the many [useful fixtures](./api/class-fixtures) in Playwright Test.
1. Instead of rendering markup, navigate to the page under test.
1. Use locators created with [`method: Page.locator`] to perform most of the actions.
1. Use [assertions](./test-assertions) to verify the state.

## Migrating queries

All queries like `getBy...`, `findBy...`, `queryBy...` and their multi-element counterparts are replaced with `page.locator('...')`. Locators always auto-wait and retry when needed, so you don't have to worry about choosing the right method. When you want to do a [list operation](./locators.md#lists), e.g. assert a list of texts, Playwright automatically performs multi-element opertations.

1. `getByText`: use `page.locator('text=some value')` and other variations of the [text selector](./selectors.md#text-selector).
1. `getByTestId`: use [test id selectors](./selectors.md#id-data-testid-data-test-id-data-test-selectors), for example `page.locator('data-testid=some value')`.
1. `getByPlaceholderText`: use css alternative `page.locator('[placeholder="some value"]')`.
1. `getByAltText`: use css alternative `page.locator('[alt="some value"]')` or [role selector](./selectors.md#role-selector) `page.locator('role=img[name="some value"]')`.
1. `getByTitle`: use css alternative `page.locator('[title="some value"]')`
1. `getByRole`: use [role selector](./selectors.md#role-selector) `page.locator('role=button[name="Sign up"]')`.

## Replacing `waitFor`

Playwright includes [assertions](./test-assertions) that automatically wait for the condition, so you don't usually need an explicit `waitFor`/`waitForElementToBeRemoved` call.

```js
// Testing Library
await waitFor(() => {
  expect(getByText('the lion king')).toBeInTheDocument()
})
await waitForElementToBeRemoved(() => queryByText('the mummy'))

// Playwright
await expect(page.locator('text=the lion king')).toBeVisible()
await expect(page.locator('text=the mummy')).toBeHidden()
```

When you cannot find a suitable assertion, use [`expect.poll`](./test-assertions#polling) instead.

```js
expect.poll(async () => {
  const response = await page.request.get('https://api.example.com');
  return response.status();
}).toBe(200);
```

## Replacing `within`

You can create a locator inside another locator with [`method: Locator.locator`] method.

```js
// Testing Library
const messages = document.getElementById('messages')
const helloMessage = within(messages).getByText('hello')

// Playwright
const messages = page.locator('id=messages')
const helloMessage = messages.locator('text=hello')
```

## Playwright Test Super Powers

Once you're on Playwright Test, you get a lot!

- Full zero-configuration TypeScript support
- Run tests across **all web engines** (Chrome, Firefox, Safari) on **any popular operating system** (Windows, MacOS, Ubuntu)
- Full support for multiple origins, [(i)frames](./api/class-frame), [tabs and contexts](./pages)
- Run tests in parallel across multiple browsers
- Built-in test artifact collection: [video recording](./test-configuration#record-video), [screenshots](./test-configuration#automatic-screenshots) and [playwright traces](./test-configuration#record-test-trace)

Also you get all these ✨ awesome tools ✨ that come bundled with Playwright Test:
- [Playwright Inspector](./inspector)
- [Playwright Test Code generation](./auth#code-generation)
- [Playwright Tracing](./trace-viewer) for post-mortem debugging

## Further Reading

Learn more about Playwright Test runner:

- [Getting Started](./intro)
- [Locators](./api/class-locator)
- [Selectors](./selectors)
- [Assertions](./test-assertions)
- [Auto-waiting](./actionability)
