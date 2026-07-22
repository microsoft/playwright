import { test, expect } from '@playwright/test';

// Network mocking is standard Playwright routing — set the route before mounting.
test('mock a fetch with page.route', async ({ mount, page }) => {
  await page.route('**/data.json', route => route.fulfill({ json: { name: 'John Doe' } }));
  const component = await mount('components/Fetcher/Default');
  await expect(component.getByTestId('name')).toHaveText('John Doe');
});
