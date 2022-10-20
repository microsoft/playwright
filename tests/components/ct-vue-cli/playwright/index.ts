//@ts-check
import '../src/assets/index.css';
import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';

export type HooksConfig = {
  route: string;
}

beforeMount<HooksConfig>(async ({ app, hooksConfig }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}, app: ${!!app}`);
});

afterMount<HooksConfig>(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
