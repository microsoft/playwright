import { test, expect } from '@playwright/test';

test.use({
  storageStateName: 'outlook-test-user'
});

test('inbox has new mail button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'New mail' }).getByRole('button', { name: 'New mail' })).toBeVisible();
});
