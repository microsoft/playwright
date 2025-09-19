/* eslint-disable notice/notice */

import { test as baseTest } from '@playwright/test';

export { expect } from '@playwright/test';

export const test = baseTest.extend({
  page: async ({ page }, use) => {
    await page.goto('https://demo.playwright.dev/todomvc');
    await use(page);
  },
});
