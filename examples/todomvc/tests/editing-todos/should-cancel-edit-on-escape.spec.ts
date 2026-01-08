// spec: specs/editing-todos.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('should-cancel-edit-on-escape', async ({ page }) => {
    // 1. Add a todo 'Original text'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Original text');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    
    // Expect: The todo appears in the list
    await expect(page.getByText('Original text')).toBeVisible();
    
    // 2. Double-click on the todo to enter edit mode
    await page.getByTestId('todo-title').dblclick();
    
    // Expect: Edit textbox appears with 'Original text'
    await expect(page.getByRole('textbox', { name: 'Edit' })).toHaveValue('Original text');
    
    // 3. Change the text to 'Modified text' but press Escape instead of Enter
    await page.getByRole('textbox', { name: 'Edit' }).fill('Modified text');
    await page.keyboard.press('Escape');
    
    // Expect: Edit mode is cancelled, The todo text reverts to 'Original text', Changes are not saved
    await expect(page.getByText('Original text')).toBeVisible();
  });
});
