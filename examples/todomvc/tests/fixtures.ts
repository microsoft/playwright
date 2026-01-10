/* eslint-disable notice/notice */

import { test as baseTest } from '@playwright/test';

export { expect } from '@playwright/test';

export const test = baseTest.extend({
  agentOptions: {
    api: 'anthropic',
    apiKey: process.env.AZURE_SONNET_API_KEY!,
    apiEndpoint: process.env.AZURE_SONNET_ENDPOINT!,
    model: 'claude-sonnet-4-5',
  },
  page: async ({ page }, use) => {
    await page.goto('https://demo.playwright.dev/todomvc');
    await use(page);
  },
});
