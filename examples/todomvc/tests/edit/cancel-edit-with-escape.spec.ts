// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('Cancel Edit with Escape', async ({ page }) => {
    // 1. Add todo "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).click();
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Verify todo was added
    await expect(page.getByTestId('todo-title')).toHaveText('Buy groceries');
    await expect(page.locator('.todo-count')).toHaveText('1 item left');

    // 2. Double-click on the todo text
    await page.getByTestId('todo-title').dblclick();

    // Verify todo enters edit mode with text selected
    const editInput = page.getByRole('textbox', { name: 'Edit' });
    await expect(editInput).toBeVisible();
    await expect(editInput).toHaveValue('Buy groceries');
    await expect(editInput).toBeFocused();

    // 3. Change text to "Buy organic groceries"
    await editInput.fill('Buy organic groceries');

    // Verify text was changed in edit input
    await expect(editInput).toHaveValue('Buy organic groceries');

    // 4. Press Escape key
    await page.keyboard.press('Escape');

    // Expected results:
    // - Todo exits edit mode
    await expect(editInput).not.toBeVisible();
    
    // - Text reverts to original "Buy groceries"
    await expect(page.getByTestId('todo-title')).toHaveText('Buy groceries');
    
    // - No changes are saved (verified by text reversion above)
    // - Todo remains in its original state
    await expect(page.locator('.todo-count')).toHaveText('1 item left');
  });
});