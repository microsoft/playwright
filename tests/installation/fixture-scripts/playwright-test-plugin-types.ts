import { test as test1, expect as expect1, mergeTests, mergeExpects } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test as test2, expect as expect2 } from 'playwright-test-plugin';

const test = mergeTests(test1, test2);
const expect = mergeExpects(expect1, expect2);

test('sample test', async ({ page, plugin }) => {
  type IsPage = (typeof page) extends Page ? true : never;
  const isPage: IsPage = true;

  type IsString = (typeof plugin) extends string ? true : never;
  const isString: IsString = true;

  await page.setContent('<div>hello world</div>');
  await expect(page).toContainText('hello');
  // @ts-expect-error
  await expect(page).toContainText(123);
});

test1.extend({
  page: async ({ page }) => {
    type IsPage = (typeof page) extends Page ? true : never;
    const isPage: IsPage = true;
  },
});

test1.extend<{ myFixture: (arg: number) => void }>({
  page: async ({ page }) => {
    type IsPage = (typeof page) extends Page ? true : never;
    const isPage: IsPage = true;
  },
});

test1.extend({
  myFixture: async ({ page }) => {
    type IsPage = (typeof page) extends Page ? true : never;
    const isPage: IsPage = true;
  }
});

test1.extend<{ myFixture: (arg: number) => void }>({
  myFixture: async ({ page }) => {
    type IsPage = (typeof page) extends Page ? true : never;
    const isPage: IsPage = true;
  }
});

test1.extend({
  page: async ({ page }) => {
    type IsPage = (typeof page) extends Page ? true : never;
    const isPage: IsPage = true;
  },
  myFixture: async ({ page }) => {
    type IsPage = (typeof page) extends Page ? true : never;
    const isPage: IsPage = true;
  }
});

test1.extend<{ myFixture: (arg: number) => void }>({
  page: async ({ page }) => {
    type IsPage = (typeof page) extends Page ? true : never;
    const isPage: IsPage = true;
  },
  myFixture: async ({ page }) => {
    type IsPage = (typeof page) extends Page ? true : never;
    const isPage: IsPage = true;
  }
});

test1.extend<{ myFixture: (arg: number) => void }>({
  // @ts-expect-error
  myFixture: (arg: number) => {},
});

test1.extend<{ myFixture: (arg: number) => void }>({
  myFixture: async (_, use) => {
    use((arg: number) => {});
    // @ts-expect-error
    use((arg: string) => {});
  }
});
