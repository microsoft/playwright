// spec: Editing Todos - should edit todo successfully
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('should edit todo successfully', async ({ page }) => {
    // Add a todo: "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Double-click on the todo text "Buy groceries"
    await page.getByTestId('todo-title').dblclick();

    // Clear the existing text and type "Buy groceries and milk"
    await page.getByRole('textbox', { name: 'Edit' }).fill('Buy groceries and milk');

    // Press Enter to save the edited todo
    await page.keyboard.press('Enter');

    // Verify that todo text updates to "Buy groceries and milk"
    await expect(page.getByText('Buy groceries and milk')).toBeVisible();
  });
});
