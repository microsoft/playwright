// spec: Todo Creation - Prevent adding whitespace-only todo
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Todo Creation', () => {
  test('Prevent adding whitespace-only todo', async ({ page }) => {
    // 1. Navigate to the TodoMVC application
    // Expect: The page loads with an empty todo list
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeVisible();

    // 2. Type only spaces '   ' into the input field and press Enter
    // Expect: No todo is added to the list
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('   ');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    
    // Verify no todo was added (todo list remains empty)
    await expect(page.getByRole('listitem')).toHaveCount(0);
  });
});
