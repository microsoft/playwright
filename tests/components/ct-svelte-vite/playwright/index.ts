import '../src/assets/index.css';
import { beforeMount, afterMount } from '@playwright/experimental-ct-svelte/hooks';

export type HooksConfig = {
  context?: string;
  route?: string;
}

beforeMount<HooksConfig>(async ({ hooksConfig, App }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);
  return new App({
    context: new Map([
      ['context-key', hooksConfig?.context]
    ]),
  });
});

afterMount<HooksConfig>(async () => {
  console.log(`After mount`);
});
