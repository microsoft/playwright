import { test, expect } from '@playwright/test';

/**
 * This test clicks on an element with the text 'Load user' and waits for a
 * specific HTTP response. This response contains a JSON body where we assert
 * some properties.
 */
test('should be able to read a response body', async ({ page }) => {
  await page.goto('/network.html');
  const [response] = await Promise.all([
    page.waitForResponse('/api/v1/users.json'),
    page.click('text=Load user')
  ]);
  await expect(page.locator('#user-full-name')).toContainText('John Doe');
  const responseBody = await response.json();
  expect(responseBody.id).toBe(1);
  expect(responseBody.fullName).toBe('John Doe');
});

test.describe('mocked responses', () => {
  /**
   * Before every test set the request interception handler and fulfill the
   * requests with a mocked response. See here:
   * @see https://playwright.dev/docs/network#handle-requests
   */
  test.beforeEach(async ({ context }) => {
    await context.route('/api/v1/users.json', route => route.fulfill({
      body: JSON.stringify({
        'id': 2,
        'fullName': 'James Bond'
      }),
      contentType: 'application/json'
    }));
  });

  test('be able to mock responses', async ({ page }) => {
    await page.goto('/network.html');
    await page.click('text=Load user');
    await expect(page.locator('p')).toHaveText('User: James Bond');
  });
});
