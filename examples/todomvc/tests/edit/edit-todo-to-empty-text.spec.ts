// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('Edit Todo to Empty Text (Negative Test)', async ({ page }) => {
    // 1. Add todo "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).click();
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Verify todo was added
    await expect(page.getByTestId('todo-title')).toHaveText('Buy groceries');
    await expect(page.locator('.todo-count')).toHaveText('1 item left');

    // 2. Double-click on the todo text
    await page.getByTestId('todo-title').dblclick();

    // Verify todo enters edit mode
    const editInput = page.getByRole('textbox', { name: 'Edit' });
    await expect(editInput).toBeVisible();
    await expect(editInput).toHaveValue('Buy groceries');

    // 3. Clear all text
    await editInput.fill('');

    // 4. Press Enter
    await page.keyboard.press('Enter');

    // Expected results:
    // - Todo should be deleted/removed from list
    await expect(page.getByTestId('todo-title')).not.toBeVisible();
    
    // - Counter decrements appropriately (disappears when no todos)
    await expect(page.locator('.todo-count')).not.toBeVisible();
    
    // - List becomes empty if this was the only todo
    await expect(page.locator('.todo-list')).not.toBeVisible();
    
    // - Only the main input should remain visible
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();
  });
});