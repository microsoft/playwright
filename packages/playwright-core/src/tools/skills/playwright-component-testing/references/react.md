# React setup

Follow the setup workflow in `SKILL.md`. Implement the gallery per `references/gallery-spec.md` (which has a React worked example); this page covers React-specific details.

## Files

- `playwright/gallery/` — the gallery you implement to `references/gallery-spec.md` (an `index.html` + a `main.tsx` module). Requires `react` and `react-dom` 18+ (`createRoot`).
- Stories: `src/**/*.story.tsx` (the glob also picks up `.story.jsx`); example in `templates/react/Button.story.tsx`.

## StrictMode

Wrap the rendered story in `<React.StrictMode>` in your gallery to match how most apps render. In development builds StrictMode intentionally double-invokes render functions and effects. This matters for stories that record events with counters set in effects — recording via state updates from event handlers (like the `CountsClicks` example story) is unaffected. If a story misbehaves under StrictMode, that is usually a real finding about the component; drop the wrapper only if the app itself does not use StrictMode.

## Global providers

If components require context (theme, store, i18n, router), create one shared decorator and use it in stories, so each story states its scenario and nothing more:

```tsx
// src/stories/decorators.tsx
import { ThemeProvider } from '../theme';
import { MemoryRouter } from 'react-router-dom';

export function AppScaffold({ children, route = '/' }: { children: React.ReactNode, route?: string }) {
  return (
    <ThemeProvider theme="light">
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </ThemeProvider>
  );
}
```

```tsx
// src/components/ProfilePage.story.tsx
export const LoggedIn = () => (
  <AppScaffold route="/profile/42">
    <ProfilePage user={{ id: 42, name: 'Test User' }} />
  </AppScaffold>
);
```

Do not build the decorator into the gallery — keeping it in story files makes the wrapping visible and lets stories opt out.

## Typed props

`mount` is generic over the story: pass the story type as a template argument to type-check per-test props (and `update()`). Props are inferred from the component signature; function and class components both work.

```tsx
// src/components/Button.story.tsx
export const WithTitle = ({ title = 'Default' }: { title?: string }) =>
  <Button title={title} />;
```

```ts
// src/components/button.spec.ts
import type { WithTitle } from './Button.story';

const component = await mount<typeof WithTitle>('components/Button/WithTitle', { title: 'Hello' });
```

## CSS

- Global stylesheets: import them in your gallery entry (`playwright/gallery/main.tsx`, e.g. `import '../../src/index.css'`), mirroring the app's own entry point.
- Tailwind: if content scanning is path-based, make sure `*.story.tsx` files are covered.

## Data fetching

For libraries with client objects (React Query, Apollo), create the client inside the story or decorator so each navigation starts fresh.
