---
id: test-components-storybook
title: "Experimental: Storybook component stories"
---

Playwright Test can now test [Storybook](https://storybook.js.org) component stories. This allows you to test everything that Storybook supports, including: (1) renderers like React, Vue, Angular, Lit, Svelte, Solid, Qwik, and Ember, (2) metaframeworks like Next, Nuxt, and SvelteKit, and (3) builders like Webpack, Vite, and Rspack.

## Example

Here is a typical story:

```js
export default { component: Button };
export const Submit = { args: { title: 'Submit' } }
```

And here is that story reused in a test:

```js
import * as ButtonStories from './Button.stories';

test('event should work', async ({ mount }) => {
  let clicked = false;

  // Mount a component. Returns locator pointing to the component.
  const component = await mount(ButtonStories.Default, {
    onClick: () => { clicked = true },
  })

  // As with any Playwright test, assert locator text.
  await expect(component).toContainText('Submit');

  // Perform locator click. This will trigger the event.
  await component.click();

  // Assert that respective events have been fired.
  expect(clicked).toBeTruthy();
});
```

## How to get started

Adding Playwright Test with Storybook to your project is easy. 

### Step 0: Install Storybook

IF your project already uses Storybook, you can skip this step.

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


If you already use Storybook 

### Step 1: Install Playwright Test for Storybook

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
npm init playwright@latest -- --storybook
```

</TabItem>

<TabItem value="yarn">

```bash
yarn create playwright --storybook
```

</TabItem>

<TabItem value="pnpm">

```bash
pnpm dlx create-playwright --storybook
```

 </TabItem>
  
</Tabs>

### Step 2. Create a test file `src/Button.spec.ts`

Assuming you already have a story file `Button.stories.ts` with a `Default` story, you can import it and reference the import in the `mount` function:

```js
import { test, expect } from '@storybook/playwright-ct';
import * as ButtonStories from './Button.stories';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(ButtonStories.Default);
  await expect(component).toContainText('Button');
});
```

### Step 3. Run the tests

You can run tests using the [VS Code extension](./getting-started-vscode.md) or the command line.

```sh
npm run test-storybook
```

### Further reading: configure reporting, browsers, tracing

Refer to [Playwright config](./test-configuration.md) for configuring your project.

## Under the hood

Playwright Test executes Storybook's dev server in the background and runs tests against it.

Here is how this is achieved:

- Each story reference is converted into a story ID
- Upon the `mount` call within the test, Playwright navigates to corresponing story.
- Events are marshalled back to the Node.js environment to allow verification.

## Known issues and limitations

### Q) What's the difference between `@storybook/playwright-ct` and `@playwright/experimental-ct-{react,svelte,vue,solid}`?

Playwright CT is Playwright's recommended way to test components in isolation. Here is the same example from above, written for React:

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

| Playwright CT React                       | Playwright CT Storybook                                      |
| ----------------------------------------- | ------------------------------------------------------------ |
| Renders component(s)                      | Renders story                                                |
| Specifies props in test                   | Specifies props in story, can override in test               |
| Renders in CT dev server                  | Renders in Storybook dev server                              |
| Compatible with Vite                      | Compatible with Vite, Webpack, Rspack, etc.                  |
| Compatible with React, Solid, Svelte, Vue | Compatible with CT renderers + Angular, Web components, Qwik |
| Limitations on props, imports             | No known limitations                                         |

Playwright CT lacks the concept of stories, so the tests render the components directly. This has the benefit of being able to see the component setup and test all in one place, but leads to some limitations due to the fact that the test file is mixing Node and Browser code in a single file.

You should consider using Playwright CT Storybook over Playwright CT if:

- You already use Storybook for component development and documentation
- You're using a renderer that is not supported by Playwright CT (e.g. Angular)
- You're hitting up against any of the limitations of CT (e.g. test imports)

### Q) What's the difference between `@storybook/playwright-ct` and `@storybook/test-runner`?

Storybook also provides component testing with its [Test Runner](https://storybook.js.org/docs/react/writing-tests/test-runner) (that also uses Playwright under the hood).

Here's the same example using Storybook's play function:

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

| Storybook CT                             | Playwright CT Storybook                         |
| ---------------------------------------- | ----------------------------------------------- |
| Tests run in the browser                 | Tests run in node                               |
| Runs play function                       | Runs play function if present AND test function |
| Share & debug test in the browser        | Run and debug test in Playwright UI / debugger  |
| No need to write extra tests             | Write a test alongside your story as needed     |
| Interact using Testing Library           | Interact using all of Playwright facilities     |
| Compatible with Chromatic & SB ecosystem | Incompatible                                    |

The main difference between Storybook CT and Playwright CT is that Storybook's play functions are entirely browser-based. This means that you can publish and inspect your tests in a static build of Storybook in the cloud, which is great for collaboration debugging CI failures. The drawback of this approach is that some of Playwright's features, such as the ability to wait for network idle, are not unavailble in "user-land" browser code.

You should use Playwright CT Storybook over Storybook CT if:

- You prefer Playwright's test syntax
- You prefer Playwright's workflow (UI, debugger, etc)
- You need Playwright's richer facilities for interacting with the browser such as:
  - wait for network idle
  - truly force element pseudostates
  - evaluate arbitrary test code in the browser

```js
import { test, expect } from '@playwright/experimental-ct-react';
import HelloWorld from './HelloWorld';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(<HelloWorld msg="greetings" />);
  await expect(component).toContainText('Greetings');
});
```

</TabItem>

<TabItem value="vue">

```js
import { test, expect } from '@playwright/experimental-ct-vue';
import HelloWorld from './HelloWorld.vue';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(HelloWorld, {
    props: {
      msg: 'Greetings',
    },
  });
  await expect(component).toContainText('Greetings');
});
```

</TabItem>
  
<TabItem value="svelte">

```js
import { test, expect } from '@playwright/experimental-ct-svelte';
import HelloWorld from './HelloWorld.svelte';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(HelloWorld, {
    props: {
      msg: 'Greetings',
    },
  });
  await expect(component).toContainText('Greetings');
});
```

</TabItem>

<TabItem value="solid">

```js
import { test, expect } from '@playwright/experimental-ct-solid';
import HelloWorld from './HelloWorld';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(<HelloWorld msg="greetings" />);
  await expect(component).toContainText('Greetings');
});
```

</TabItem>

</Tabs>

Additionally, it adds some config options you can use in your `playwright-sb.config.{ts,js}`.

Finally, under the hood, each test re-uses the `context` and `page` fixture as a speed optimization for Component Testing.
It resets them in between each test so it should be functionally equivalent to `@playwright/test`'s guarantee that you get a new, isolated `context` and `page` fixture per-test.

### Q) Can I use `@playwright/test` and `@storybook/playwright-ct` together?

Yes. Use a Playwright Config for each and follow their respective guides ([E2E Playwright Test](https://playwright.dev/docs/intro), [Storybook Tests](https://playwright.dev/docs/test-components-storybook))
