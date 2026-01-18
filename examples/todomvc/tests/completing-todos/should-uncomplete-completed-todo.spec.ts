// spec: specs/basic-operations.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Completing Todos', () => {
  test('should-uncomplete-completed-todo', async ({ page }) => {
    // 1. Add a todo 'Buy groceries' and mark it as complete
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('checkbox', { name: 'Toggle Todo' }).click();

    // 2. Click the checkbox again to uncomplete it
    await page.getByRole('checkbox', { name: 'Toggle Todo' }).click();
  });
});
