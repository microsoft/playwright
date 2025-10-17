// spec: Editing Todos - Edit Completed Todo
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('should edit completed todo', async ({ page }) => {
    // Add a todo: "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Click the checkbox to complete it
    await page.getByRole('checkbox', { name: 'Toggle Todo' }).click();

    // Double-click on the todo text
    await page.getByTestId('todo-title').dblclick();

    // Type "Buy groceries and milk" and press Enter
    await page.getByRole('textbox', { name: 'Edit' }).fill('Buy groceries and milk');
    await page.getByRole('textbox', { name: 'Edit' }).press('Enter');

    // Verify todo text is successfully updated
    await expect(page.getByText('Buy groceries and milk')).toBeVisible();

    // Verify checkbox remains checked (todo remains in completed state)
    await expect(page.getByRole('checkbox', { name: 'Toggle Todo' })).toBeChecked();
  });
});
