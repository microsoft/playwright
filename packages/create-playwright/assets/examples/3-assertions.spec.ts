import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('https://todomvc.com/examples/vanilla-es6/');
});

/**
 * All available test assertions are listed here:
 * @see https://playwright.dev/docs/test-assertions/
 */
test('should be able to use assertions', async ({ page }) => {
  await test.step('toHaveTitle/toHaveURL', async () => {
    await expect(page).toHaveTitle('Vanilla ES6 • TodoMVC');
    await expect(page).toHaveURL('https://todomvc.com/examples/vanilla-es6/');
  });

  await test.step('toBeEmpty/toHaveValue', async () => {
    const input = page.locator('input.new-todo');
    await expect(input).toBeEmpty();
    await input.fill('Buy milk');
    await expect(input).toHaveValue('Buy milk');
    await input.press('Enter');
  });

  await test.step('toHaveCount/toHaveText/toContainText', async () => {
    const items = page.locator('.todo-list li');
    await expect(items).toHaveCount(1);
    await expect(items.first()).toHaveText('Buy milk');
    await expect(items).toHaveText(['Buy milk']);
    await expect(items.first()).toContainText('milk');
  });

  await test.step('toBeChecked', async () => {
    const firstItemCheckbox = page.locator('input[type=checkbox]:left-of(:text("Buy milk"))');
    await expect(firstItemCheckbox).not.toBeChecked();
    await firstItemCheckbox.check();
    await expect(firstItemCheckbox).toBeChecked();
  });

  await test.step('toBeVisible/toBeHidden', async () => {
    await expect(page.locator('text=Buy milk')).toBeVisible();
    await page.click('text=Active');
    await expect(page.locator('text=Buy milk')).toBeHidden();
  });

  await test.step('toHaveClass/toHaveCSS', async () => {
    await expect(page.locator('[placeholder="What needs to be done?"]')).toHaveClass('new-todo');
    await page.click('text=Clear completed');
    await expect(page.locator('.main')).toHaveCSS('display', 'none');
  });
});
