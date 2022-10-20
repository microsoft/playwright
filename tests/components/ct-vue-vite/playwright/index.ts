import '../src/assets/index.css';
import { beforeMount, afterMount } from '@playwright/experimental-ct-vue/hooks';
import { router } from '../src/router'; 

export type HooksConfig = {
  route: string;
}

beforeMount<HooksConfig>(async ({ app, hooksConfig }) => {
  app.use(router as any); // TODO: remove any and fix the various installed conflicting Vue versions
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}, app: ${!!app}`);
});

afterMount<HooksConfig>(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
