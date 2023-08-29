import '../src/assets/index.css';
import { beforeMount, afterMount } from '@playwright/experimental-ct-svelte/hooks';

export type HooksConfig = {
  route?: string;
  context: Map<any, any>;
}

beforeMount<HooksConfig>(async ({ hooksConfig, App }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);
  return new App({
    context: hooksConfig?.context
  });
});

afterMount<HooksConfig>(async () => {
  console.log(`After mount`);
});
