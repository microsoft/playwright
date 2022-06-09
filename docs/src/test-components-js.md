---
id: test-components
title: "Experimental: components"
---

Playwright Test can now test your components.

<!-- TOC -->

## Example

Here is what a typical component test looks like:

```js
test('event should work', async ({ mount }) => {
  let clicked = false;

  // Mount a component. Returns locator pointing to the component.
  const component = await mount(<Button title='Submit'
    onClick={() => clicked = true}>
  </Button>);

  // As with any Playwright test, assert locator text.
  await expect(component).toContainText('Submit');

  // Perform locator click. This will trigger the event.
  await component.click();

  // Assert that respective events have been fired.
  expect(clicked).toBeTruthy();
});
```

## How to get started

Adding Playwright Test to an existing React, Vue or Svelte project is easy. Below are the steps to enable Playwright Test for a sample create-react-app with TypeScript template.

### Step 1: Install Playwright Test for components for your respective framework

```sh
npm init playwright@latest -- --ct
```

This step creates several files in your workspace:

#### `playwright/index.html`

This file defines an html file that will be used to render components during testing.
It must contain element with `id="root"`, that's where components are mounted. It must
also link the script called `playwright/index.[tj]s`.

```html
<html lang="en">
  <body>
    <div id="root"></div>
    <script type="module" src="/playwright/index.ts"></script>
  </body>
</html>
```

#### `playwright/index.ts`

You can include stylesheets, apply theme and inject code into the page where
component is mounted using this script. It can be either `.js` or `.ts` file.

```js
// Apply theme here, add anything your component needs at runtime here.
```

### Step 2. Create a test file `src/App.spec.tsx`

```js
import { test, expect } from '@playwright/experimental-ct-react';
import App from './App';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(<App></App>);
  await expect(component).toContainText('Learn React');
});
```

### Step 3. Run the tests

```sh
npm run test-ct
```

### Further reading: configure reporting, browsers, tracing

Refer to [Playwright config](./test-configuration.md) for configuring your project.

## Under the hood

When Playwright Test is used to test web components, tests run in Node.js, while components run in the real browser. This brings together the best of both worlds: components run in the real browser environment, real clicks are triggered, real layout is executed, visual regression is possible. At the same time, test can use all the powers of Node.js as well as all the Playwright Test features. As a result, the same parallel, parametrized tests with the same post-mortem Tracing story are available during component testing.

Here is how this is achieved:

- Once the tests are executed, Playwright creates a list of components that the tests need.
- It then compiles a bundle that includes these components and serves it using a local static web server.
- Upon the `mount` call within the test, Playwright navigates to the facade page `/playwright/index.html` of this bundle and tells it to render the component.
- Events are marshalled back to the Node.js environment to allow verification.

Playwright is using [Vite](https://vitejs.dev/) to create the components bundle and serve it.

## Known issues and limitations

Please refer to [this issue](https://github.com/microsoft/playwright/issues/14298) for the list of known issues and limitations.

## Planned work

- Watch mode: watch mode is highly anticipated and should be relatively straightforward in implementation.
