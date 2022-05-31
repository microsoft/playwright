---
id: testing-library
title: "Migrating from Testing Library"
---

<!-- TOC -->

## Migration principles

This guide describes migration to Playwright's [Experimental Component Testing](./test-components) from [DOM Testing Library](https://testing-library.com/docs/dom-testing-library/intro/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), [Vue Testing Library](https://testing-library.com/docs/vue-testing-library/intro) and [Svelte Testing Library](https://testing-library.com/docs/svelte-testing-library/intro).

:::note
If you use DOM Testing Library in the browser (for example, you bundle end-to-end tests with webpack), you can switch directly to Playwright Test. Examples below are focused on component tests, but for end-to-end test you just need to replace `await mount` with `await page.goto('http://localhost:3000/')` to open the page under test.
:::

## Cheat Sheet

| Testing Library                                         | Playwright                                    |
|---------------------------------------------------------|-----------------------------------------------|
| [screen](https://testing-library.com/docs/queries/about#screen) | [page](./api/class-page) and [component](./api/class-locator) |
| [queries](https://testing-library.com/docs/queries/about) | [locators](./locators) |
| [async helpers](https://testing-library.com/docs/dom-testing-library/api-async) | [assertions](./test-assertions) |
| [user events](https://testing-library.com/docs/user-event/intro) | [actions](./api/class-locator) |
| `await user.click(screen.getByText('Click me'))`        | `await component.locator('text=Click me').click()` |
| `await user.click(await screen.findByText('Click me'))` | `await component.locator('text=Click me').click()` |
| `await user.type(screen.getByLabelText('Password'), 'secret')` | `await component.locator('text=Password').fill('secret')` |
| `expect(screen.getByLabelText('Password')).toHaveValue('secret')` | `await expect(component.locator('text=Password')).toHaveValue('secret')` |
| `screen.findByText('...')`                              | `component.locator('text=...')`                    |
| `screen.getByTestId('...')`                             | `component.locator('data-testid=...')`             |
| `screen.queryByPlaceholderText('...')`                  | `component.locator('[placeholder="..."]')`         |
| `screen.getAllByRole('button', { pressed: true })`      | `component.locator('role=button[pressed]')`        |

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
const { test, expect } = require('@playwright/experimental-ct-react'); // 1

test('should sign in', async ({ page, mount }) => { // 2
  // Setup the page.
  const component = await mount(<SignInPage />); // 3

  // Perform actions.
  await component.locator('text=Username').fill('John'); // 4
  await component.locator('text=Password').fill('secret');
  await component.locator('text=Sign in').click();

  // Verify signed in state by waiting until "Welcome" message appears.
  await expect(component.locator('text=Welcome, John')).toBeVisible(); // 5
});
```

Migration highlights (see inline comments in the Playwright Test code snippet):

1. Import everything from `@playwright/experimental-ct-react` (or -vue, -svelte) for component tests, or from `@playwright/test` for end-to-end tests.
1. Test function is given a `page` that is isolated from other tests, and `mount` that renders a component in this page. These are two of the [useful fixtures](./api/class-fixtures) in Playwright Test.
1. Replace `render` with `mount` that returns a [component locator](./locators).
1. Use locators created with [`method: Locator.locator`] or [`method: Page.locator`] to perform most of the actions.
1. Use [assertions](./test-assertions) to verify the state.

## Migrating queries

All queries like `getBy...`, `findBy...`, `queryBy...` and their multi-element counterparts are replaced with `page.locator('...')`. Locators always auto-wait and retry when needed, so you don't have to worry about choosing the right method. When you want to do a [list operation](./locators#lists), e.g. assert a list of texts, Playwright automatically performs multi-element opertations.

1. `getByRole`: use [role selector](./selectors#role-selector) `component.locator('role=button[name="Sign up"]')`.
1. `getByText`: use `component.locator('text=some value')` and other variations of the [text selector](./selectors#text-selector).
1. `getByTestId`: use [test id selectors](./selectors#id-data-testid-data-test-id-data-test-selectors), for example `component.locator('data-testid=some value')`.
1. `getByPlaceholderText`: use css alternative `component.locator('[placeholder="some value"]')`.
1. `getByAltText`: use css alternative `component.locator('[alt="some value"]')` or [role selector](./selectors#role-selector) `component.locator('role=img[name="some value"]')`.
1. `getByTitle`: use css alternative `component.locator('[title="some value"]')`

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
await expect.poll(async () => {
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
const messages = component.locator('id=messages')
const helloMessage = messages.locator('text=hello')
```

## Playwright Test Super Powers

Once you're on Playwright Test, you get a lot!

- Full zero-configuration TypeScript support
- Run tests across **all web engines** (Chrome, Firefox, Safari) on **any popular operating system** (Windows, macOS, Ubuntu)
- Full support for multiple origins, [(i)frames](./api/class-frame), [tabs and contexts](./pages)
- Run tests in isolation in parallel across multiple browsers
- Built-in test artifact collection: [video recording](./test-configuration#record-video), [screenshots](./test-configuration#automatic-screenshots) and [playwright traces](./test-configuration#record-test-trace)

Also you get all these ✨ awesome tools ✨ that come bundled with Playwright Test:
- [Playwright Inspector](./inspector)
- [Playwright Test Code generation](./auth#code-generation)
- [Playwright Tracing](./trace-viewer) for post-mortem debugging

## Further Reading

Learn more about Playwright Test runner:

- [Getting Started](./intro)
- [Experimental Component Testing](./test-components)
- [Locators](./api/class-locator)
- [Selectors](./selectors)
- [Assertions](./test-assertions)
- [Auto-waiting](./actionability)
