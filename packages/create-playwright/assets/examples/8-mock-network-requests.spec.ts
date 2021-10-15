import { test, expect } from '@playwright/test';

// Before every test set the request interception handler and fulfill the request
// with a mocked response. See here: https://playwright.dev/docs/network#handle-requests
test.beforeEach(async ({ context }) => {
  context.route('/api/v1/users.json', route => route.fulfill({
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
