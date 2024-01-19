import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';
import { router } from '../src/router';
import Button from '../src/components/Button.vue';
import '../src/assets/index.css';

export type HooksConfig = {
  route?: string;
  routing?: boolean;
}

beforeMount<HooksConfig>(async ({ app, hooksConfig }) => {
  if (hooksConfig?.routing)
    app.use(router as any);
  app.component('Button', Button);
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}, app: ${!!app}`);
});

afterMount<HooksConfig>(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
