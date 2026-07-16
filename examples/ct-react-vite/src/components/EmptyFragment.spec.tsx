import { test, expect } from '@playwright/test';

test('render an empty component', async ({ mount, page }) => {
  const component = await mount('components/EmptyFragment/Default');
  expect(await page.evaluate(() => 'props' in window && (window as any).props)).toEqual({});
  await expect(component).toHaveText('');
});
