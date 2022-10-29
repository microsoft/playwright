import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';
import Button from '../src/components/Button.vue';
import '../src/assets/index.css';

export type HooksConfig = {
  route: string;
}

beforeMount<HooksConfig>(async ({ app, hooksConfig }) => {
  app.component('Button', Button);
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}, app: ${!!app}`);
});

afterMount<HooksConfig>(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
