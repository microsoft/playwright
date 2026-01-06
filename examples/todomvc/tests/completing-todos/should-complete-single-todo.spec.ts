// spec: specs/basic-operations.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Completing Todos', () => {
  test('should-complete-single-todo', async ({ page }) => {
    // 1. Add a todo 'Buy groceries'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Expect: The todo appears as active, Counter shows '1 item left'
    await expect(page.getByText('Buy groceries')).toBeVisible();
    await expect(page.getByText('1 item left')).toBeVisible();

    // 2. Click the checkbox next to the todo
    await page.getByRole('checkbox', { name: 'Toggle Todo' }).click();

    // Expect: The checkbox is checked, Counter shows '0 items left', The 'Clear completed' button appears in the footer
    await expect(page.getByRole('checkbox', { name: 'Toggle Todo' })).toBeChecked();
    await expect(page.getByText('0 items left')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();
  });
});
