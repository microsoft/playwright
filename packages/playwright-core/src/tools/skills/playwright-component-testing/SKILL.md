---
name: playwright-component-testing
description: Set up component testing with Playwright using a story gallery — scaffold stories and a gallery dev page driven by the built-in mount fixture, no dedicated component-testing runtime. Use when asked to test React or Vue components in isolation with Playwright, or to migrate off @playwright/experimental-ct-react / -vue.
---

# Component Testing with Playwright

Test components with regular Playwright e2e tests against a small **story gallery** page hosted by the app's own dev server. No extra test runner, bundler integration or npm packages are required.

## Concept

- A **story** is a tiny wrapper component that embeds the component under test in one specific scenario: hard-coded props, mock data, providers, recorded callbacks. Stories live next to the component in `*.story.tsx` (or `.ts`/`.jsx`/`.js`/`.vue`) files; each named export is one story.
- The **gallery** is a single page you implement to `references/gallery-spec.md`: it exposes `window.mount(params)` / `window.unmount()` that render a story — resolved from your story files (e.g. with `import.meta.glob`) — into `#root`. It is framework-specific and yours to own — there is no template to copy for it.
- Tests are plain Playwright tests. The built-in **`mount(storyId, props?)` fixture** (from `@playwright/test`) drives the gallery's `window.mount` and returns a `Locator` for the mounted component (the single element rendered into `#root`, or `#root` itself when the story renders a fragment) — so specs read just like the old component tests. Nothing to scaffold for it.

Everything the component needs must be set up *inside the story* (it runs in the browser); everything the test asserts must be observable *through the page* (DOM, URL, network). `mount(id, props)` passes `props` to the component, and props may include **callbacks** — the component calls them in the browser and your test-side function runs in Node.

## Setup workflow

1. **Detect the framework and bundler.** React vs Vue decides the framework notes and example story to follow. Then:
   - **App runs on Vite** (has `vite.config.*`): the gallery is served by the existing dev server at `/playwright/gallery/index.html` — Vite serves any `.html` file under the project root, the app's plugins/aliases/CSS apply automatically, and `vite build` ignores it. No extra server needed.
   - **Anything else** (Next.js, webpack, no dev server): run a small standalone dev server (e.g. Vite) that serves the gallery page, and point `baseURL` at it. Requires `vite` and the framework plugin as devDependencies.
2. **Implement the gallery** to `references/gallery-spec.md`: a page at `<project>/playwright/gallery/` that renders the requested story into `#root`. Start from the worked example in the spec and the framework notes in `references/react.md` / `references/vue.md`. Keep story discovery (`import.meta.glob`) and the framework mount here — this is the only framework-specific glue, so keep it small. Import the app's global CSS the same way the app's own entry does.
3. **Configure Playwright** — add to `playwright.config.ts`:

   ```ts
   projects: [
     {
       name: 'components',
       testDir: './tests/components',
       use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:5173/playwright/gallery/index.html', serviceWorkers: 'block', reuseContext: true },
     },
   ],
   webServer: {
     command: 'npm run dev',                                       // or: npx vite --config playwright/vite.config.ts
     url: 'http://localhost:5173/playwright/gallery/index.html',   // standalone server: http://localhost:3100/playwright/gallery/index.html
     reuseExistingServer: !process.env.CI,
   },
   ```

   Match the port to the dev server. `mount` navigates to `baseURL`, so set `baseURL` to the gallery's URL. `serviceWorkers: 'block'` keeps the app's own service worker from serving cached responses that would shadow your `page.route()` mocks. `reuseContext: true` reuses the browser context across tests in a worker (as the old component-testing runtime did) — a large speedup for component suites. If the config already has projects/webServer, merge instead of replacing.
4. **Write a first story** next to an existing component, modeled on `templates/<react|vue>/Button.story.*`.
5. **Write a first spec**, modeled on `templates/react/button.spec.ts`, importing `test`/`expect` from `@playwright/test`.
6. **Run**: `npx playwright test --project=components`. Open `http://localhost:5173/playwright/gallery/index.html` in a browser to eyeball all stories.

## Conventions

- Story id: path under `src/` without the `.story.*` extension, plus the export name — `src/components/Button.story.tsx` export `Primary` → `components/Button/Primary`. Any unique suffix works too: `mount('Button/Primary')`. A `.story.vue` single-file component is one story, addressable by its path alone (its `default` export).
- One export per scenario. Prefer a new story export over parameterizing an existing one — stories are greppable, reviewable documentation of component states.

## Testing patterns

Examples are React; the Vue equivalents differ only in story syntax.

### Callbacks and events

**Pass the callback straight to `mount`** — it runs in Node, so you assert directly on what the component called it with:

```ts
test('fires onSubmit with the form data', async ({ mount }) => {
  const calls: any[] = [];
  const component = await mount('components/Form/Default', { onSubmit: (data: any) => calls.push(data) });
  await component.getByRole('button', { name: 'Save' }).click();
  expect(calls).toEqual([{ name: 'Ada' }]);
});
```

Callbacks may be async and return a value the component `await`s — the return travels back from Node:

```ts
await mount('components/Field/Default', { validate: async (v: string) => v.length > 0 });
```

**Or record the effect in the DOM** inside the story — handy when you also want the state visible when eyeballing the gallery:

```tsx
export const CountsClicks = () => {
  const [clicks, setClicks] = useState(0);
  return <>
    <Button title="Submit" onClick={() => setClicks(c => c + 1)} />
    <output data-testid="click-count">{clicks}</output>
  </>;
};
```

### Per-test props

When a scenario is genuinely parametric (e.g. a boundary-value sweep), pass props as the second argument to `mount`; the gallery hands them to the story as its props. Props may include functions.

```tsx
export const WithTitle = ({ title = 'Default' }: { title?: string }) =>
  <Button title={title} />;
```

```ts
const component = await mount('components/Button/WithTitle', { title: 'Hello' });
```

### Prop transitions with `update()`

To test how a component reacts to a prop change **without remounting** (state preserved), call `component.update(newProps)` — it re-renders the same story with new props on the existing root:

```ts
const component = await mount('components/Counter/Default', { value: 1 });
await expect(component.getByTestId('value')).toHaveText('1');
await component.update({ value: 2 });
await expect(component.getByTestId('value')).toHaveText('2');
```

This requires the gallery to reuse its root/instance (`references/gallery-spec.md`); state survives as long as the story stays the same.

### Multiple states in one test

Each `mount()` navigates fresh, so tests are fully isolated and mounting several stories in one test is cheap:

```ts
await expect(await mount('Button/Primary')).toHaveScreenshot('primary.png');
await expect(await mount('Button/Disabled')).toHaveScreenshot('disabled.png');
```

For visual comparison, screenshot the component locator (as above), not the page, to avoid asserting on gallery chrome.

### Network mocking

Use `page.route()` as usual — register routes before `mount()`, since mounting navigates. `serviceWorkers: 'block'` (set in the config above) keeps the app's own service worker from serving cached responses that shadow the routes. Teams with MSW handler libraries can start the worker inside a story or decorator instead.

### Debugging stories

Open your gallery URL (`baseURL`) in a browser and call `await window.mount({ story: 'components/Button/Primary' })` from the devtools console — that is exactly what the `mount` fixture does. An unknown story rejects `window.mount`, which surfaces as the test's `mount()` throwing with a real stack. To browse without the console, give your gallery an optional index page.

## Decision points

- **Monorepos / non-`src` layouts**: change the glob and the id derivation in your gallery (`references/gallery-spec.md`) to match.
- **Global providers** (theme, i18n, store, router): create a shared `decorator` helper next to the gallery and wrap components in stories; see `references/react.md` / `references/vue.md`.
## References

- `references/gallery-spec.md` — the gallery endpoint contract to implement (**start here**).
- `references/react.md` — React walkthrough: providers, StrictMode, CSS.
- `references/vue.md` — Vue walkthrough: `.story.ts` and `.story.vue` stories, plugins.
- `references/migration.md` — migrating off `@playwright/experimental-ct-react` / `-vue`.
