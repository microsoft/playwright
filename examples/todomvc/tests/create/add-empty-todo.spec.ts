// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding New Todos', () => {
  test('Add Empty Todo (Negative Test)', async ({ page }) => {
    // 1. Click in input field but don't type anything
    const todoInput = page.getByRole('textbox', { name: 'What needs to be done?' });
    await todoInput.click();

    // 2. Press Enter
    await todoInput.press('Enter');

    // Expected Results:
    // - No todo is added to the list
    await expect(page.locator('.todo-list li')).toHaveCount(0);

    // - List remains empty
    await expect(page.locator('.todo-list')).not.toBeVisible();

    // - No counter appears
    await expect(page.getByText(/\d+ items? left/)).not.toBeVisible();

    // - Input field remains focused and empty
    await expect(todoInput).toBeFocused();
    await expect(todoInput).toHaveValue('');
  });
});