//@ts-check
import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';

beforeMount(async ({ app, hooksConfig }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}, app: ${!!app}`);
});

afterMount(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
