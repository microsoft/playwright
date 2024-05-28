import { beforeMount, afterMount } from '@playwright/experimental-ct-react/hooks';
import { BrowserRouter } from 'react-router-dom';
import '../src/assets/index.css';

declare module '@playwright/experimental-ct-react/hooks' {
  interface RegisterHooksConfig {
    routing?: boolean;
  }
}

beforeMount(async ({ hooksConfig, App }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);

  if (hooksConfig?.routing)
     return <BrowserRouter><App /></BrowserRouter>;
});

afterMount(async () => {
  console.log(`After mount`);
});
