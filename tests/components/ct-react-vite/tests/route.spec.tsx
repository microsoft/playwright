import { test, expect } from '@playwright/experimental-ct-react';
import TitleWithFont from '@/components/TitleWithFont';

test('should load font without routes', async ({ mount, page }) => {
  const promise = page.waitForEvent('requestfinished', request => request.url().includes('iconfont'));
  await mount(<TitleWithFont />);
  const request = await promise;
  const response = await request.response();
  const body = await response!.body();
  expect(body.length).toBe(2656);
});

test('should load font with routes', async ({ mount, page }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27294' });
  await page.route('**/*.json', r => r.continue());
  const promise = page.waitForEvent('requestfinished', request => request.url().includes('iconfont'));
  await mount(<TitleWithFont />);
  const request = await promise;
  const response = await request.response();
  const body = await response!.body();
  expect(body.length).toBe(2656);
});
