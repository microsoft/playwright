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
  <output data-testid="click-count">{{ clicks }}</output>
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

## CSS

Import global stylesheets in your gallery entry (`playwright/gallery/main.ts`, e.g. `import '../../src/assets/main.css'`), mirroring the app's entry point.
