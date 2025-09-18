// spec: specs/basic-operations.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Marking Todos Complete/Incomplete', () => {
  test('Mark Multiple Todos Complete', async ({ page }) => {
    const todoInput = page.getByRole('textbox', { name: 'What needs to be done?' });

    // 1. Add todos: "Buy groceries", "Walk the dog", "Call dentist"
    await todoInput.click();
    await todoInput.fill('Buy groceries');
    await todoInput.press('Enter');

    await todoInput.fill('Walk the dog');
    await todoInput.press('Enter');

    await todoInput.fill('Call dentist');
    await todoInput.press('Enter');

    // Verify all todos are added
    await expect(page.getByText('3 items left')).toBeVisible();

    // 2. Click checkbox for "Buy groceries"
    await page.getByRole('listitem').filter({ hasText: 'Buy groceries' }).getByLabel('Toggle Todo').click();

    // 3. Click checkbox for "Call dentist"  
    await page.getByRole('listitem').filter({ hasText: 'Call dentist' }).getByLabel('Toggle Todo').click();

    // Expected Results:
    // - Two todos show as completed
    const buyGroceriesCheckbox = page.getByRole('listitem').filter({ hasText: 'Buy groceries' }).getByLabel('Toggle Todo');
    const callDentistCheckbox = page.getByRole('listitem').filter({ hasText: 'Call dentist' }).getByLabel('Toggle Todo');
    const walkDogCheckbox = page.getByRole('listitem').filter({ hasText: 'Walk the dog' }).getByLabel('Toggle Todo');

    await expect(buyGroceriesCheckbox).toBeChecked();
    await expect(callDentistCheckbox).toBeChecked();

    // - Counter shows "1 item left" (for "Walk the dog")
    await expect(page.getByText('1 item left')).toBeVisible();

    // - "Clear completed" button appears
    await expect(page.getByRole('button', { name: 'Clear completed' })).toBeVisible();

    // - Only "Walk the dog" remains unchecked
    await expect(walkDogCheckbox).not.toBeChecked();
  });
});