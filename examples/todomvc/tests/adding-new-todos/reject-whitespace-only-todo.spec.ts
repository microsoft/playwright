// spec: Adding New Todos
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding New Todos', () => {
  test('should reject whitespace-only todo', async ({ page }) => {
    // 1. Navigate to the TodoMVC application
    // (handled by seed)

    // 2. Click in the "What needs to be done?" input field
    await page.getByRole('textbox', { name: 'What needs to be done?' }).click();

    // 3. Type only spaces (e.g., "   ")
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('   ');

    // 4. Press Enter
    await page.keyboard.press('Enter');

    // Expected Results:
    // - No todo is added to the list
    // - Todo list remains empty
    await expect(page.getByRole('list')).not.toBeVisible();

    // - Counter is not displayed
    await expect(page.getByText(/\d+ items? left/)).not.toBeVisible();

    // - Input field retains the whitespace (application doesn't clear it)
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toHaveValue('   ');
  });
});
