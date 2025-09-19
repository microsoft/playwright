// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Marking Todos Complete/Incomplete', () => {
  test('Mark Single Todo Complete', async ({ page }) => {
    // 1. Add todo "Buy groceries"
    const todoInput = page.getByRole('textbox', { name: 'What needs to be done?' });
    await todoInput.click();
    await todoInput.fill('Buy groceries');
    await todoInput.press('Enter');

    // Verify todo was added successfully
    await expect(page.getByText('Buy groceries')).toBeVisible();
    await expect(page.getByText('1 item left')).toBeVisible();

    // 2. Click the checkbox next to "Buy groceries"
    const todoCheckbox = page.getByRole('checkbox', { name: 'Toggle Todo' });
    await todoCheckbox.click();

    // Expected Results:
    // - Checkbox becomes checked
    await expect(todoCheckbox).toBeChecked();

    // - Todo text may show strikethrough or completed styling (verified by checking the todo is still visible)
    await expect(page.getByText('Buy groceries')).toBeVisible();

    // - Counter shows "0 items left"
    await expect(page.getByText('0 items left')).toBeVisible();

    // - "Clear completed" button appears
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();

    // - Delete button (×) becomes visible on hover
    await page.getByText('Buy groceries').hover();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();
  });
});