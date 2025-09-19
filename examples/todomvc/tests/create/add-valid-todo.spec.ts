// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding New Todos', () => {
  test('Add Valid Todo', async ({ page }) => {
    // 1. Click in the "What needs to be done?" input field
    const todoInput = page.getByRole('textbox', { name: 'What needs to be done?' });
    await todoInput.click();

    // 2. Type "Buy groceries"
    await todoInput.fill('Buy groceries');

    // 3. Press Enter key
    await todoInput.press('Enter');

    // Expected Results:
    // - Todo appears in the list with unchecked checkbox
    await expect(page.getByText('Buy groceries')).toBeVisible();
    const todoCheckbox = page.getByRole('checkbox', { name: 'Toggle Todo' });
    await expect(todoCheckbox).toBeVisible();
    await expect(todoCheckbox).not.toBeChecked();

    // - Counter shows "1 item left"
    await expect(page.getByText('1 item left')).toBeVisible();

    // - Input field is cleared and ready for next entry
    await expect(todoInput).toHaveValue('');
    await expect(todoInput).toBeFocused();

    // - Todo list controls become visible (Mark all as complete checkbox)
    await expect(page.getByRole('checkbox', { name: '❯Mark all as complete' })).toBeVisible();
  });
});