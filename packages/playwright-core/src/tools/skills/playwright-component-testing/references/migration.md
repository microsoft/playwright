# Migrating from @playwright/experimental-ct-react / -vue

The CT packages compiled JSX in the test file and marshalled it into the browser. The gallery
pattern moves the scenario into a story export that runs natively in the browser: structure (which
component, its children, providers) plus behavior (state and callbacks, recorded into a hidden
form for the test to assert on). Plain data props travel through `mount(storyId, props)`;
`update()` and `unmount()` work as before.

## Concept mapping

| `@playwright/experimental-ct-*` | Gallery pattern |
|---|---|
| `mount(<Button title="…" onClick={spy} />)` | Stateful story: the story provides `onClick`, records the effect into a hidden form input; the test asserts `toHaveValue()` |
| Plain data props from the test | Unchanged in spirit: `mount(id, props)` |
| JSX children / slots from the test | Cannot cross — bake each composition into its own story export (Vue: `.story.vue` for slot-heavy scenarios) |
| `component.update(<Button count={2} />)` | `component.update({ count: 2 })` — state-preserving, needs the gallery to reuse its root (`gallery-spec.md`) |
| `component.unmount()` | `component.unmount()` — backed by the gallery's `window.unmount()` |
| `beforeMount`/`afterMount` in `playwright/index.ts` | The body of the gallery's `window.mount` (global), or story decorators (per-story) |
| `hooksConfig` per-test variation | Props: `mount('App/Routing', { route: '/dashboard' })` — the story/decorator interprets them |
| `router` fixture / MSW handlers in Node | `page.route()` in the test, or MSW `setupWorker` inside a story/decorator |
| `playwright/index.html` (styles, fonts, theme) | The gallery's `index.html` / entry module imports |
| `ctViteConfig`, `ctPort`, `ctTemplateDir`, `ctCacheDir` | Gone — the gallery runs through the app's own dev server; port lives in `webServer` + `baseURL`; location is `playwright/gallery/` |
| `defineConfig` from `@playwright/experimental-ct-react` | Plain `defineConfig` from `@playwright/test`, with `baseURL` = gallery URL, `serviceWorkers: 'block'`, `reuseContext: true` (see `SKILL.md`) |

## Steps

1. Set up the gallery and config per `SKILL.md`. Keep the old CT project running until the last
   spec is migrated.
2. For each CT spec, split every `mount(<…/>)` call: JSX structure becomes a story export next to
   the component; plain data props stay in the test as `mount`'s second argument. Callback spies
   become story state recorded into a hidden form. A call site that only varies data props usually
   needs just one generic story that spreads them:
   `export const Default = (props: ButtonProps) => <Button title="Submit" {...props} />`.
3. Rewrite the spec: import `test`/`expect` from `@playwright/test`; `mount(<X a={1}/>)`
   → `mount('X/Default', { a: 1 })`; `update(<X a={2}/>)` → `update({ a: 2 })`;
   `unmount()` unchanged. `mount` returns a locator for the gallery root — scope the queries:
   `component.getByRole('button').click()`. Spy assertions become `toHaveValue()` on the story's
   recorded state.
4. Port `beforeMount` hooks: app-wide setup into the gallery's `window.mount`; per-test
   `hooksConfig` branches into props interpreted by a story or decorator.
5. When all specs are green, delete the CT project from the config, drop the
   `@playwright/experimental-ct-*` dependency, and remove `playwright/index.html`,
   `playwright/index.ts*` and `playwright/.cache`.

## Gotchas

- **Story ids are strings.** Renaming or moving a story breaks specs at runtime, not compile time
  — and the suffix-matching resolution can silently match a different story after a rename.
- **Per-test JSX is gone.** Any test that built a different JSX tree per test (children matrices,
  inline wrappers) becomes one story export per composition.

## Before / after

```tsx
// Before (CT)
import { test, expect } from '@playwright/experimental-ct-react';
import Button from '../src/components/Button';

test('click', async ({ mount }) => {
  const messages: string[] = [];
  const component = await mount(<Button title="Submit" onClick={data => messages.push(data)} />);
  await component.click();
  expect(messages).toEqual(['hello']);
});
```

```tsx
// After: src/components/Button.story.tsx
import Button from './Button';

export const Default = (props: { onClick?: (data: string) => void }) =>
  <Button title="Submit" {...props} />;
```

```ts
// After: src/components/Button.spec.ts
import { test, expect } from '@playwright/test';

test('click', async ({ mount }) => {
  const messages: string[] = [];
  const component = await mount('components/Button/Default', { onClick: (data: string) => messages.push(data) });
  await component.click();
  expect(messages).toEqual(['hello']);
});
```
