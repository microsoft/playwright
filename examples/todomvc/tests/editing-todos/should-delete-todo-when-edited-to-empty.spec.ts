// spec: Editing Todos - should delete todo when edited to empty
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('should delete todo when edited to empty', async ({ page }) => {
    // 1. Add a todo 'Temporary task'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Temporary task');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await expect(page.getByText('Temporary task')).toBeVisible();
    await expect(page.getByText('1 item left')).toBeVisible();

    // 2. Double-click on the todo to enter edit mode
    await page.getByTestId('todo-title').dblclick();
    await expect(page.getByRole('textbox', { name: 'Edit' })).toBeVisible();

    // 3. Clear all the text and press Enter
    const editTextbox = page.getByRole('textbox', { name: 'Edit' });
    await editTextbox.fill('');
    await editTextbox.press('Enter');
    await expect(page.getByText('Temporary task')).not.toBeVisible();
    await expect(page.getByTestId('todo-title')).not.toBeVisible();
  });
});
