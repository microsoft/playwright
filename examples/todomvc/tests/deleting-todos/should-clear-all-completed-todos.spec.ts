// spec: specs/basic-operations.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Deleting Todos', () => {
  test('should-clear-all-completed-todos', async ({ page }) => {
    // 1. Add three todos: 'Task 1', 'Task 2', 'Task 3'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Task 1');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Task 2');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Task 3');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');
    await expect(page.locator('body')).toMatchAriaSnapshot(`
- list:
  - listitem: "Task 1"
  - listitem: "Task 2"
  - listitem: "Task 3"
`);

    // 2. Mark 'Task 1' and 'Task 3' as complete
    await page.getByRole('listitem').filter({ hasText: 'Task 1' }).getByLabel('Toggle Todo').click();
    await page.getByRole('listitem').filter({ hasText: 'Task 3' }).getByLabel('Toggle Todo').click();
    await expect(page.getByText('1 item left')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();

    // 3. Click the 'Clear completed' button
    await page.getByRole('button', { name: 'Clear completed' }).click();
    await expect(page.getByText('Task 2')).toBeVisible();
    await expect(page.getByText('1 item left')).toBeVisible();
  });
});
