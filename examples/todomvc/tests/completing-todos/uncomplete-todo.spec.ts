// spec: Completing Todos - should uncomplete todo
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Completing Todos', () => {
  test('should uncomplete todo', async ({ page }) => {
    // Add a todo: "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Click the checkbox to complete it
    await page.getByRole('checkbox', { name: 'Toggle Todo' }).click();

    // Click the checkbox again to uncomplete it
    await page.getByRole('checkbox', { name: 'Toggle Todo' }).click();

    // Verify checkbox becomes unchecked
    await expect(page.getByRole('checkbox', { name: 'Toggle Todo' })).not.toBeChecked();

    // Verify counter shows "1 item left"
    await expect(page.getByText('1 item left')).toBeVisible();
  });
});
