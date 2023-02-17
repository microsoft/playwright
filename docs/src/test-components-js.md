---
id: test-components
title: "Experimental: components"
---

import LiteYouTube from '@site/src/components/LiteYouTube';

Playwright Test can now test your components.

<LiteYouTube
    id="y3YxX4sFJbM"
    title="Component testing"
/>

## Example

Here is what a typical component test looks like:

```js
test('event should work', async ({ mount }) => {
  let clicked = false;

  // Mount a component. Returns locator pointing to the component.
  const component = await mount(
    <Button title="Submit" onClick={() => { clicked = true }}></Button>
  );

  // As with any Playwright test, assert locator text.
  await expect(component).toContainText('Submit');

  // Perform locator click. This will trigger the event.
  await component.click();

  // Assert that respective events have been fired.
  expect(clicked).toBeTruthy();
});
```

## How to get started

Adding Playwright Test to an existing React, Vue, Svelte or Solid project is easy. Below are the steps to enable Playwright Test for a sample create-react-app with TypeScript template.

### Step 1: Install Playwright Test for components for your respective framework

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

This step creates several files in your workspace:

#### `playwright/index.html`

This file defines an html file that will be used to render components during testing.
It must contain element with `id="root"`, that's where components are mounted. It must
also link the script called `playwright/index.{js,ts,jsx,tsx}`.

```html
<html lang="en">
  <body>
    <div id="root"></div>
    <script type="module" src="./index.ts"></script>
  </body>
</html>
```

#### `playwright/index.ts`

You can include stylesheets, apply theme and inject code into the page where
component is mounted using this script. It can be either a `.js`, `.ts`, `.jsx` or `.tsx` file.

```js
// Apply theme here, add anything your component needs at runtime here.
```

### Step 2. Create a test file `src/App.spec.{ts,tsx}`

<Tabs
  defaultValue="react"
  values={[
    {label: 'React', value: 'react'},
    {label: 'Solid', value: 'solid'},
    {label: 'Svelte', value: 'svelte'},
    {label: 'Vue', value: 'vue'},
  ]
}>
<TabItem value="react">

```js
import { test, expect } from '@playwright/experimental-ct-react';
import App from './App';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(<App />);
  await expect(component).toContainText('Learn React');
});
```

</TabItem>

<TabItem value="vue">

```js
import { test, expect } from '@playwright/experimental-ct-vue';
import App from './App.vue';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(App);
  await expect(component).toContainText('Vite + Vue');
});
```

If using TypeScript and Vue make sure to add a `vue.d.ts` file to your project:

```ts
declare module '*.vue';
```

</TabItem>
  
<TabItem value="svelte">

```js
import { test, expect } from '@playwright/experimental-ct-svelte';
import App from './App.svelte';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(App);
  await expect(component).toContainText('Vite + Svelte');
});
```

</TabItem>

<TabItem value="solid">

```js
import { test, expect } from '@playwright/experimental-ct-solid';
import App from './App';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  const component = await mount(<App />);
  await expect(component).toContainText('Learn Solid');
});
```

</TabItem>

</Tabs>

### Step 3. Run the tests

You can run tests using the [VS Code extension](./getting-started-vscode.md) or the command line.

```sh
npm run test-ct
```

### Further reading: configure reporting, browsers, tracing

Refer to [Playwright config](./test-configuration.md) for configuring your project.

## Hooks

You can use `beforeMount` and `afterMount` hooks to configure your app. This lets you setup things like your app router, fake server etc. giving you the flexibility you need. You can also pass custom configuration from the `mount` call from a test, which is accessible from the `hooksConfig` fixture.

#### `playwright/index.{js,ts,jsx,tsx}`

This includes any config that needs to be run before or after mounting the component. An example of configuring a router is provided below:

<Tabs
  defaultValue="react"
  values={[
    {label: 'React', value: 'react'},
    {label: 'Solid', value: 'solid'},
    {label: 'Vue3', value: 'vue3'},
    {label: 'Vue2', value: 'vue2'},
  ]
}>
  <TabItem value="react">

  ```js
  // playwright/index.tsx
  import { beforeMount, afterMount } from '@playwright/experimental-ct-react/hooks';
  import { BrowserRouter } from 'react-router-dom';

  export type HooksConfig = {
    enableRouting?: boolean;
  }

  beforeMount<HooksConfig>(async ({ App, hooksConfig }) => {
    if (hooksConfig?.enableRouting)
      return <BrowserRouter><App /></BrowserRouter>;
  });
  ```

  #### In your test file:

  ```js
  // src/pages/ProductsPage.spec.tsx
  import { test, expect } from '@playwright/experimental-ct-react';
  import type { HooksConfig } from 'playwright';
  import { ProductsPage } from './pages/ProductsPage';

  test('configure routing through hooks config', async ({ page, mount }) => {
    const component = await mount<HooksConfig>(<ProductsPage />, {
      hooksConfig: { enableRouting: true },
    });
    await expect(component.getByRole('link')).toHaveAttribute('href', '/products/42');
  });
  ```

  </TabItem>

  <TabItem value="solid">

  ```js
  // playwright/index.tsx
  import { beforeMount, afterMount } from '@playwright/experimental-ct-solid/hooks';
  import { Router } from '@solidjs/router';

  export type HooksConfig = {
    enableRouting?: boolean;
  }

  beforeMount<HooksConfig>(async ({ App, hooksConfig }) => {
    if (hooksConfig?.enableRouting)
      return <Router><App /></Router>;
  });
  ```

  #### In your test file:

  ```js
  // src/pages/ProductsPage.spec.tsx
  import { test, expect } from '@playwright/experimental-ct-solid';
  import type { HooksConfig } from 'playwright';
  import { ProductsPage } from './pages/ProductsPage';

  test('configure routing through hooks config', async ({ page, mount }) => {
    const component = await mount<HooksConfig>(<ProductsPage />, {
      hooksConfig: { enableRouting: true },
    });
    await expect(component.getByRole('link')).toHaveAttribute('href', '/products/42');
  });
  ```

  </TabItem>

  <TabItem value="vue3">

  ```js
  // playwright/index.ts
  import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';
  import { router } from '../src/router';

  export type HooksConfig = {
    enableRouting?: boolean;
  }

  beforeMount<HooksConfig>(async ({ app, hooksConfig }) => {
    if (hooksConfig?.enableRouting)
      app.use(router);
  });
  ```

  #### In your test file:

  ```js
  // src/pages/ProductsPage.spec.ts
  import { test, expect } from '@playwright/experimental-ct-vue';
  import type { HooksConfig } from 'playwright';
  import ProductsPage from './pages/ProductsPage.vue';

  test('configure routing through hooks config', async ({ page, mount }) => {
    const component = await mount<HooksConfig>(ProductsPage, {
      hooksConfig: { enableRouting: true },
    });
    await expect(component.getByRole('link')).toHaveAttribute('href', '/products/42');
  });
  ```

  </TabItem>

  <TabItem value="vue2">
  
  ```js
  // playwright/index.ts
  import { beforeMount, afterMount } from '@playwright/experimental-ct-vue2/hooks';
  import Router from 'vue-router';
  import { router } from '../src/router';

  export type HooksConfig = {
    enableRouting?: boolean;
  }

  beforeMount<HooksConfig>(async ({ app, hooksConfig }) => {
    if (hooksConfig?.enableRouting) {
      Vue.use(Router);
      return { router }
    }
  });
  ```
   #### In your test file:

  ```js
  // src/pages/ProductsPage.spec.ts
  import { test, expect } from '@playwright/experimental-ct-vue2';
  import type { HooksConfig } from 'playwright';
  import ProductsPage from './pages/ProductsPage.vue';

  test('configure routing through hooks config', async ({ page, mount }) => {
    const component = await mount<HooksConfig>(ProductsPage, {
      hooksConfig: { enableRouting: true },
    });
    await expect(component.getByRole('link')).toHaveAttribute('href', '/products/42');
  });
  ```

  </TabItem>

</Tabs>

## Under the hood

When Playwright Test is used to test web components, tests run in Node.js, while components run in the real browser. This brings together the best of both worlds: components run in the real browser environment, real clicks are triggered, real layout is executed, visual regression is possible. At the same time, test can use all the powers of Node.js as well as all the Playwright Test features. As a result, the same parallel, parametrized tests with the same post-mortem Tracing story are available during component testing.

Here is how this is achieved:

- Once the tests are executed, Playwright creates a list of components that the tests need.
- It then compiles a bundle that includes these components and serves it using a local static web server.
- Upon the `mount` call within the test, Playwright navigates to the facade page `/playwright/index.html` of this bundle and tells it to render the component.
- Events are marshalled back to the Node.js environment to allow verification.

Playwright is using [Vite](https://vitejs.dev/) to create the components bundle and serve it.

## Known issues and limitations

### Q) I can't import anything other than the components from TSX/JSX/Component files

As per above, you can only import your components from your test file. If you have utility methods or constants in your TSX files, it is advised to extract them into the TS files and import those utility methods and constants from your component files and from your test files. That allows us to not load any of the component code in the Node-based test runner and keep Playwright fast at executing your tests.

### Q) I have a project that already uses Vite. Can I reuse the config?

At this point, Playwright is bundler-agnostic, so it is not reusing your existing Vite config. Your config might have a lot of things we won't be able to reuse. So for now, you would copy your path mappings and other high level settings into the `ctViteConfig` property of Playwright config.

```js
import { defineConfig } from '@playwright/experimental-ct-react';

export default defineConfig({
  use: {
    ctViteConfig: { ... },
  },
});
```

### Q) What's the difference between `@playwright/test` and `@playwright/experimental-ct-{react,svelte,vue,solid}`?

```ts
test('…', async { mount, page, context } => {
    // …
});
```

`@playwright/experimental-ct-{react,svelte,vue,solid}` wrap `@playwright/test` to provide an additional built-in component-testing specific fixture called `mount`:

<Tabs
  defaultValue="react"
  values={[
    {label: 'React', value: 'react'},
    {label: 'Solid', value: 'solid'},
    {label: 'Svelte', value: 'svelte'},
    {label: 'Vue', value: 'vue'},
  ]
}>
<TabItem value="react">

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

Additionally, it adds some config options you can use in your `playwright-ct.config.{ts,js}`.

Finally, under the hood, each test re-uses the `context` and `page` fixture as a speed optimization for Component Testing.
It resets them in between each test so it should be functionally equivalent to `@playwright/test`'s guarantee that you get a new, isolated `context` and `page` fixture per-test.

### Q) Can I use `@playwright/test` and `@playwright/experimental-ct-{react,svelte,vue,solid}`?

Yes. Use a Playwright Config for each and follow their respective guides ([E2E Playwright Test](https://playwright.dev/docs/intro), [Component Tests](https://playwright.dev/docs/test-components))

### Q) Why can't I pass a variable to mount?

This is a [known issue](https://github.com/microsoft/playwright/issues/14401). The following pattern does not work:

```js
const app = <App />;
await mount(app);
```

results in

```
undefined: TypeError: Cannot read properties of undefined (reading 'map')
```

while this works:

```js
await mount(<App />);
```

### Q) How can I use Vite plugins?

You can specify plugins via Vite config for testing settings. Note that once you start specifying plugins, you are responsible for specifying the framework plugin as well, `vue()` in this case:

```js
import { defineConfig, devices } from '@playwright/experimental-ct-vue';

import { resolve } from 'path';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';

export default defineConfig({
  testDir: './tests/component',
  use: {
    trace: 'on-first-retry',
    ctViteConfig: {
      plugins: [
        vue(),
        AutoImport({
          imports: [
            'vue',
            'vue-router',
            '@vueuse/head',
            'pinia',
            {
              '@/store': ['useStore'],
            },
          ],
          dts: 'src/auto-imports.d.ts',
          eslintrc: {
            enabled: true,
          },
        }),
        Components({
          dirs: ['src/components'],
          extensions: ['vue'],
        }),
      ],
      resolve: {
        alias: {
          '@': resolve(__dirname, './src'),
        },
      },
    },
  },
});
```

### Q) how can i test components that uses Pinia?

Pinia needs to be initialized in `playwright/index.{js,ts,jsx,tsx}`. If you do this inside a `beforeMount` hook, the `initialState` can be overwritten on a per-test basis:

```js
  // playwright/index.ts
  import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';
  import { createTestingPinia } from '@pinia/testing';
  import type { StoreState } from 'pinia';
  import type { useStore } from '../src/store';

  export type HooksConfig = {
    store?: StoreState<ReturnType<typeof useStore>>;
  }

  beforeMount<HooksConfig>(async ({ hooksConfig }) => {
    createTestingPinia({
      initialState: hooksConfig?.store,
      /**
       * Use http intercepting to mock api calls instead:
       * https://playwright.dev/docs/mock#mock-api-requests
       */
      stubActions: false,
      createSpy(args) {
        console.log('spy', args)
        return () => console.log('spy-returns')
      },
    });
  });
```

  #### In your test file:

```js
  // src/pinia.spec.ts
  import { test, expect } from '@playwright/experimental-ct-vue';
  import type { HooksConfig } from 'playwright';
  import Store from './Store.vue';

  test('override initialState ', async ({ mount }) => {
    const component = await mount<HooksConfig>(Store, {
      hooksConfig: {
        store: { name: 'override initialState' } 
      }
    });
    await expect(component).toContainText('override initialState');
  });
```
