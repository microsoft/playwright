import { test as baseTest, type TestType } from '@playwright/experimental-ct-react';
import { beforeMount, afterMount } from '@playwright/experimental-ct-react/hooks';
import { BrowserRouter } from 'react-router-dom';
import '../src/assets/index.css';

type HooksConfig = {
  routing?: boolean;
}

export * from '@playwright/experimental-ct-react';
export const test = baseTest as TestType<HooksConfig>;

beforeMount<HooksConfig>(async ({ hooksConfig, App }) => {
  console.log(`Before mount: ${JSON.stringify(hooksConfig)}`);

  if (hooksConfig?.routing)
     return <BrowserRouter><App /></BrowserRouter>;
});

afterMount<HooksConfig>(async () => {
  console.log(`After mount`);
});
