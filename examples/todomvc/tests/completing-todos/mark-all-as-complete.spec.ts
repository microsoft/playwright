// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Completing Todos', () => {
  test('should mark all as complete', async ({ page }) => {
    // Add three todos: "Buy groceries", "Walk the dog", "Read a book"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Walk the dog');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Read a book');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Click the "Mark all as complete" checkbox (chevron icon)
    await page.getByRole('checkbox', { name: '❯Mark all as complete' }).click();

    // Verify "Mark all as complete" checkbox is checked
    await expect(page.getByRole('checkbox', { name: '❯Mark all as complete' })).toBeChecked();

    // Verify counter shows "0 items left"
    await expect(page.getByText('0')).toBeVisible();

    // Verify "Clear completed" button appears
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();
  });
});
