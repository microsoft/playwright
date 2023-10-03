import { test as test1, composedTest } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test as test2 } from 'playwright-test-plugin';

const test = composedTest(test1, test2);

test('sample test', async ({ page, plugin }) => {
  type IsPage = (typeof page) extends Page ? true : never;
  const isPage: IsPage = true;

  type IsString = (typeof plugin) extends string ? true : never;
  const isString: IsString = true;
});
