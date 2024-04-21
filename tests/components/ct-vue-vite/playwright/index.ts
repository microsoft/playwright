import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';
import { router } from '../src/router';
import '../src/assets/index.css';

declare module '@playwright/experimental-ct-vue/hooks' {
  interface RegisterHooksConfig {
    routing?: boolean;
    components?: Record<string, any>;
  }
}

beforeMount(async ({ app, hooksConfig }) => {
  if (hooksConfig?.routing)
    app.use(router as any); // TODO: remove any and fix the various installed conflicting Vue versions

  for (const [name, component] of Object.entries(hooksConfig?.components || {}))
    app.component(name, component);
});

afterMount(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
