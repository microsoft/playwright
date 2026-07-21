# Gallery contract

The **gallery** is a single page, served by your dev server at the URL you set as `baseURL` in your
Playwright config, that exposes two methods on `window` for Playwright to drive:

- `window.mount(params)` — render a story.
- `window.unmount()` — unmount the current story.

The built-in `mount` fixture navigates to the gallery, then calls `window.mount` via
`page.evaluate()`. Keep props to plain serializable data — where the component takes callbacks,
the story creates the state, provides the callbacks and records the state into a hidden form for
the test to assert on.

## `window.mount(params)`

`params` is `{ story, props }`, straight from the test's `mount(story, props)` call:

- `story` — the story id (string). Resolve it (see id grammar) to a component.
- `props` — the plain serializable props object passed to the component.

Render the resolved component with `props` into `#root`. Return a `Promise` that resolves once the
component is mounted and **rejects on failure** (unknown story, render throw). The rejection
surfaces as the test's `await mount(...)` throwing, with a real stack — there is no HTTP-status or
DOM-attribute signalling.

**Reuse the root across calls.** The test's `component.update(props)` calls `window.mount` again
with the same story and new props, **without navigating**. If you render into the same root /
instance rather than recreating it, the framework reconciles and component-internal state is
preserved — that is CT's `update()`. Recreating the root each call (or navigating) resets state, so
reuse it: create it on first mount and render into it on every call. The framework reconciles,
remounting on its own only when the story (component type) changes.

**`window.mount` is your setup/teardown hook.** It is the browser-side equivalent of CT's
`beforeMount` / `afterMount`: install providers or plugins, seed a store, start an in-browser mock
server *before* you render, and run post-render work *after* — all inside this one function,
branched on the `story` / `props` the test passed. There is no separate hook registry; the function
you own is the hook.

## `window.unmount()`

Unmount the current story from `#root` and return a `Promise`. The test calls it via
`component.unmount()`. Needed only to assert teardown/cleanup effects — each `mount` navigates
fresh, so tests are already isolated.

## `#root`

Render the component into an element with `id="root"`. `mount` returns a `Locator` for `#root`
itself, so tests scope their queries from there — `component.getByRole('button').click()`, not
`component.click()`. Stories are free to render fragments, e.g. the component plus a hidden form
recording its state.

## Story id grammar (recommended)

The gallery owns resolution; `mount` passes the id through untouched. Recommended scheme:

- `<path under src, without the .story.* extension>/<ExportName>` — e.g.
  `src/components/Button.story.tsx` export `Primary` → `components/Button/Primary`.
- Any unique trailing suffix resolves too: `Button/Primary`.
- A single-file-component story (`Button.story.vue`) is one story, addressed by its path alone
  (its default export): `components/Button`.

## Worked example (React + Vite SPA)

An illustration of the contract, **not** a file to copy — implement the equivalent for your stack.
`import.meta.glob` stays inline here: Vite analyzes it statically, relative to this file, so it
cannot be moved into shared/shipped code. That is exactly why the gallery is yours to own.

```tsx
// playwright/gallery/main.tsx
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';

const stories = import.meta.glob('../../src/**/*.story.{tsx,jsx}');
const id = (f: string) => f.replace(/^(\.\.\/)+src\//, '').replace(/\.story\.\w+$/, '');

async function resolve(storyId: string) {
  const sep = storyId.lastIndexOf('/');
  const [path, name] = [storyId.slice(0, sep), storyId.slice(sep + 1)];
  const file = Object.keys(stories).find(f => id(f) === path || id(f).endsWith('/' + path));
  const mod = (file && await stories[file]()) as Record<string, any> | undefined;
  return mod?.[name] ?? mod?.default;
}

const rootEl = document.getElementById('root')!;
let root: Root | undefined;

(window as any).mount = async ({ story, props }: { story: string, props?: Record<string, any> }) => {
  const Story = await resolve(story);
  if (!Story)
    throw new Error(`Unknown story: ${story}`);
  root ??= createRoot(rootEl);   // reuse the root so update() reconciles and preserves state
  // flushSync so a render error rejects the promise instead of being swallowed.
  flushSync(() => root!.render(<Story {...props} />));
};

(window as any).unmount = async () => {
  root?.unmount();
  root = undefined;
};
```

```html
<!-- playwright/gallery/index.html -->
<!DOCTYPE html>
<div id="root"></div>
<script type="module" src="./main.tsx"></script>
```

## Vue variant (state-preserving)

Vue's `createApp(...).mount()` builds a fresh instance each call, so mount a small **reactive host**
once and update its refs — updating them re-renders in place, which is what preserves state across
`update()`:

```ts
// playwright/gallery/main.ts
import { createApp, h, shallowRef, type App, type Component } from 'vue';

// resolve() and the import.meta.glob are the same as the React example.
const story = shallowRef<Component | null>(null);
const props = shallowRef<Record<string, any>>({});
const host = { render: () => (story.value ? h(story.value, props.value) : null) };
let app: App | undefined;

(window as any).mount = async ({ story: id, props: next }: { story: string, props?: Record<string, any> }) => {
  const resolved = await resolve(id);
  if (!resolved)
    throw new Error(`Unknown story: ${id}`);
  story.value = resolved;
  props.value = next ?? {};
  if (!app) {                    // mount once; the ref updates above re-render in place
    app = createApp(host);
    app.mount('#root');
  }
};

(window as any).unmount = async () => {
  app?.unmount();
  app = undefined;
};
```

Keep the story-resolution glob and the framework mount in this file; everything
else lives in your stories and tests.
