/* eslint-disable notice/notice */

import { test, expect } from '@playwright/test';

test.describe.configure({ mode: 'parallel' });

test.beforeEach(async ({ page }) => {
  await page.goto('https://demo.playwright.dev/todomvc');
});

test('template', async ({ page }) => {
  // This test tells agents how to start recording the test
  // so that the page was already configured.
});
