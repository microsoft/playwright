// spec: Filtering Todos
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Filtering Todos', () => {
  test('should-filter-active-todos', async ({ page }) => {
    // 1. Add three todos: 'Active 1', 'Active 2', 'Will complete'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Active 1');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Active 2');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Will complete');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Expect: All three todos are visible
    await expect(page.getByText('Active 1')).toBeVisible();
    await expect(page.getByText('Active 2')).toBeVisible();
    await expect(page.getByText('Will complete')).toBeVisible();

    // 2. Mark 'Will complete' as completed
    await page.getByRole('listitem').filter({ hasText: 'Will complete' }).getByLabel('Toggle Todo').click();

    // Expect: One todo is marked as complete, Counter shows '2 items left'
    await expect(page.getByRole('listitem').filter({ hasText: 'Will complete' }).getByLabel('Toggle Todo')).toBeChecked();
    await expect(page.getByText('2 items left')).toBeVisible();

    // 3. Click on the 'Active' filter link
    await page.getByRole('link', { name: 'Active' }).click();

    // Expect: The URL changes to #/active
    await expect(page).toHaveURL(/#\/active$/);

    // Expect: Only 'Active 1' and 'Active 2' are displayed
    await expect(page.getByText('Active 1')).toBeVisible();
    await expect(page.getByText('Active 2')).toBeVisible();

    // Expect: 'Will complete' is not visible
    await expect(page.getByText('Will complete')).not.toBeVisible();

    // Expect: The 'Active' filter link is highlighted
    await expect(page.getByRole('link', { name: 'Active' })).toBeVisible();
  });
});
