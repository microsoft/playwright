// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('Edit Todo Text', async ({ page }) => {
    // 1. Add todo "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).click();
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Verify todo was added
    await expect(page.getByTestId('todo-title')).toHaveText('Buy groceries');
    await expect(page.locator('.todo-count')).toHaveText('1 item left');

    // 2. Double-click on the todo text "Buy groceries"
    await page.getByTestId('todo-title').dblclick();

    // Verify todo enters edit mode with text selected
    const editInput = page.getByRole('textbox', { name: 'Edit' });
    await expect(editInput).toBeVisible();
    await expect(editInput).toHaveValue('Buy groceries');
    await expect(editInput).toBeFocused();

    // 3. Clear text and type "Buy organic groceries"
    await editInput.fill('Buy organic groceries');

    // 4. Press Enter
    await page.keyboard.press('Enter');

    // Expected results:
    // - Text changes to "Buy organic groceries"
    await expect(page.getByTestId('todo-title')).toHaveText('Buy organic groceries');
    
    // - Todo exits edit mode
    await expect(editInput).not.toBeVisible();
    
    // - Counter remains "1 item left"
    await expect(page.locator('.todo-count')).toHaveText('1 item left');
  });
});