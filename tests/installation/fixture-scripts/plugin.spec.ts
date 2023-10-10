import { test as test1, expect as expect1, composedTest, composedExpect } from '@playwright/test';
import { test as test2, expect as expect2 } from 'playwright-test-plugin';

const test = composedTest(test1, test2);
const expect = composedExpect(expect1, expect2);

test('sample test', async ({ page, plugin }) => {
  await page.setContent(`<div>hello</div><span>world</span>`);
  expect(await page.textContent('span')).toBe('world');

  console.log(`plugin value: ${plugin}`);
  expect(plugin).toBe('hello from plugin');

  await page.setContent('<div>hello world</div>');
  await expect(page).toContainText('hello');
});
