// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding New Todos', () => {
  test('should add single valid todo', async ({ page }) => {
    // Click in the "What needs to be done?" input field
    await page.getByRole('textbox', { name: 'What needs to be done?' }).click();

    // Type "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');

    // Press Enter key
    await page.keyboard.press('Enter');

    // Todo appears in the list with an unchecked checkbox
    await expect(page.getByTestId('todo-item')).toBeVisible();

    // Todo text displays as "Buy groceries"
    await expect(page.getByText('Buy groceries')).toBeVisible();

    // Counter shows "1 item left"
    await expect(page.getByText('1 item left')).toBeVisible();

    // Input field is cleared and ready for next entry
    await expect(page.getByRole('textbox', { name: 'What needs to be done?' })).toHaveValue('');

    // "Mark all as complete" checkbox becomes visible
    await expect(page.getByRole('checkbox', { name: '❯Mark all as complete' })).toBeVisible();
  });
});
