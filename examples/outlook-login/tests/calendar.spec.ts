import { test, expect } from '@playwright/test';

test.use({
  storageStateName: 'outlook-test-user'
});

test('calendar has new event button', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Calendar' }).click();
  await expect(page.getByRole('button', { name: 'New event' }).getByRole('button', { name: 'New event' })).toBeVisible();
});
