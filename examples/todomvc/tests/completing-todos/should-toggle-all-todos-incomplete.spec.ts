// spec: specs/basic-operations.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Completing Todos', () => {
  test('should toggle all todos incomplete', async ({ page }) => {
    // 1. Add three todos and mark all as complete using the toggle all checkbox
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('First todo');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Second todo');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Third todo');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('checkbox', { name: '❯Mark all as complete' }).click();
    await expect(page.getByText('0 items left')).toBeVisible();

    // 2. Click the 'Mark all as complete' checkbox again
    await page.getByRole('checkbox', { name: '❯Mark all as complete' }).click();
    await expect(page.getByText('3 items left')).toBeVisible();
  });
});
