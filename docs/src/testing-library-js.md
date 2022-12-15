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
| `await user.click(screen.getByText('Click me'))`        | `await component.getByText('Click me').click()` |
| `await user.click(await screen.findByText('Click me'))` | `await component.getByText('Click me').click()` |
| `await user.type(screen.getByLabel('Password'), 'secret')` | `await component.getByLabel('Password').fill('secret')` |
| `expect(screen.getByLabel('Password')).toHaveValue('secret')` | `await expect(component.getByLabel('Password')).toHaveValue('secret')` |
| `screen.findByText('...')`                              | `component.getByText('...')`                      |
| `screen.getByTestId('...')`                             | `component.getByTestId('...')`                    |
| `screen.queryByPlaceholderText('...')`                  | `component.getByPlaceholder('...')`            |
| `screen.getByRole('button', { pressed: true })`         | `component.getByRole('button', { pressed: true })`|

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
  await user.type(screen.getByLabel('Username'), 'John');
  await user.type(screen.getByLabel('Password'), 'secret');
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
  await component.getByText('Username').fill('John'); // 4
  await component.getByText('Password').fill('secret');
  await component.getByText('Sign in').click();

  // Verify signed in state by waiting until "Welcome" message appears.
  await expect(component.getByText('Welcome, John')).toBeVisible(); // 5
});
```

Migration highlights (see inline comments in the Playwright Test code snippet):

1. Import everything from `@playwright/experimental-ct-react` (or -vue, -svelte) for component tests, or from `@playwright/test` for end-to-end tests.
1. Test function is given a `page` that is isolated from other tests, and `mount` that renders a component in this page. These are two of the [useful fixtures](./api/class-fixtures) in Playwright Test.
1. Replace `render` with `mount` that returns a [component locator](./locators).
1. Use locators created with [`method: Locator.locator`] or [`method: Page.locator`] to perform most of the actions.
1. Use [assertions](./test-assertions) to verify the state.

## Migrating queries

All queries like `getBy...`, `findBy...`, `queryBy...` and their multi-element counterparts are replaced with `component.getBy...` locators. Locators always auto-wait and retry when needed, so you don't have to worry about choosing the right method. When you want to do a [list operation](./locators#lists), e.g. assert a list of texts, Playwright automatically performs multi-element operations.

## Replacing `waitFor`

Playwright includes [assertions](./test-assertions) that automatically wait for the condition, so you don't usually need an explicit `waitFor`/`waitForElementToBeRemoved` call.

```js
// Testing Library
await waitFor(() => {
  expect(getByText('the lion king')).toBeInTheDocument()
})
await waitForElementToBeRemoved(() => queryByText('the mummy'))

// Playwright
await expect(page.getByText('the lion king')).toBeVisible()
await expect(page.getByText('the mummy')).toBeHidden()
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
const helloMessage = messages.getByText('hello')
```

## Playwright Test Super Powers

Once you're on Playwright Test, you get a lot!

- Full zero-configuration TypeScript support
- Run tests across **all web engines** (Chrome, Firefox, Safari) on **any popular operating system** (Windows, macOS, Ubuntu)
- Full support for multiple origins, [(i)frames](./api/class-frame), [tabs and contexts](./pages)
- Run tests in isolation in parallel across multiple browsers
- Built-in test artifact collection: [video recording](./test-configuration#record-video), [screenshots](./test-configuration#automatic-screenshots) and [playwright traces](./test-configuration#record-test-trace)

You also get all these ✨ awesome tools ✨ that come bundled with Playwright Test:
- [Playwright Inspector](./debug.md)
- [Playwright Test Code generation](./auth#code-generation)
- [Playwright Tracing](./trace-viewer) for post-mortem debugging

## Further Reading

Learn more about Playwright Test runner:

- [Getting Started](./intro)
- [Experimental Component Testing](./test-components)
- [Locators](./locators.md)
- [Assertions](./test-assertions)
- [Auto-waiting](./actionability)
