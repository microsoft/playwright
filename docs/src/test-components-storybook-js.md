---
id: test-components-storybook
title: "Experimental: Storybook"
---

Playwright Test can now test components from [Storybook](https://storybook.js.org) stories. This allows you to test everything that Storybook supports, including: (1) renderers like React, Vue, Angular, Lit, Svelte, Solid, Qwik, and Ember, (2) metaframeworks like Next, Nuxt, and SvelteKit, and (3) builders like Webpack, Vite, and Rspack.

## Example

Here is a typical story. When you run Storybook, it will appear in Storybook's UI:

```js
// Button.stories.js
export default { component: Button };
export const Primary = { args: { label: 'Button', primary: true } }
```

And here is the same story reused in a Playwright CT test:

```js
// Button.spec.js
import * as ButtonStories from './Button.stories';

test('event should work', async ({ mount }) => {
  let clicked = false;

  // Mount a component. Returns locator pointing to the component.
  const component = await mount(ButtonStories.Primary, {
    onClick: () => { clicked = true },
  })

  // As with any Playwright test, assert locator text.
  await expect(component).toContainText('Button');

  // Perform locator click. This will trigger the event.
  await component.click();

  // Assert that respective events have been fired.
  expect(clicked).toBeTruthy();
});
```

## How to get started

Adding Playwright Test with Storybook to your project is easy. 

### Step 0: Install Storybook

If your project already uses Storybook, you can skip this step.

<Tabs
  defaultValue="npm"
  values={[
    {label: 'npm', value: 'npm'},
    {label: 'yarn', value: 'yarn'},
    {label: 'pnpm', value: 'pnpm'},
  ]
}>
<TabItem value="npm">

```bash
npx storybook@latest init
```

</TabItem>

<TabItem value="yarn">

```bash
yarn dlx storybook@latest init
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm dlx storybook@latest init
```

 </TabItem>
  
</Tabs>


Full installation and configuration instructions are available in the [Storybook documentation](https://storybook.js.org/docs/).

### Step 1: Install Playwright Test for Storybook

Run the Playwright CT installation and select **Storybook** when prompted:

<Tabs
  defaultValue="npm"
  values={[
    {label: 'npm', value: 'npm'},
    {label: 'yarn', value: 'yarn'},
    {label: 'pnpm', value: 'pnpm'},
  ]
}>
<TabItem value="npm">

```bash
npm init playwright@latest -- --ct
```

</TabItem>

<TabItem value="yarn">

```bash
yarn create playwright --ct
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm dlx create-playwright --ct
```

 </TabItem>
  
</Tabs>

### Step 2. Create a test file `src/Button.spec.ts`

Assuming you already have a story file `Button.stories.ts` with a `Primary` story, you can import it and reference the import in the `mount` function:

```js
import { test, expect } from '@storybook/playwright-ct';
import * as ButtonStories from './Button.stories';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(ButtonStories.Primary);
  await expect(component).toContainText('Button');
});
```

### Step 3. Run the tests

You can run tests using the [VS Code extension](./getting-started-vscode.md) or the command line.

```sh
npm run test-ct
```

### Further reading: configure reporting, browsers, tracing

Refer to [Playwright config](./test-configuration.md) for configuring your project.

## Working with complex components

The examples so far have all dealt with simple components that don't require any context (e.g. routers, themes, etc.) to render. Storybook has a number of constructs to set up your complex components.

For more information please see the Storybook docs for your framework:
- [How to write stories](https://storybook.js.org/docs/react/writing-stories/introduction)
- [Decorators for wrapping stories](https://storybook.js.org/docs/react/writing-stories/decorators)

## Under the hood

Playwright Test executes Storybook's dev server in the background and runs tests against it.

Here is how this is achieved:

- Each story reference is converted into a story ID
- Upon the `mount` call within the test, Playwright navigates to the corresponding story
- Events are marshalled back to the Node.js environment to allow verification

Finally, under the hood, each test re-uses the `context` and `page` fixture as a speed optimization for Component Testing.
It resets them in between each test so it should be functionally equivalent to `@playwright/test`'s guarantee that you get a new, isolated `context` and `page` fixture per-test.

## Known issues and limitations

### Q) What's the difference between `@storybook/playwright-ct` and `@playwright/experimental-ct-{react,svelte,vue,solid}`?

Playwright Experimental CT is Playwright's experimental way to test components in isolation. Here is the same example from above, written for React:

```ts
// Button.spec.ts
import { test, expect } from '@playwright/experimental-ct-react';
import Button from './Button';

test('interacts', async ({ mount }) => {
  let count = 0;
  const button = await mount(
    <Button
      label="Button"
      primary
      onClick={() => {
        count += 1;
      }}
    />
  );
  await button.click();
  await expect(count).toBe(1);
});
```

There are a few key differences here:

| Playwright Experimental CT                | Playwright CT for Storybook                                  |
| ----------------------------------------- | ------------------------------------------------------------ |
| Renders component(s)                      | Renders story                                                |
| Specifies props in test                   | Specifies props in story, can override in test               |
| Renders in CT dev server                  | Renders in Storybook dev server                              |
| Compatible with Vite                      | Compatible with Vite, Webpack, Rspack, etc.                  |
| Compatible with React, Solid, Svelte, Vue | Compatible with CT renderers + Angular, Web components, Qwik |
| Limitations on props, imports             | No known limitations                                         |

Playwright Experimental CT lacks the concept of stories, so the tests render the components directly. This has the benefit of being able to see the component setup and test all in one place, but leads to some limitations due to the fact that the test file is mixing Node and Browser code in a single file.

You should consider using Playwright CT for Storybook over Playwright Experimental CT if:

- You develop your components in Storybook
- You're using a renderer that is not supported by Playwright CT (e.g. Angular)
- Your component build system is based on Webpack (or Rspack)
- You're hitting up against any of the limitations of CT (e.g. test imports)

### Q) What's the difference between `@storybook/playwright-ct` and `@storybook/test-runner`?

Storybook also provides component testing with its [Test Runner](https://storybook.js.org/docs/react/writing-tests/test-runner) (that also uses Playwright under the hood).

Here's the same example using Storybook's play function, which is automatically executed after story render:

```ts
// Button.stories.ts
import { within, userEvent } from '@storybook/testing-library';
import { expect } from '@storybook/jest';

import { Button } from './Button';
export default { component: Button }

let count = 0;
export const Interaction {
  args: { label: 'Button', primary: true, onClick: () => { count += 1 } },
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole('button'));
    await expect(count).toBe(1);
  }
}
```

| Storybook test runner                    | Playwright CT for Storybook                     |
| ---------------------------------------- | ----------------------------------------------- |
| Tests run in the browser                 | Tests run in node                               |
| Runs play function                       | Runs play function if present AND test function |
| Share & debug test in the browser        | Run and debug test in Playwright UI / debugger  |
| No need to write extra tests             | Write a test alongside your story as needed     |
| Interact using Testing Library           | Interact using all of Playwright facilities     |
| Compatible with Chromatic & SB ecosystem | Incompatible                                    |

The main difference between Storybook Test Runner and Playwright CT is that Storybook's play functions are entirely browser-based. This means that you can publish and inspect your tests in a static build of Storybook in the cloud, which is great for collaboration debugging CI failures. The drawback of this approach is that some of Playwright's features, such as the ability to wait for network idle, are not unavailble in "user-land" browser code.

You should use Playwright CT Storybook over Storybook Test Runner if:

- You prefer Playwright's test syntax
- You prefer Playwright's workflow (UI, debugger, etc)
- You need Playwright's richer facilities for interacting with the browser such as:
  - wait for network idle
  - truly force element pseudostates
  - evaluate arbitrary test code in the browser

### Q) Can I use `@playwright/test` and `@storybook/playwright-ct` together?

Yes. Use a Playwright Config for each and follow their respective guides ([E2E Playwright Test](https://playwright.dev/docs/intro), [CT for Storybook](https://playwright.dev/docs/test-components-storybook))

### Q) Can I use `@playwright/experimental-ct-{react,svelte,vue,solid}` and `@storybook/playwright-ct` together?

No. Both CT approaches use the same config filename and perform conflicting babel file transformations on your `.spec` files. So, for now choose one approach or the other.