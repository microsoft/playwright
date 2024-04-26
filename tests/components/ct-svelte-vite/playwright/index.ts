import '../src/assets/index.css';
import { beforeMount, afterMount } from '@playwright/experimental-ct-svelte/hooks';

declare module '@playwright/experimental-ct-svelte/hooks' {
  interface RegisterHooksConfig {
    context?: string;
  }
}

beforeMount(async ({ hooksConfig, App }) => {
  return new App({
    context: new Map([
      ['context-key', hooksConfig?.context]
    ]),
  });
});

afterMount(async () => {
  console.log(`After mount`);
});
