import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';
import { router } from '../src/router';
import Button from '../src/components/Button.vue';
import '../src/assets/index.css';

export type HooksConfig = {
  routing?: boolean;
  components?: Record<string, any>;
}

beforeMount<HooksConfig>(async ({ app, hooksConfig }) => {
  if (hooksConfig?.routing)
    app.use(router as any); // TODO: remove any and fix the various installed conflicting Vue versions

  for (const [name, component] of Object.entries(hooksConfig?.components || {}))
    app.component(name, component);

  console.log(`Before mount: ${JSON.stringify(hooksConfig)}, app: ${!!app}`);
});

afterMount<HooksConfig>(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
