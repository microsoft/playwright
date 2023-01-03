import { beforeMount, afterMount } from '@playwright/experimental-ct-solid/hooks';
import { Router } from "@solidjs/router";
import '../src/assets/index.css';

export type HooksConfig = {
  route?: string;
  routing?: boolean;
}

beforeMount<HooksConfig>(async ({ hooksConfig, App }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);

  if (hooksConfig?.routing)
    return <Router><App /></Router>;
});

afterMount<HooksConfig>(async () => {
  console.log(`After mount`);
});
