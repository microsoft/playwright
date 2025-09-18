// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Marking Todos Complete/Incomplete', () => {
  test('Toggle All Todos Back to Incomplete', async ({ page }) => {
    // 1. Add todos: "Buy groceries", "Walk the dog"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Walk the dog');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // 2. Click "Mark all as complete" checkbox
    await page.getByRole('checkbox', { name: '❯Mark all as complete' }).click();

    // 3. Click "Mark all as complete" checkbox again
    await page.getByRole('checkbox', { name: '❯Mark all as complete' }).click();

    // Verify: All todo checkboxes become unchecked
    const buyGroceriesCheckbox = page.getByRole('listitem').filter({ hasText: 'Buy groceries' }).getByRole('checkbox', { name: 'Toggle Todo' });
    const walkDogCheckbox = page.getByRole('listitem').filter({ hasText: 'Walk the dog' }).getByRole('checkbox', { name: 'Toggle Todo' });
    
    await expect(buyGroceriesCheckbox).not.toBeChecked();
    await expect(walkDogCheckbox).not.toBeChecked();

    // Verify: Counter shows "2 items left"
    await expect(page.locator('text=2 items left')).toBeVisible();

    // Verify: "Clear completed" button disappears
    await expect(page.getByRole('button', { name: 'Clear completed' })).not.toBeVisible();

    // Verify: "Mark all as complete" checkbox shows as unchecked
    await expect(page.getByRole('checkbox', { name: '❯Mark all as complete' })).not.toBeChecked();
  });
});