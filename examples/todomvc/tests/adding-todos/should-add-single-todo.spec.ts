// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding Todos', () => {
  test('should add single todo', async ({ page }) => {
    // Step 1: Navigate to the TodoMVC application
    // Expect: The application loads successfully, The input field 'What needs to be done?' is visible
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();

    // Step 2: Type 'Buy groceries' into the input field
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    // Expect: The text appears in the input field
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toHaveValue('Buy groceries');

    // Step 3: Press Enter to submit the todo
    await page.keyboard.press('Enter');
    // Expect: The new todo 'Buy groceries' appears in the todo list
    await expect(page.getByText('Buy groceries')).toBeVisible();
    // Expect: The input field is cleared
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toHaveValue('');
    // Expect: The todo counter shows '1 item left'
    await expect(page.getByText('1 item left')).toBeVisible();
  });
});
