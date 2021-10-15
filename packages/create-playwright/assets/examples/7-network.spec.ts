import { test, expect } from '@playwright/test';

// This text clicks on an element with the text 'Load user' and waits for a
// specific HTTP response. This response contains in that case a JSON body
// where we assert some properties.
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
