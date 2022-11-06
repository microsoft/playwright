import { beforeMount, afterMount } from '@playwright/experimental-ct-vue2/hooks';
import Router from 'vue-router';
import { router } from '../src/router';
import '../src/assets/index.css';

export type HooksConfig = {
  route: string;
}

beforeMount<HooksConfig>(async ({ Vue, options, hooksConfig }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);
  Vue.use(Router);
  options.router = router;
});

afterMount<HooksConfig>(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
