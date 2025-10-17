// spec: Completing Todos - should unmark all as complete
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Completing Todos', () => {
  test('should unmark all as complete', async ({ page }) => {
    // Add first todo: "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Add second todo: "Walk the dog"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Walk the dog');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Add third todo: "Read a book"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Read a book');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Click the "Mark all as complete" checkbox to complete all
    await page.getByRole('checkbox', { name: '❯Mark all as complete' }).click();

    // Click the "Mark all as complete" checkbox again
    await page.getByRole('checkbox', { name: '❯Mark all as complete' }).click();

    // Verify "Mark all as complete" checkbox is unchecked
    await expect(page.getByRole('checkbox', { name: '❯Mark all as complete' })).not.toBeChecked();

    // Verify all individual checkboxes are unchecked
    await expect(page.getByRole('listitem').filter({ hasText: 'Buy groceries' }).getByLabel('Toggle Todo')).not.toBeChecked();
    await expect(page.getByRole('listitem').filter({ hasText: 'Walk the dog' }).getByLabel('Toggle Todo')).not.toBeChecked();
    await expect(page.getByRole('listitem').filter({ hasText: 'Read a book' }).getByLabel('Toggle Todo')).not.toBeChecked();

    // Verify counter shows "3 items left"
    await expect(page.getByText('3 items left')).toBeVisible();
  });
});
