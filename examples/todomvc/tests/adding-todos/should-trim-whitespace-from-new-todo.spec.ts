// spec: Adding Todos
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding Todos', () => {
  test('should trim whitespace from new todo', async ({ page }) => {
    // 1. Type '   Todo with spaces   ' (with leading and trailing spaces) and press Enter
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('   Todo with spaces   ');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Expect: The todo is added as 'Todo with spaces' without leading or trailing whitespace, Counter shows '1 item left'
    await expect(page.getByText('Todo with spaces')).toBeVisible();
    await expect(page.getByText('1 item left')).toBeVisible();
  });
});
