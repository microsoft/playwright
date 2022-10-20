import '../src/assets/index.css';
import { beforeMount, afterMount } from '@playwright/experimental-ct-react/hooks';

beforeMount(async ({ hooksConfig }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);
});

afterMount(async ({}) => {
  console.log(`After mount`);
});
