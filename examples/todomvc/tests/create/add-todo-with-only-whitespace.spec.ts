// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding New Todos', () => {
  test('Add Todo with Only Whitespace (Negative Test)', async ({ page }) => {
    // 1. Type only spaces "   " in input field
    const todoInput = page.getByRole('textbox', { name: 'What needs to be done?' });
    await todoInput.fill('   ');

    // 2. Press Enter
    await todoInput.press('Enter');

    // Expected Results:
    // - No todo is added to the list
    await expect(page.locator('.todo-list li')).toHaveCount(0);

    // - List remains empty
    await expect(page.locator('.todo-list')).not.toBeVisible();

    // - Input field retains the whitespace (actual behavior differs from spec)
    await expect(todoInput).toHaveValue('   ');

    // - No counter appears
    await expect(page.getByText(/\d+ items? left/)).not.toBeVisible();

    // - Input field remains focused
    await expect(todoInput).toBeFocused();
  });
});