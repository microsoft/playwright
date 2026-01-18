// spec: specs/basic-operations.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Deleting Todos', () => {
  test('should-delete-specific-todo-from-multiple', async ({ page }) => {
    // 1. Add three todos: 'Task 1', 'Task 2', 'Task 3'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Task 1');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Task 2');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Task 3');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Expect: All three todos appear in the list,Counter shows '3 items left'
    await expect(page.getByText('Task 1')).toBeVisible();
    await expect(page.getByText('Task 2')).toBeVisible();
    await expect(page.getByText('Task 3')).toBeVisible();
    await expect(page.getByText('3 items left')).toBeVisible();

    // 2. Hover over 'Task 2' and click its delete button
    await page.getByRole('listitem').filter({ hasText: 'Task 2' }).hover();
    await page.getByRole('button', { name: 'Delete' }).click();

    // Expect: 'Task 2' is removed from the list,'Task 1' and 'Task 3' remain visible,Counter shows '2 items left'
    await expect(page.getByText('Task 1')).toBeVisible();
    await expect(page.getByText('Task 3')).toBeVisible();
    await expect(page.getByText('2 items left')).toBeVisible();
  });
});
