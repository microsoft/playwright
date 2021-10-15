import { test, expect } from '@playwright/test';

// This test navigates to '/cookies' which sets a browser cookie.
// With the context.cookies() we assert that the correct cookie was returned.
test('should be able to get cookies', async ({ page, context }) => {
  await page.goto('/cookies');
  const cookies = await context.cookies();
  expect(cookies.length).toBe(1);
  expect(cookies[0]).toEqual(
      expect.objectContaining({
        name: 'this-is',
        value: 'Playwright',
      })
  );
});

// This test tries to navigate to '/cookies/protected' which leads to 'Access Denied'
// Because there is no cookie set in the beginning.
// After that we set the cookie which allows us to access the page, then the expected page
// with 'Access granted' gets shown.
test('should be able to set cookies', async ({ page, context }) => {
  await page.goto('/cookies/protected');
  await page.waitForSelector('text=Access denied!');
  await context.addCookies([{
    name: 'product',
    value: 'Playwright',
    url: page.url(),
  }]);
  await page.goto('/cookies/protected');
  await page.waitForSelector('text=Access granted');
});
