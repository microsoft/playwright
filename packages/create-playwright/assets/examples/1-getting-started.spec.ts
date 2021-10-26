import { test, expect } from '@playwright/test';

/**
 * Inside every test you get a new isolated page instance.
 * @see https://playwright.dev/docs/intro
 * @see https://playwright.dev/docs/api/class-page
 */
test('basic test', async ({ page }) => {
  await page.goto('https://todomvc.com/examples/vanilla-es6/');

  const inputBox = page.locator('input.new-todo');
  const todoList = page.locator('.todo-list');

  await inputBox.fill('Learn Playwright');
  await inputBox.press('Enter');
  await expect(todoList).toHaveText('Learn Playwright');
});
