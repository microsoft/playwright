import { test as test1, expect, composedTest } from '@playwright/test';
import { test as test2 } from 'playwright-test-plugin';

const test = composedTest(test1, test2);

test('sample test', async ({ page, plugin }) => {
  await page.setContent(`<div>hello</div><span>world</span>`);
  expect(await page.textContent('span')).toBe('world');

  console.log(`plugin value: ${plugin}`);
  expect(plugin).toBe('hello from plugin');
});
