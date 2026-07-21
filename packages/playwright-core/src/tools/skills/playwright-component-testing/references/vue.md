# Vue setup

Follow the setup workflow in `SKILL.md`. Implement the gallery per `references/gallery-spec.md`, exposing `window.mount`/`window.unmount` — in Vue, mount with `app = createApp(h(story, props)); app.mount('#root')` and unmount with `app.unmount()`; this page covers Vue-specific details.

## Files

- `playwright/gallery/` — the gallery you implement to `references/gallery-spec.md` (an `index.html` + a `main.ts` module). Requires Vue 3.
- Stories: `src/**/*.story.{ts,js,vue}`; example in `templates/vue/Button.story.ts`.

## Two ways to write stories

**Render-function stories** (`Button.story.ts`) — several scenarios per file, one named export each; see `templates/vue/Button.story.ts`. Uses `defineComponent` + `h()`, no SFC compilation involved.

**Single-file-component stories** (`Button.primary.story.vue`) — one story per file, full template syntax:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import Button from './Button.vue';
const clicks = ref(0);
</script>

<template>
  <Button title="Submit" @click="clicks++" />
  <form hidden><input data-testid="click-count" readonly :value="String(clicks)" /></form>
</template>
```

An SFC story is addressed by its path without the extension: `mount('components/Button.primary')`. Prefer SFC stories when the scenario needs slots or non-trivial templates.

## Global plugins

Apps that rely on plugins (Pinia, vue-router, i18n) should wrap components with a decorator story helper that creates a fresh instance per story:

```ts
// src/stories/decorators.ts
import { defineComponent, h, type Component } from 'vue';
import { createPinia } from 'pinia';

export function withStore(story: Component) {
  return defineComponent(() => {
    const pinia = createPinia();
    return () => h(story, { pinia });
  });
}
```

For plugins that must be installed on the app instance (`app.use(...)`), add them in your gallery right after `createApp(...)` — that is the equivalent of the app's own bootstrap.

## Typed props

A story that takes per-test props declares them twice: in the setup signature (for the type) and in the `props` option (so Vue delivers them as props rather than `attrs`):

```ts
// src/components/Button.story.ts
export const WithTitle = defineComponent(
  (props: { title?: string }) => () => h(Button, { title: props.title ?? 'Default' }),
  { props: ['title'] },
);
```

`mount` is generic over the story: pass the story type as a template argument to type-check the props (and `update()`):

```ts
// src/components/button.spec.ts
import type { WithTitle } from './Button.story';

const component = await mount<typeof WithTitle>('components/Button/WithTitle', { title: 'Hello' });
```

Options-API stories (`defineComponent({ props: { ... } })`) infer props the same way. For `.story.vue` SFC stories, prop types are only inferable when the setup generates SFC types (Volar/vue-tsc); otherwise pass the props type directly: `mount<{ title?: string }>('components/Button.primary', { title: 'Hello' })`.

## CSS

Import global stylesheets in your gallery entry (`playwright/gallery/main.ts`, e.g. `import '../../src/assets/main.css'`), mirroring the app's entry point.
