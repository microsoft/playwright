import { beforeMount, afterMount } from '@playwright/experimental-ct-vue2/hooks';
import Router from 'vue-router';
import { router } from '../src/router';
import '../src/assets/index.css';

beforeMount(async ({ Vue, hooksConfig }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);

  if (hooksConfig?.routing) {
    Vue.use(Router);
    return { router }
  }
});

afterMount(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
