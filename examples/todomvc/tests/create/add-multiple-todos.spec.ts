// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding New Todos', () => {
  test('Add Multiple Todos', async ({ page }) => {
    const todoInput = page.getByRole('textbox', { name: 'What needs to be done?' });

    // 1. Add first todo: "Buy groceries" and press Enter
    await todoInput.fill('Buy groceries');
    await todoInput.press('Enter');

    // 2. Add second todo: "Walk the dog" and press Enter
    await todoInput.fill('Walk the dog');
    await todoInput.press('Enter');

    // 3. Add third todo: "Call dentist" and press Enter
    await todoInput.fill('Call dentist');
    await todoInput.press('Enter');

    // Expected Results:
    // - All three todos appear in the list in the order added
    const todoItems = page.getByTestId('todo-item');
    await expect(todoItems).toHaveCount(3);
    
    await expect(todoItems.nth(0)).toContainText('Buy groceries');
    await expect(todoItems.nth(1)).toContainText('Walk the dog');
    await expect(todoItems.nth(2)).toContainText('Call dentist');

    // - Counter shows "3 items left"
    await expect(page.getByText('3 items left')).toBeVisible();

    // - Each todo has its own unchecked checkbox
    const todoCheckboxes = page.getByRole('checkbox', { name: 'Toggle Todo' });
    await expect(todoCheckboxes).toHaveCount(3);
    
    for (let i = 0; i < 3; i++) {
      await expect(todoCheckboxes.nth(i)).toBeVisible();
      await expect(todoCheckboxes.nth(i)).not.toBeChecked();
    }

    // - Input field remains active and cleared after each addition
    await expect(todoInput).toHaveValue('');
    await expect(todoInput).toBeFocused();
  });
});