import { test, expect } from '../fixtures';

test.describe('Completing Todos', () => {
  test('should complete multiple todos', async ({ page }) => {
    // Add first todo: "Buy groceries"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy groceries');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Add second todo: "Walk the dog"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Walk the dog');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Add third todo: "Read a book"
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Read a book');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Click the checkbox next to "Buy groceries"
    await page.getByRole('listitem').filter({ hasText: 'Buy groceries' }).getByLabel('Toggle Todo').click();

    // Click the checkbox next to "Read a book"
    await page.getByRole('listitem').filter({ hasText: 'Read a book' }).getByLabel('Toggle Todo').click();

    // Verify "Buy groceries" is completed
    await expect(page.getByRole('listitem').filter({ hasText: 'Buy groceries' }).getByLabel('Toggle Todo')).toBeChecked();

    // Verify "Read a book" is completed
    await expect(page.getByRole('listitem').filter({ hasText: 'Read a book' }).getByLabel('Toggle Todo')).toBeChecked();

    // Verify counter shows "1 item left"
    await expect(page.getByText('1 item left')).toBeVisible();

    // Verify "Clear completed" button appears
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();

    // Verify "Walk the dog" remains active (unchecked)
    await expect(page.getByRole('listitem').filter({ hasText: 'Walk the dog' }).getByLabel('Toggle Todo')).not.toBeChecked();
  });
});
