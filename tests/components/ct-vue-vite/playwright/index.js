//@ts-check
import '../src/assets/index.css';
import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';
import { router } from '../src/router';

beforeMount(async ({ app, hooksConfig }) => {
  app.use(router);
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}, app: ${!!app}`);
});

afterMount(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
