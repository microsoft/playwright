import { test as test1, expect } from '@playwright/test';
import { test as test2 } from 'playwright-test-plugin';

const test = (test1 as any)._extendTest(test2);

test('sample test', async ({ page, plugin }) => {
  await page.setContent(`<div>hello</div><span>world</span>`);
  expect(await page.textContent('span')).toBe('world');

  console.log(`plugin value: ${plugin}`);
  expect(plugin).toBe('hello from plugin');
});
