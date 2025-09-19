// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Marking Todos Complete/Incomplete', () => {
  test('Mark All Todos Complete', async ({ page }) => {
    // 1. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
    const newTodoInput = page.getByRole('textbox', { name: 'What needs to be done?' });
    
    await newTodoInput.fill('Buy groceries');
    await newTodoInput.press('Enter');
    
    await newTodoInput.fill('Walk the dog');
    await newTodoInput.press('Enter');
    
    await newTodoInput.fill('Call dentist');
    await newTodoInput.press('Enter');

    // 2. Click the "Mark all as complete" checkbox
    await page.getByRole('checkbox', { name: '❯Mark all as complete' }).click();

    // Expected results to verify:
    // - All todo checkboxes become checked
    const todoCheckboxes = page.getByRole('checkbox', { name: 'Toggle Todo' });
    await expect(todoCheckboxes.nth(0)).toBeChecked();
    await expect(todoCheckboxes.nth(1)).toBeChecked();
    await expect(todoCheckboxes.nth(2)).toBeChecked();

    // - Counter shows "0 items left"
    await expect(page.getByText('0 items left')).toBeVisible();

    // - "Clear completed" button appears
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();

    // - "Mark all as complete" checkbox shows as checked
    await expect(page.getByRole('checkbox', { name: '❯Mark all as complete' })).toBeChecked();
  });
});