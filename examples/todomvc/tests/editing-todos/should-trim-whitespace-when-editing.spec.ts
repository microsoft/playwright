// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('should trim whitespace when editing', async ({ page }) => {
    // 1. Add a todo 'Original task'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Original task');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    
    // Expect: The todo appears in the list
    await expect(page.getByText('Original task')).toBeVisible();
    
    // 2. Double-click to edit and change text to '   Edited task   ' (with spaces)
    await page.getByTestId('todo-title').dblclick();
    await page.getByRole('textbox', { name: 'Edit' }).fill('   Edited task   ');
    
    // Expect: Edit textbox shows the text with spaces
    await expect(page.getByRole('textbox', { name: 'Edit' })).toHaveValue('   Edited task   ');
    
    // 3. Press Enter to save
    await page.keyboard.press('Enter');
    
    // Expect: The todo is saved as 'Edited task' without leading or trailing whitespace
    await expect(page.getByText('Edited task')).toBeVisible();
  });
});
