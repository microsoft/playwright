// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding New Todos', () => {
  test('Add Todo with Special Characters', async ({ page }) => {
    // 1. Type "Buy coffee & donuts (2-3 pieces) @$5.99!" in input field
    const todoInput = page.getByRole('textbox', { name: 'What needs to be done?' });
    await todoInput.fill('Buy coffee & donuts (2-3 pieces) @$5.99!');

    // 2. Press Enter
    await todoInput.press('Enter');

    // Expected Results:
    // - Todo appears exactly as typed with all special characters preserved
    await expect(page.getByText('Buy coffee & donuts (2-3 pieces) @$5.99!')).toBeVisible();

    // - Counter shows "1 item left"
    await expect(page.getByText('1 item left')).toBeVisible();

    // - No encoding or display issues with special characters
    const todoCheckbox = page.getByRole('checkbox', { name: 'Toggle Todo' });
    await expect(todoCheckbox).toBeVisible();
    await expect(todoCheckbox).not.toBeChecked();

    // Verify input field is cleared
    await expect(todoInput).toHaveValue('');
  });
});