// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Todo Creation', () => {
  test('Add a single todo', async ({ page }) => {
    // 1. Navigate to the TodoMVC application
    // Expect: The page loads with an empty todo list and input field 'What needs to be done?' is visible
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();

    // 2. Type 'Buy groceries' into the input field
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    
    // Expect: The text appears in the input field
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toHaveValue('Buy groceries');

    // 3. Press Enter to submit the todo
    await page.keyboard.press('Enter');
    
    // Expect: The todo 'Buy groceries' appears in the list
    await expect(page.getByText('Buy groceries')).toBeVisible();
    
    // Expect: The input field is cleared
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toHaveValue('');

    // Post Condition - The todo counter shows '1 item left'
    await expect(page.getByText('1 item left')).toBeVisible();

    // Post Condition - The new todo is unchecked (active state)
    await expect(page.getByRole('checkbox', { name: 'Toggle Todo' })).not.toBeChecked();
  });
});
