// spec: specs/editing-todos.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('should edit todo by double-clicking', async ({ page }) => {
    // 1. Add a todo 'Buy milk'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy milk');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await expect(page.getByText('Buy milk')).toBeVisible();

    // 2. Double-click on the todo text
    await page.getByTestId('todo-title').dblclick();
    await expect(page.getByRole('textbox', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Edit' })).toHaveValue('Buy milk');

    // 3. Change the text to 'Buy organic milk' and press Enter
    await page.getByRole('textbox', { name: 'Edit' }).fill('Buy organic milk');
    await page.getByRole('textbox', { name: 'Edit' }).press('Enter');
    await expect(page.getByText('Buy organic milk')).toBeVisible();
  });
});
