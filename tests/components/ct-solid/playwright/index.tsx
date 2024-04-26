import { beforeMount, afterMount } from '@playwright/experimental-ct-solid/hooks';
import { Router } from "@solidjs/router";
import '../src/assets/index.css';

declare module '@playwright/experimental-ct-solid/hooks' {
  interface RegisterHooksConfig {
    routing?: boolean;
  }
}

beforeMount(async ({ hooksConfig, App }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);

  if (hooksConfig?.routing)
    return <Router><App /></Router>;
});

afterMount(async () => {
  console.log(`After mount`);
});
