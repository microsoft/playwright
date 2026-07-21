---
id: test-components
title: "Component testing"
---

## Introduction

Playwright Test can test the components of your web application in isolation. A component test is a regular Playwright end-to-end test that runs against a small **story gallery** page served by your own dev server. There is no dedicated component-testing runtime, no bundler integration and no extra npm packages — the built-in [`method: Fixtures.mount`] fixture of `@playwright/test` drives it all.

```js
import { test, expect } from '@playwright/test';

test('click should expand', async ({ mount }) => {
  const component = await mount('components/Expandable/Stateful');
  await component.getByRole('button').click();
  await expect(component.getByTestId('expanded')).toHaveValue('true');
});
```

Tests run in Node.js while components run in a real browser: real clicks are triggered, real layout is executed, visual regression is possible. At the same time, tests get everything Playwright Test offers: parallelism, parametrization, retries and post-mortem tracing.

:::note
This guide replaces the experimental `@playwright/experimental-ct-react` and `@playwright/experimental-ct-vue` packages. If you are using them today, see the [migration guide](#migration-from-the-experimental-packages) below.
:::

## Why a framework-agnostic approach

The `@playwright/experimental-ct-*` packages let tests write JSX inline — `mount(<Button onClick={spy} />)`. To make that possible, Playwright had to control the entire pipeline: scan the tests for components, compile a bundle with its own copy of Vite and its own config, serve it from its own server, and marshal props and callbacks across the Node.js/browser boundary.

That design kept the packages experimental forever:

- **It only worked when your setup matched ours.** Path aliases, plugins and CSS handling had to be mirrored into `ctViteConfig` by hand. Projects on webpack, Next.js or custom pipelines could not use their own build at all. Every framework needed its own package with its own runtime glue, and every new framework meant yet another package.
- **The Node.js/browser boundary leaked.** JSX written in a test was compiled in Node.js and reassembled in the browser. Live objects could not cross, callbacks only half-worked through marshalling, and module mocks silently did not apply.

The replacement inverts the control:

- **You own the pipeline.** Components are built and served by your own dev server, with your plugins, your aliases and your CSS. Playwright does not compile or serve anything — it navigates to a page, like in any other test.
- **It is framework-agnostic.** The only framework-specific piece is the gallery page — a small module that you own. React, Vue, Svelte, Solid or anything else: if your dev server can render it, Playwright can test it.
- **It is stable.** Tests import `test` and `expect` from plain `@playwright/test`, and [`method: Fixtures.mount`] is a documented built-in fixture. There is no experimental package to depend on and no separate config dialect.

## How it works

Three concepts make up the whole model:

- A **story** is a tiny wrapper component that embeds the component under test in one specific scenario: hard-coded props, mock data, providers, recorded callbacks. Stories live next to the component in `*.story.tsx` (or `.ts`/`.jsx`/`.js`/`.vue`) files; each named export is one story.
- The **gallery** is a single page, served by your dev server, that exposes `window.mount(params)` and `window.unmount()` functions rendering a story — resolved from your story files — into a `#root` element. It is framework-specific and yours to own.
- The [`method: Fixtures.mount`] fixture navigates to the gallery ([`property: TestOptions.baseURL`]), calls `window.mount()` with the story id and props, and returns a [Locator] for the gallery root. Scope your queries from it: `component.getByRole('button').click()`.

Everything the component needs is set up *inside the story*, which runs in the browser. Everything the test asserts is observable *through the page*: DOM, URL, network.

## Getting started

### Step 1: Point your coding agent at the skill

The gallery is application code — it belongs to you, not to Playwright. The fastest way to get one is to not write it yourself: Playwright ships this entire methodology as an agent skill. Install the skills and ask your coding agent (Claude Code, GitHub Copilot or similar) to do the setup:

```bash
npx playwright init-skills
```

```txt
Set up component testing using the playwright-component-testing skill.
```

The agent detects your framework and bundler, implements the gallery for your stack, adds a Playwright project to the config, and writes the first story and spec.

The contract the gallery fulfills is small and worth knowing, even if you never open the file:

- It is a single page under `playwright/gallery/`, served by **your own dev server** — Vite apps serve it with the dev server they already run; other setups run a small standalone Vite server next to the app.
- It discovers your `*.story.*` files and exposes two functions: `window.mount({ story, props })` renders the story with the given id into a `#root` element, and `window.unmount()` tears it down. An unknown story or a render error rejects, which surfaces as the test's `mount()` call throwing.
- It reuses the rendering root across calls, so `component.update(props)` reconciles instead of remounting and component state is preserved.
- It imports your global CSS the same way the app entry does, and the body of `window.mount` is the natural place for app-wide setup — the equivalent of the old `beforeMount`/`afterMount` hooks.

If you prefer to write the gallery by hand, the installed skill contains the full specification with worked React and Vue examples in `references/gallery-spec.md` — the whole page is a few dozen lines.

### Step 2: Configure Playwright

Add a project to your `playwright.config.ts` and point `baseURL` at the gallery:

```js title="playwright.config.ts"
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  projects: [
    {
      name: 'components',
      testDir: './tests/components',
      use: {
        ...devices['Desktop Chrome'],
        baseURL: 'http://localhost:5173/playwright/gallery/index.html',
        serviceWorkers: 'block',
        reuseContext: true,
      },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/playwright/gallery/index.html',
    reuseExistingServer: !process.env.CI,
  },
});
```

`mount` navigates to `baseURL`, so it must point at the gallery. `serviceWorkers: 'block'` keeps the app's own service worker from serving cached responses that would shadow your `page.route()` mocks. `reuseContext: true` reuses the browser context between tests in a worker — a large speedup for component suites, and the same optimization the experimental packages applied implicitly.

### Step 3: Write a story

Stories live next to the component they exercise. Each named export is one scenario:

```js title="src/components/Button.story.tsx"
import { Button } from './Button';

export const Primary = () => <Button title='Submit' />;

export const Disabled = () => <Button title='Submit' disabled />;
```

### Step 4: Write a test

```js title="tests/components/button.spec.ts"
import { test, expect } from '@playwright/test';

test('renders primary button', async ({ mount }) => {
  const component = await mount('components/Button/Primary');
  await expect(component.getByRole('button')).toHaveText('Submit');
});

test('disabled button is disabled', async ({ mount }) => {
  const component = await mount('components/Button/Disabled');
  await expect(component.getByRole('button')).toBeDisabled();
});
```

### Step 5: Run

```sh
npx playwright test --project=components
```

## Stories as a methodology

Stories are not just a testing workaround — they are greppable, reviewable documentation of your component states, and the conventions keep them that way:

- **One export per scenario.** Prefer a new story export over parameterizing an existing one. `Button.story.tsx` exporting `Primary`, `Disabled`, `WithLongTitle` reads as a specification of the component.
- **Stories live next to the component.** `src/components/Button.story.tsx` documents `src/components/Button.tsx`. Renames and refactors touch both together.
- **Story ids are derived from the file path**: path under `src/` without the `.story.*` extension, plus the export name — `components/Button/Primary`. Any unique suffix works too: `mount('Button/Primary')`.
- **The story owns everything the component needs**: providers, mock data, state, callbacks. The test owns nothing but interactions and assertions.

Because every story is a named, addressable page state, the gallery doubles as a living catalog: open the gallery URL in a browser and render any story to inspect it by eye.

## Testing patterns

### Record state for assertions

Components take callbacks; tests want to assert they fired. Instead of marshalling callbacks between Node.js and the browser, **the story owns the state and provides the callbacks** — and records the observable outcome into a hidden form next to the component:

<Tabs
  groupId="js-framework"
  defaultValue="react"
  values={[
    {label: 'React', value: 'react'},
    {label: 'Vue', value: 'vue'},
  ]
}>
<TabItem value="react">

```js title="src/components/Expandable.story.tsx"
import { useState } from 'react';
import { Expandable } from './Expandable';

export const Stateful = () => {
  const [expanded, setExpanded] = useState(false);
  return <>
    <Expandable expanded={expanded} setExpanded={setExpanded} title='Title'>Details</Expandable>
    <form hidden><input data-testid='expanded' readOnly value={String(expanded)} /></form>
  </>;
};
```

</TabItem>
<TabItem value="vue">

```js title="src/components/Expandable.story.ts"
import { defineComponent, h, ref } from 'vue';
import Expandable from './Expandable.vue';

export const Stateful = defineComponent(() => {
  const expanded = ref(false);
  return () => h('div', [
    h(Expandable, {
      'expanded': expanded.value,
      'onUpdate:expanded': (value: boolean) => expanded.value = value,
      'title': 'Title',
    }),
    h('form', { hidden: true }, [
      h('input', { 'data-testid': 'expanded', 'readonly': true, 'value': String(expanded.value) }),
    ]),
  ]);
});
```

</TabItem>
</Tabs>

```js title="tests/components/expandable.spec.ts"
test('click should expand', async ({ mount }) => {
  const component = await mount('components/Expandable/Stateful');
  await component.getByRole('button').click();
  await expect(component.getByTestId('expanded')).toHaveValue('true');
});
```

This pattern is the heart of the methodology:

- The whole scenario runs in the browser — no callback marshalling, no Node.js/browser boundary to leak through.
- `toHaveValue()` is a web-first assertion: it retries until the state lands, so there is nothing to await or poll manually.
- Record each observed value in its own `data-testid` input — `String(...)` for scalars, `JSON.stringify(...)` for payloads. The negative direction works the same way: perform the operation, then assert the value did **not** change.
- The recorded state is *visible when you open the story in the gallery*. Click the component by hand and watch the values change — the story doubles as a manual test page for the exact scenario the automated test covers. Keep the form `hidden` for a clean screenshot baseline, or drop the `hidden` attribute while developing to see the state live next to the component.

### Per-test props

When a scenario is genuinely parametric — a boundary-value sweep, a text matrix — pass plain serializable props as the second argument to `mount`. The gallery hands them to the story as its props:

```js title="src/components/Button.story.tsx"
import { Button } from './Button';

export const WithTitle = ({ title = 'Default' }: { title?: string }) =>
  <Button title={title} />;
```

```js title="tests/components/button.spec.ts"
import type { WithTitle } from '../../src/components/Button.story';

const component = await mount<typeof WithTitle>('Button/WithTitle', { title: 'Hello' });
```

`mount` is generic over the story: pass the story type as a template argument and the props (and `update()`) are type-checked against the story signature. Keep props to plain serializable data — callbacks belong inside the story.

### Prop transitions with `update()`

To test how a component reacts to a prop change **without remounting** — state preserved — call `component.update(newProps)`. It re-renders the same story with new props on the existing root:

```js
const component = await mount('components/Counter/Default', { value: 1 });
await expect(component.getByTestId('value')).toHaveText('1');
await component.update({ value: 2 });
await expect(component.getByTestId('value')).toHaveText('2');
```

### Multiple states and visual comparison

Each `mount()` navigates fresh, so tests are fully isolated and mounting several stories in one test is cheap:

```js
await expect(await mount('Button/Primary')).toHaveScreenshot('primary.png');
await expect(await mount('Button/Disabled')).toHaveScreenshot('disabled.png');
```

Screenshot the returned root locator, not the page, to avoid asserting on browser chrome.

### Handling network requests

Use [`method: Page.route`] as usual — register routes before `mount()`, since mounting navigates:

```js
test('renders the error state', async ({ page, mount }) => {
  await page.route('**/api/items', route => route.fulfill({ status: 500 }));
  const component = await mount('components/ItemList/Default');
  await expect(component.getByRole('alert')).toContainText('Something went wrong');
});
```

The `serviceWorkers: 'block'` option from the config keeps the app's own service worker from serving cached responses that would shadow the routes. Teams with [MSW](https://mswjs.io/) handler libraries can start the worker inside a story or decorator instead.

### Debugging stories

Open the gallery URL in a browser and call `await window.mount({ story: 'components/Button/Primary' })` from the DevTools console — that is exactly what the `mount` fixture does. An unknown story or a render error rejects `window.mount`, which surfaces as the test's `mount()` throwing with a real stack. To browse without the console, give your gallery an optional index page listing all discovered stories.

## Migration from the experimental packages

The experimental packages compiled JSX in the test file and marshalled it into the browser. The gallery pattern moves the scenario into a story export that runs natively in the browser. Here is how the concepts map:

| `@playwright/experimental-ct-*` | Story gallery |
|---|---|
| `mount(<Button onClick={spy} />)` | Stateful story: the story provides `onClick` and records the effect into a hidden input; the test asserts with `toHaveValue()` |
| Plain data props from the test | Unchanged in spirit: `mount(id, props)` |
| JSX children / slots from the test | One story export per composition (Vue: a `.story.vue` file for slot-heavy scenarios) |
| `component.update(<Button count={2} />)` | `component.update({ count: 2 })` |
| `component.unmount()` | `component.unmount()` |
| `beforeMount` / `afterMount` hooks | The body of the gallery's `window.mount` (global), or story decorators (per-story) |
| `hooksConfig` per-test variation | Props: `mount('App/Routing', { route: '/dashboard' })`, interpreted by the story |
| `router` fixture / MSW handlers in Node.js | [`method: Page.route`] in the test, or MSW `setupWorker` inside a story |
| `playwright/index.html` (styles, theme) | The gallery's `index.html` and entry module imports |
| `ctViteConfig`, `ctPort`, `ctTemplateDir` | Gone — the gallery runs through your own dev server; the port lives in `webServer` and `baseURL` |
| `defineConfig` from the ct package | Plain `defineConfig` from `@playwright/test` |

A typical spec migrates like this:

```js title="Before: button.spec.tsx"
import { test, expect } from '@playwright/experimental-ct-react';
import Button from '../src/components/Button';

test('counts clicks', async ({ mount }) => {
  let clicks = 0;
  const component = await mount(<Button title='Submit' onClick={() => ++clicks} />);
  await component.getByRole('button').click();
  expect(clicks).toBe(1);
});
```

```js title="After: src/components/Button.story.tsx"
import { useState } from 'react';
import { Button } from './Button';

export const CountsClicks = () => {
  const [clicks, setClicks] = useState(0);
  return <>
    <Button title='Submit' onClick={() => setClicks(count => count + 1)} />
    <form hidden><input data-testid='click-count' readOnly value={String(clicks)} /></form>
  </>;
};
```

```js title="After: tests/components/button.spec.ts"
import { test, expect } from '@playwright/test';

test('counts clicks', async ({ mount }) => {
  const component = await mount('components/Button/CountsClicks');
  await component.getByRole('button').click();
  await expect(component.getByTestId('click-count')).toHaveValue('1');
});
```

Migrate incrementally: set up the gallery and the `components` project while the old CT project keeps running, port spec by spec, then drop the `@playwright/experimental-ct-*` dependency along with `playwright/index.html`, `playwright/index.ts` and `playwright/.cache`.

Things to watch for:

- **Story ids are strings.** Renaming or moving a story breaks specs at runtime, not compile time. Using `mount<typeof Story>` at least ties the props to the story at compile time.
- **Per-test JSX is gone.** A test that built a different JSX tree per test becomes one story export per composition — which is the point: every composition worth testing is worth naming and reviewing.

## Frequently asked questions

### How do I access the component's methods or its instance?

Accessing a component's internal methods or its instance within test code is neither recommended nor supported. Instead, focus on observing and interacting with the component from a user's perspective — click it, look at the page, and record internal effects into the DOM through the story. Tests become less fragile and more valuable when they avoid implementation details. If a test fails when run from a user's perspective, it likely means the automated test has uncovered a genuine bug.

### Can I keep using my bundler plugins, aliases and CSS setup?

Yes — that is the core of the design. The gallery is served by your own dev server, so whatever your app can render, your stories can render. There is no second bundler config to keep in sync.

### What about frameworks other than React and Vue?

Ask your coding agent to implement the gallery contract for your framework: resolve a story id to a component, render it into `#root`, reuse the root across calls so `update()` preserves state. The `mount` fixture does not know or care which framework is on the other side.
