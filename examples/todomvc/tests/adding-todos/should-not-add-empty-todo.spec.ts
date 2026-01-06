// spec: Adding Todos - should not add empty todo
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding Todos', () => {
  test('should not add empty todo', async ({ page }) => {
    // 1. Click on the input field without typing anything
    await page.getByRole('textbox', { name: 'What needs to be done?' }).click();
    
    // Expect: The input field is focused
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toBeFocused();
    
    // 2. Press Enter
    await page.keyboard.press('Enter');
    
    // Expect: No todo is added to the list, The todo list remains empty
    await expect(page.getByRole('list')).not.toBeVisible();
  });
});
