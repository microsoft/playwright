import { test, expect } from '@playwright/test';

// The gallery imports the app's global CSS, so the story's @font-face triggers a real font load.
test('load a web font', async ({ mount, page }) => {
  const promise = page.waitForEvent('requestfinished', r => r.url().includes('iconfont'));
  await mount('components/TitleWithFont/Default');
  const request = await promise;
  const response = await request.response();
  const body = await response!.body();
  expect(body.length).toBe(348);
});
