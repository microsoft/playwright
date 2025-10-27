import { test, expect } from '../fixtures';

test.describe('Adding New Todos', () => {
  test('should add todo with long text', async ({ page }) => {
    // Type a very long text (e.g., "This is a very long todo item to test the character limit and see how the application handles extremely long text inputs that might break the layout or cause other issues")
    await page.getByRole('textbox', { name: 'What needs to be done?' }).fill('This is a very long todo item to test the character limit and see how the application handles extremely long text inputs that might break the layout or cause other issues');

    // Press Enter
    await page.keyboard.press('Enter');

    // Todo is successfully added - Long text is displayed (may wrap or truncate depending on design)
    await expect(page.getByText('This is a very long todo item to test the character limit and see how the application handles extremely long text inputs that might break the layout or cause other issues')).toBeVisible();

    // Counter shows "1 item left"
    await expect(page.getByText('1 item left')).toBeVisible();
  });
});
