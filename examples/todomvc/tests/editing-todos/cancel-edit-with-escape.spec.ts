// spec: Editing Todos - Cancel edit with escape
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('should cancel edit with escape', async ({ page }) => {
    // Add a todo: "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Double-click on the todo text
    await page.getByTestId('todo-title').dblclick();

    // Type "Changed text"
    await page.getByRole('textbox', { name: 'Edit' }).fill('Changed text');

    // Press Escape key
    await page.keyboard.press('Escape');

    // Verify original text "Buy groceries" is preserved
    await expect(page.getByText('Buy groceries')).toBeVisible();
  });
});
