// spec: specs/basic-operations.plan.md
// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Editing Todos', () => {
  test('should-save-edit-on-blur', async ({ page }) => {
    // 1. Add a todo 'Call dentist'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Call dentist');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // 2. Double-click on the todo to enter edit mode
    await page.getByTestId('todo-title').dblclick();

    // 3. Change the text to 'Schedule dentist appointment' and click elsewhere (blur the input)
    await page.getByRole('textbox', { name: 'Edit' }).fill('Schedule dentist appointment');
    await page.getByRole('heading', { name: 'todos' }).click();

    await expect(page.getByText('Schedule dentist appointment')).toBeVisible();
  });
});
