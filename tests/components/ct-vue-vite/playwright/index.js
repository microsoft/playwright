import { onApp } from '@playwright/experimental-ct-vue/hooks';

onApp(async (app, addConfig) => {
  console.log(`App ${!!app} configured with config: ${JSON.stringify(addConfig)}`);
});
