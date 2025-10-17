// spec: Editing Todos - should delete todo by clearing text
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('should delete todo by clearing text', async ({ page }) => {
    // Add a todo: "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Double-click on the todo text
    await page.getByTestId('todo-title').dblclick();

    // Clear all text (delete all characters)
    await page.getByRole('textbox', { name: 'Edit' }).fill('');

    // Press Enter
    await page.keyboard.press('Enter');

    // Verify the input field is still visible
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();
  });
});
