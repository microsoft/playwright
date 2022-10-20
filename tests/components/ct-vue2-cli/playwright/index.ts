import '../src/assets/index.css';
import { beforeMount, afterMount } from '@playwright/experimental-ct-vue2/hooks';

export type hooksConfig = {
  route: string;
}

beforeMount(async ({ hooksConfig }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);
});

afterMount(async ({ instance }) => {
  console.log(`After mount el: ${instance.$el.constructor.name}`);
});
