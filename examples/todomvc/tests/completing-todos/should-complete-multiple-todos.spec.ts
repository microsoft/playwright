// spec: specs/basic-operations.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Completing Todos', () => {
  test('should complete multiple todos', async ({ page }) => {
    // 1. Add three todos: 'Buy milk', 'Walk dog', 'Finish report'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy milk');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Walk dog');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Finish report');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Expect: All three todos are visible, Counter shows '3 items left'
    await expect(page.getByText('Buy milk')).toBeVisible();
    await expect(page.getByText('Walk dog')).toBeVisible();
    await expect(page.getByText('Finish report')).toBeVisible();
    await expect(page.getByText('3 items left')).toBeVisible();

    // 2. Complete the first todo
    await page.getByRole('listitem').filter({ hasText: 'Buy milk' }).getByLabel('Toggle Todo').click();

    // Expect: First todo is marked as complete, Counter shows '2 items left'
    await expect(page.getByRole('listitem').filter({ hasText: 'Buy milk' }).getByLabel('Toggle Todo')).toBeChecked();
    await expect(page.getByText('2 items left')).toBeVisible();

    // 3. Complete the third todo
    await page.getByRole('listitem').filter({ hasText: 'Finish report' }).getByLabel('Toggle Todo').click();

    // Expect: Third todo is marked as complete, Counter shows '1 item left', The 'Clear completed' button appears
    await expect(page.getByRole('listitem').filter({ hasText: 'Finish report' }).getByLabel('Toggle Todo')).toBeChecked();
    await expect(page.getByText('1 item left')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();
  });
});
