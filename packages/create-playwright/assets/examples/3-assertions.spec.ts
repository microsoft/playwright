import { test, expect } from '@playwright/test';

// For a full overview see here: https://playwright.dev/docs/test-assertions/
test('should be able to use assertions', async ({ page, baseURL }) => {
  await page.goto('/assertions.html');

  // Useful for input[type='checkbox']
  await expect(page.locator('#my-checked-checkbox')).toBeChecked();

  // Useful for input elements
  await expect(page.locator('#my-input-with-value')).toHaveValue('foobar');
  await expect(page.locator('#my-empty-input')).toBeEmpty();

  await expect(page.locator('#my-paragraph')).toContainText('Dorem');
  await expect(page.locator('#my-paragraph')).toHaveText('Lorem Dorem Ipsum');

  await expect(page.locator('#my-disabled-checkbox')).toBeDisabled();
  await expect(page.locator('#my-checked-checkbox')).toBeEnabled();

  await expect(page.locator('#my-focused-input')).toBeFocused();

  await expect(page.locator('#my-hidden-checkbox')).toBeHidden();
  await expect(page.locator('#my-visible-input')).toBeVisible();

  await expect(page.locator('input')).toHaveCount(7);
  await expect(page).toHaveTitle('My page title');
  await expect(page).toHaveURL('/assertions.html');

  await expect(page.locator('#my-paragraph')).toHaveAttribute('data-user-id', '42');
  await expect(page.locator('#my-paragraph')).toHaveClass('my-class');
  await expect(page.locator('#my-paragraph')).toHaveCSS('color', 'rgb(255, 0, 0)');
  await expect(page.locator('#my-paragraph')).toHaveId('my-paragraph');
  await expect(page.locator('#my-paragraph')).toHaveJSProperty('foo', 'bar');
  await expect(page.locator('#my-editable-div')).toBeEditable();
});
