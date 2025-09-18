// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('Edit Multiple Todos', async ({ page }) => {
    // 1. Add todos: "Buy groceries", "Walk the dog"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).click();
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    await page.getByRole('textbox', { name: 'What needs to be done?' }).click();
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Walk the dog');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Verify both todos were added
    await expect(page.getByText('Buy groceries')).toBeVisible();
    await expect(page.getByText('Walk the dog')).toBeVisible();
    await expect(page.locator('.todo-count')).toHaveText('2 items left');

    // 2. Double-click "Buy groceries", change to "Buy organic groceries", press Enter
    await page.getByText('Buy groceries').dblclick();
    
    const editInput = page.getByRole('textbox', { name: 'Edit' });
    await expect(editInput).toBeVisible();
    await expect(editInput).toHaveValue('Buy groceries');
    
    await editInput.fill('Buy organic groceries');
    await page.keyboard.press('Enter');

    // 3. Double-click "Walk the dog", change to "Walk the cat", press Enter
    await page.getByText('Walk the dog').dblclick();
    
    const editInput2 = page.getByRole('textbox', { name: 'Edit' });
    await expect(editInput2).toBeVisible();
    await expect(editInput2).toHaveValue('Walk the dog');
    
    await editInput2.fill('Walk the cat');
    await page.keyboard.press('Enter');

    // Expected results:
    // - Both todos are updated with new text
    await expect(page.getByText('Buy organic groceries')).toBeVisible();
    await expect(page.getByText('Walk the cat')).toBeVisible();
    
    // - Counter remains "2 items left"
    await expect(page.locator('.todo-count')).toHaveText('2 items left');
    
    // - Both todos maintain their completion state (uncompleted)
    const todo1Checkbox = page.getByText('Buy organic groceries').locator('..').getByRole('checkbox', { name: 'Toggle Todo' });
    const todo2Checkbox = page.getByText('Walk the cat').locator('..').getByRole('checkbox', { name: 'Toggle Todo' });
    
    await expect(todo1Checkbox).not.toBeChecked();
    await expect(todo2Checkbox).not.toBeChecked();
    
    // Verify edit inputs are no longer visible
    await expect(editInput).not.toBeVisible();
    await expect(editInput2).not.toBeVisible();
  });
});