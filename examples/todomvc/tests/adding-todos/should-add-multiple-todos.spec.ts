// seed: tests/seed.spec.ts

import { test, expect } from '../fixtures';

test.describe('Adding Todos', () => {
  test('should add multiple todos', async ({ page }) => {
    // 1. Add first todo 'Buy milk'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Buy milk');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Expect: The todo appears in the list, Counter shows '1 item left'
    await expect(page.getByText('Buy milk')).toBeVisible();
    await expect(page.getByText('1 item left')).toBeVisible();

    // 2. Add second todo 'Walk the dog'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Walk the dog');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Expect: Both todos appear in the list, Counter shows '2 items left'
    await expect(page.getByText('Buy milk')).toBeVisible();
    await expect(page.getByText('Walk the dog')).toBeVisible();
    await expect(page.getByText('2 items left')).toBeVisible();

    // 3. Add third todo 'Finish report'
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('Finish report');
    await page.getByRole('textbox', { name: 'What needs to be done?' }).press('Enter');

    // Expect: All three todos appear in the list, Counter shows '3 items left'
    await expect(page.getByText('Buy milk')).toBeVisible();
    await expect(page.getByText('Walk the dog')).toBeVisible();
    await expect(page.getByText('Finish report')).toBeVisible();
    await expect(page.getByText('3 items left')).toBeVisible();
  });
});
