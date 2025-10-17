// spec: Completing Todos - should complete single todo
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Completing Todos', () => {
  test('should complete single todo', async ({ page }) => {
    // Add a todo: "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Click the checkbox next to "Buy groceries"
    await page.getByRole('checkbox', { name: 'Toggle Todo' }).click();

    // Verify checkbox becomes checked
    await expect(page.getByRole('checkbox', { name: 'Toggle Todo' })).toBeChecked();

    // Verify counter shows "0 items left"
    await expect(page.getByText('0 items left')).toBeVisible();

    // Verify "Clear completed" button appears
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();

    // Verify delete button becomes visible
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });
});
