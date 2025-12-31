// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Todo Creation', () => {
  test('Add todo with special characters', async ({ page }) => {
    // 1. Navigate to the TodoMVC application
    // Expect: The page loads with an empty todo list
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();

    // 2. Type 'Buy @groceries & supplies (urgent!)' into the input field and press Enter
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy @groceries & supplies (urgent!)');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Expect: The todo appears in the list with all special characters preserved
    await expect(page.getByText('Buy @groceries & supplies (urgent!)')).toBeVisible();

    // Post Condition: The todo counter shows '1 item left'
    await expect(page.getByText('1 item left')).toBeVisible();
  });
});
