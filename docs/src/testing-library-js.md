---
id: testing-library
title: "Migrating from Testing Library"
---

## Migration principles

This guide describes migration to Playwright's [component testing](./test-components) from [DOM Testing Library](https://testing-library.com/docs/dom-testing-library/intro/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/) and [Vue Testing Library](https://testing-library.com/docs/vue-testing-library/intro).

:::note
If you use DOM Testing Library in the browser (for example, you bundle end-to-end tests with webpack), you can switch directly to Playwright Test. Examples below are focused on component tests, but for end-to-end test you just need to replace `await mount` with `await page.goto('http://localhost:3000/')` to open the page under test.
:::

Playwright renders a component through a **story** — a small wrapper that embeds the component in one specific scenario — served from a **gallery** page by your own dev server. Where Testing Library calls `render()` inline in the test, Playwright moves that setup into the story and refers to it by id from the test. See [Component testing](./test-components) for how to set up the gallery.

## Cheat Sheet

| Testing Library                                                                 | Playwright                                                             |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [screen](https://testing-library.com/docs/queries/about#screen)                 | [page](./api/class-page) and [component](./api/class-locator)          |
| [queries](https://testing-library.com/docs/queries/about)                       | [locators](./locators)                                                 |
| [async helpers](https://testing-library.com/docs/dom-testing-library/api-async) | [assertions](./test-assertions)                                        |
| [user events](https://testing-library.com/docs/user-event/intro)                | [actions](./api/class-locator)                                         |
| `await user.click(screen.getByText('Click me'))`                                | `await component.getByText('Click me').click()`                        |
| `await user.click(await screen.findByText('Click me'))`                         | `await component.getByText('Click me').click()`                        |
| `await user.type(screen.getByLabelText('Password'), 'secret')`                  | `await component.getByLabel('Password').fill('secret')`                |
| `expect(screen.getByLabelText('Password')).toHaveValue('secret')`               | `await expect(component.getByLabel('Password')).toHaveValue('secret')` |
| `screen.getByRole('button', { pressed: true })`                                 | `component.getByRole('button', { pressed: true })`                     |
| `screen.getByLabelText('...')`                                                  | `component.getByLabel('...')`                                          |
| `screen.queryByPlaceholderText('...')`                                          | `component.getByPlaceholder('...')`                                    |
| `screen.findByText('...')`                                                      | `component.getByText('...')`                                           |
| `screen.getByTestId('...')`                                                     | `component.getByTestId('...')`                                         |
| `render(<Component />);`                                                        | a story export + `await mount('Component/Default');`                   |
| `const { unmount } = render(<Component />);`                                    | `const component = await mount('...'); await component.unmount();`     |
| `const { rerender } = render(<Component />);`                                   | `const component = await mount('...'); await component.update(props);` |


## Example

Testing Library:

```js
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('sign in', async () => {
  // Setup the page.
  const user = userEvent.setup();
  render(<SignInPage />);

  // Perform actions.
  await user.type(screen.getByLabelText('Username'), 'John');
  await user.type(screen.getByLabelText('Password'), 'secret');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));

  // Verify signed in state by waiting until "Welcome" message appears.
  expect(await screen.findByText('Welcome, John')).toBeInTheDocument();
});
```

Line-by-line migration to Playwright Test. First, the scenario moves from the test into a story next to the component:

```js title="src/pages/SignInPage.story.tsx"
import { SignInPage } from './SignInPage';

export const Default = () => <SignInPage />; // 1
```

Then the test mounts that story by id:

```js
const { test, expect } = require('@playwright/test'); // 2

test('sign in', async ({ mount }) => { // 3
  // Setup the page.
  const component = await mount('pages/SignInPage/Default'); // 4

  // Perform actions.
  await component.getByLabel('Username').fill('John'); // 5
  await component.getByLabel('Password').fill('secret');
  await component.getByRole('button', { name: 'Sign in' }).click();

  // Verify signed in state by waiting until "Welcome" message appears.
  await expect(component.getByText('Welcome, John')).toBeVisible(); // 6
});
```

Migration highlights (see inline comments in the Playwright Test code snippets):

1. Whatever `render()` used to set up inline — props, providers, mock data — becomes a story export. Stories run in the browser, so live objects no longer have to cross into the test.
1. Import everything from `@playwright/test`, for both component and end-to-end tests.
1. Test function is given a `page` that is isolated from other tests, and `mount` that renders a story in this page. These are two of the [useful fixtures](./api/class-fixtures) in Playwright Test.
1. Replace `render` with [`method: Fixtures.mount`], which takes a story id and returns a [component locator](./locators) scoped to the gallery root.
1. Use locators created with [`method: Locator.locator`] or [`method: Page.locator`] to perform most of the actions.
1. Use [assertions](./test-assertions) to verify the state.

## Migrating queries

All queries like `getBy...`, `findBy...`, `queryBy...` and their multi-element counterparts are replaced with `component.getBy...` locators. Locators always auto-wait and retry when needed, so you don't have to worry about choosing the right method. When you want to do a [list operation](./locators#lists), e.g. assert a list of texts, Playwright automatically performs multi-element operations.

## Replacing `waitFor`

Playwright includes [assertions](./test-assertions) that automatically wait for the condition, so you don't usually need an explicit `waitFor`/`waitForElementToBeRemoved` call.

```js
// Testing Library
await waitFor(() => {
  expect(getByText('the lion king')).toBeInTheDocument();
});
await waitForElementToBeRemoved(() => queryByText('the mummy'));

// Playwright
await expect(page.getByText('the lion king')).toBeVisible();
await expect(page.getByText('the mummy')).toBeHidden();
```

When you cannot find a suitable assertion, use [`expect.poll`](./test-assertions#expectpoll) instead.

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
const messages = screen.getByTestId('messages');
const helloMessage = within(messages).getByText('hello');

// Playwright
const messages = component.getByTestId('messages');
const helloMessage = messages.getByText('hello');
```

## Playwright Test Super Powers

Once you're on Playwright Test, you get a lot!

- Full zero-configuration TypeScript support
- Run tests across **all web engines** (Chrome, Firefox, Safari) on **any popular operating system** (Windows, macOS, Ubuntu)
- Full support for multiple origins, [(i)frames](./api/class-frame), [tabs and contexts](./pages)
- Run tests in isolation in parallel across multiple browsers
- Built-in test [artifact collection](./test-use-options.md#recording-options)

You also get all these ✨ awesome tools ✨ that come bundled with Playwright Test:
- [Visual Studio Code integration](./getting-started-vscode.md)
- [UI mode](./test-ui-mode.md) for debugging tests with a time travel experience complete with watch mode.
- [Playwright Inspector](./debug.md#playwright-inspector)
- [Playwright Test Code generation](./codegen-intro.md)
- [Playwright Tracing](./trace-viewer.md) for post-mortem debugging

## Further Reading

Learn more about Playwright Test runner:

- [Getting Started](./intro)
- [Component testing](./test-components)
- [Locators](./locators.md)
- [Assertions](./test-assertions)
- [Auto-waiting](./actionability)
