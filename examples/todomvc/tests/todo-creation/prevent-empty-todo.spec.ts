// spec: Todo Creation - Prevent adding empty todo
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Todo Creation', () => {
  test('Prevent adding empty todo', async ({ page }) => {
    // Step 1: Navigate to the TodoMVC application
    // Expect: The page loads with an empty todo list
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();

    // Step 2: Click into the input field without typing anything and press Enter
    // Expect: No todo is added to the list
    await page.getByRole('textbox', { name: 'What needs to be done?' }).click();
    await page.keyboard.press('Enter');

    // Post Conditions: The todo list remains empty
    await expect(page.locator('.todo-list li')).toHaveCount(0);

    // Post Conditions: The input field is still focused and empty
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toHaveValue('');
  });
});
