/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createImage } from './playwright-test-fixtures';
import { test, expect, retries } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

test('should merge trace events', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        expect(1).toBe(1);
        await page.getByRole('button').click();
        expect(2).toBe(2);
      });
    `,
  });

  await page.getByText('trace test').dblclick();

  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /page.setContent[\d.]+m?s/,
    /expect.toBe[\d.]+m?s/,
    /locator.clickgetByRole\('button'\)[\d.]+m?s/,
    /expect.toBe[\d.]+m?s/,
    /After Hooks[\d.]+m?s/,
  ]);
});

test('should merge web assertion events', async ({  runUITest }, testInfo) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        await expect(page.locator('button')).toBeVisible();
      });
    `,
  });

  await page.getByText('trace test').dblclick();

  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /page.setContent[\d.]+m?s/,
    /expect.toBeVisiblelocator\('button'\)[\d.]+m?s/,
    /After Hooks[\d.]+m?s/,
  ]);
});

test('should merge screenshot assertions', async ({  runUITest }, testInfo) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        await expect(page.locator('button')).toHaveScreenshot();
      });
    `,
  });

  await page.getByText('trace test').dblclick();

  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /page.setContent[\d.]+m?s/,
    /expect.toHaveScreenshot[\d.]+m?s/,
    /attach "trace-test-1-expected.png/,
    /attach "trace-test-1-actual.png/,
    /After Hooks[\d.]+m?s/,
    /Worker Cleanup[\d.]+m?s/,
  ]);
});

test('should locate sync assertions in source', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({}) => {
        expect(1).toBe(1);
      });
    `,
  });

  await page.getByText('trace test').dblclick();
  await page.getByText('expect.toBe').click();

  await expect(
      page.locator('.CodeMirror .source-line-running'),
      'check source tab',
  ).toHaveText('4        expect(1).toBe(1);');
});

test('should show snapshots for sync assertions', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        await page.getByRole('button').click();
        expect(1).toBe(1);
      });
    `,
  });

  await page.getByText('trace test').dblclick();

  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /page\.setContent[\d.]+m?s/,
    /locator\.clickgetByRole\('button'\)[\d.]+m?s/,
    /expect\.toBe[\d.]+m?s/,
    /After Hooks[\d.]+m?s/,
  ]);

  await expect(
      page.frameLocator('iframe.snapshot-visible[name=snapshot]').locator('button'),
      'verify snapshot'
  ).toHaveText('Submit');
});

test('should show image diff', async ({ runUITest }) => {
  const { page } = await runUITest({
    'playwright.config.js': `
      module.exports = {
        snapshotPathTemplate: '{arg}{ext}'
      };
    `,
    'snapshot.png': createImage(100, 100, 255, 0, 0),
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('vrt test', async ({ page }) => {
        await page.setViewportSize({ width: 100, height: 100 });
        await expect(page).toHaveScreenshot('snapshot.png', { timeout: 2000 });
      });
    `,
  });

  await page.getByText('vrt test').dblclick();
  await page.getByText(/Attachments/).click();
  await expect(page.getByText('Diff', { exact: true })).toBeVisible();
  await expect(page.getByText('Actual', { exact: true })).toBeVisible();
  await expect(page.getByText('Expected', { exact: true })).toBeVisible();
  await expect(page.getByTestId('test-result-image-mismatch').locator('img')).toBeVisible();
});

test('should show screenshot', async ({ runUITest }) => {
  const { page } = await runUITest({
    'playwright.config.js': `
      module.exports = {
        use: {
          screenshot: 'on',
          viewport: { width: 100, height: 100 }
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('vrt test', async ({ page }) => {
      });
    `,
  });

  await page.getByText('vrt test').dblclick();
  await page.getByText(/Attachments/).click();
  await expect(page.getByText('Screenshots', { exact: true })).toBeVisible();
  await expect(page.locator('.attachment-item img')).toHaveCount(1);
});

test('should not fail on internal page logs', async ({ runUITest, server }) => {
  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ browser }, testInfo) => {
        const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
        const page = await context.newPage();
        await page.goto("${server.EMPTY_PAGE}");
        await page.context().storageState({ path: testInfo.outputPath('storage.json') });
      });
    `,
  });

  await page.getByText('pass').dblclick();
  const listItem = page.getByTestId('actions-tree').getByRole('listitem');

  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /browser.newContext[\d.]+m?s/,
    /browserContext.newPage[\d.]+m?s/,
    /page.goto/,
    /browserContext.storageState[\d.]+m?s/,
    /After Hooks/,
  ]);
});

test('should not show caught errors in the errors tab', async ({ runUITest }, testInfo) => {
  const { page } = await runUITest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }, testInfo) => {
        await page.setContent("<input id='checkbox' type='checkbox'></input>");
        await expect(page.locator('input')).toBeChecked({ timeout: 1 }).catch(() => {});
      });
    `,
  });

  await page.getByText('pass').dblclick();
  const listItem = page.getByTestId('actions-tree').getByRole('listitem');

  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /page.setContent/,
    /expect.toBeCheckedlocator.*[\d.]+m?s/,
    /After Hooks/,
  ]);

  await page.getByText('Source', { exact: true }).click();
  await expect(page.locator('.source-line-running')).toContainText('toBeChecked');
  await expect(page.locator('.CodeMirror-linewidget')).toHaveCount(0);

  await page.getByText('Errors', { exact: true }).click();
  await expect(page.locator('.tab-errors')).toHaveText('No errors');
});

test('should reveal errors in the sourcetab', async ({ runUITest }) => {
  const { page } = await runUITest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        throw new Error('Oh my');
      });
    `,
  });

  await page.getByText('pass').dblclick();
  const listItem = page.getByTestId('actions-tree').getByRole('listitem');

  await expect(
      listItem,
      'action list'
  ).toContainText([
    /Before Hooks/,
    /After Hooks/,
  ]);

  await page.getByText('Errors', { exact: true }).click();
  await page.getByText('a.spec.ts:4', { exact: true }).click();
  await expect(page.locator('.source-line-running')).toContainText(`throw new Error('Oh my');`);
});

test('should show request source context id', async ({ runUITest, server }) => {
  const { page } = await runUITest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page, context, request }) => {
        await page.goto('${server.EMPTY_PAGE}');
        const page2 = await context.newPage();
        await page2.goto('${server.EMPTY_PAGE}');
        await request.get('${server.EMPTY_PAGE}');
      });
    `,
  });

  await page.getByText('pass').dblclick();
  await page.getByText('Network', { exact: true }).click();
  await expect(page.locator('span').filter({ hasText: 'Source' })).toBeVisible();
  await expect(page.getByText('page#1')).toBeVisible();
  await expect(page.getByText('page#2')).toBeVisible();
  await expect(page.getByText('api#1')).toBeVisible();
});
