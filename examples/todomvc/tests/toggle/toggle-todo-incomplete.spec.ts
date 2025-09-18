// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Marking Todos Complete/Incomplete', () => {
  test('Toggle Todo Back to Incomplete', async ({ page }) => {
    // 1. Add todo "Buy groceries"
    const todoInput = page.getByRole('textbox', { name: 'What needs to be done?' });
    await todoInput.click();
    await todoInput.fill('Buy groceries');
    await todoInput.press('Enter');

    // Verify todo was added
    const todoItem = page.getByText('Buy groceries');
    await expect(todoItem).toBeVisible();
    await expect(page.getByText('1 item left')).toBeVisible();

    // 2. Click checkbox to mark complete
    const todoCheckbox = page.getByRole('checkbox', { name: 'Toggle Todo' });
    await todoCheckbox.click();

    // Verify todo is marked complete
    await expect(todoCheckbox).toBeChecked();
    await expect(page.getByText('0 items left')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();

    // 3. Click checkbox again to mark incomplete
    await todoCheckbox.click();

    // Expected results to verify:
    // - Checkbox becomes unchecked
    await expect(todoCheckbox).not.toBeChecked();
    
    // - Completed styling is removed (checkbox is unchecked indicates this)
    // - Counter shows "1 item left"
    await expect(page.getByText('1 item left')).toBeVisible();
    
    // - "Clear completed" button disappears if no other completed todos exist
    await expect(page.getByRole('button', { name: 'Clear completed' })).not.toBeVisible();

    // Additional verification that the todo is still present and functional
    await expect(todoItem).toBeVisible();
    await expect(page.getByRole('checkbox', { name: '❯Mark all as complete' })).not.toBeChecked();
  });
});