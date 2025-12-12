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

import { expect, test } from './ui-mode-fixtures';

test('should filter network requests by resource type', async ({ runUITest, server }) => {
  server.setRoute('/api/endpoint', (_, res) => res.setHeader('Content-Type', 'application/json').end());

  const { page } = await runUITest({
    'network-tab.test.ts': `
      import { test, expect } from '@playwright/test';
      test('network tab test', async ({ page }) => {
        await page.goto('${server.PREFIX}/network-tab/network.html');
        await page.evaluate(() => (window as any).donePromise);
      });
    `,
  });

  await page.getByText('network tab test').dblclick();
  await page.getByText('Network', { exact: true }).click();

  const networkItems = page.getByRole('list', { name: 'Network requests' }).getByRole('listitem');

  await page.getByText('JS', { exact: true }).click();
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('script.js')).toBeVisible();

  await page.getByText('CSS', { exact: true }).click();
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('style.css')).toBeVisible();

  await page.getByText('Image', { exact: true }).click();
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('image.png')).toBeVisible();

  await page.getByText('Fetch', { exact: true }).click();
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('endpoint')).toBeVisible();

  await page.getByText('HTML', { exact: true }).click();
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('network.html')).toBeVisible();

  await page.getByText('Font', { exact: true }).click();
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('font.woff2')).toBeVisible();
});

test('should filter network requests by multiple resource types', async ({ runUITest, server }) => {
  server.setRoute('/api/endpoint', (_, res) => res.setHeader('Content-Type', 'application/json').end());

  const { page } = await runUITest({
    'network-tab.test.ts': `
      import { test, expect } from '@playwright/test';
      test('network tab test', async ({ page }) => {
        await page.goto('${server.PREFIX}/network-tab/network.html');
        await page.evaluate(() => (window as any).donePromise);
      });
    `,
  });

  await page.getByText('network tab test').dblclick();
  await page.getByText('Network', { exact: true }).click();

  const networkItems = page.getByRole('list', { name: 'Network requests' }).getByRole('listitem');
  await expect(networkItems).toHaveCount(9);

  await page.getByText('JS', { exact: true }).click();
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('script.js')).toBeVisible();

  await page.getByText('CSS', { exact: true }).click({ modifiers: ['ControlOrMeta'] });
  await expect(networkItems.getByText('script.js')).toBeVisible();
  await expect(networkItems.getByText('style.css')).toBeVisible();
  await expect(networkItems).toHaveCount(2);

  await page.getByText('Image', { exact: true }).click({ modifiers: ['ControlOrMeta'] });
  await expect(networkItems.getByText('image.png')).toBeVisible();
  await expect(networkItems).toHaveCount(3);

  await page.getByText('CSS', { exact: true }).click({ modifiers: ['ControlOrMeta'] });
  await expect(networkItems).toHaveCount(2);
  await expect(networkItems.getByText('script.js')).toBeVisible();
  await expect(networkItems.getByText('image.png')).toBeVisible();

  await page.getByText('All', { exact: true }).click();
  await expect(networkItems).toHaveCount(9);
});

test('should filter network requests by url', async ({ runUITest, server }) => {
  const { page } = await runUITest({
    'network-tab.test.ts': `
      import { test, expect } from '@playwright/test';
      test('network tab test', async ({ page }) => {
        await page.goto('${server.PREFIX}/network-tab/network.html');
        await page.evaluate(() => (window as any).donePromise);
      });
    `,
  });

  await page.getByText('network tab test').dblclick();
  await page.getByText('Network', { exact: true }).click();

  const networkItems = page.getByRole('list', { name: 'Network requests' }).getByRole('listitem');

  await page.getByPlaceholder('Filter network').fill('script.');
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('script.js')).toBeVisible();

  await page.getByPlaceholder('Filter network').fill('png');
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('image.png')).toBeVisible();

  await page.getByPlaceholder('Filter network').fill('api/');
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('endpoint')).toBeVisible();

  await page.getByPlaceholder('Filter network').fill('End');
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('endpoint')).toBeVisible();

  await page.getByPlaceholder('Filter network').fill('FON');
  await expect(networkItems).toHaveCount(1);
  await expect(networkItems.getByText('font.woff2')).toBeVisible();
});

test('should format JSON request body', async ({ runUITest, server }) => {
  const { page } = await runUITest({
    'network-tab.test.ts': `
      import { test, expect } from '@playwright/test';
      test('network tab test', async ({ page }) => {
        await page.goto('${server.PREFIX}/network-tab/network.html');
        await page.evaluate(() => (window as any).donePromise);
      });
    `,
  });

  await page.getByText('network tab test').dblclick();
  await page.getByText('Network', { exact: true }).click();

  await page.getByText('post-data-1').click();
  await page.getByRole('tabpanel', { name: 'Network' }).getByRole('tab', { name: 'Payload' }).click();
  const payloadPanel = page.getByRole('tabpanel', { name: 'Payload' });
  await expect(payloadPanel.locator('.CodeMirror-code .CodeMirror-line')).toHaveText([
    '{',
    '  "data": {',
    '    "key": "value",',
    '    "array": [',
    '      "value-1",',
    '      "value-2"',
    '    ]',
    '  }',
    '}',
  ], { useInnerText: true });

  await page.getByText('post-data-2').click();

  await expect(payloadPanel.locator('.CodeMirror-code .CodeMirror-line')).toHaveText([
    '{',
    '  "data": {',
    '    "key": "value",',
    '    "array": [',
    '      "value-1",',
    '      "value-2"',
    '    ]',
    '  }',
    '}',
  ], { useInnerText: true });
});

test('should display list of query parameters (only if present)', async ({ runUITest, server }) => {
  const { page } = await runUITest({
    'network-tab.test.ts': `
      import { test, expect } from '@playwright/test';
      test('network tab test', async ({ page }) => {
        await page.goto('${server.PREFIX}/network-tab/network.html');
        await page.evaluate(() => (window as any).donePromise);
      });
    `,
  });

  await page.getByText('network tab test').dblclick();
  await page.getByText('Network', { exact: true }).click();

  await page.getByText('call-with-query-params').click();
  await page.getByRole('tabpanel', { name: 'Network' }).getByRole('tab', { name: 'Payload' }).click();
  const payloadPanel = page.getByRole('tabpanel', { name: 'Payload' });
  const region = payloadPanel.getByRole('region', { name: 'Query String Parameters × 3' });
  await expect(region).toMatchAriaSnapshot(
      `- table:
         - rowgroup:
           - 'row "param1 value1"'
           - 'row "param1 value2"'
           - 'row "param2 value2"'
      `
  );

  await page.getByText('endpoint').click();

  await expect(region).toBeHidden();
});

test('should not duplicate network entries from beforeAll', {
  annotation: [
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/34404' },
    { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/33106' },
  ]
}, async ({ runUITest, server }) => {
  const { page } = await runUITest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on' } };
    `,
    'a.spec.ts': `
      import { test as base, expect, request, type APIRequestContext } from '@playwright/test';

      const test = base.extend<{}, { apiRequest: APIRequestContext }>({
        apiRequest: [async ({ }, use) => {
          const apiContext = await request.newContext();
          await use(apiContext);
          await apiContext.dispose();
        }, { scope: 'worker' }]
      });

      test.beforeAll(async ({ apiRequest }) => {
        await apiRequest.get("${server.EMPTY_PAGE}");
      });

      test('first test', async ({ }) => { });

      test.afterAll(async ({ apiRequest }) => { });
    `,
  });

  await page.getByText('first test').dblclick();
  await page.getByText('Network', { exact: true }).click();
  await expect(page.getByRole('list', { name: 'Network requests' }).getByText('empty.html')).toHaveCount(1);
});

test('should toggle sections inside network details', async ({ runUITest, server }) => {
  const { page } = await runUITest({
    'network-tab.test.ts': `
      import { test, expect } from '@playwright/test';
      test('network tab test', async ({ page }) => {
        await page.goto('${server.PREFIX}/network-tab/network.html');
        await page.evaluate(() => (window as any).donePromise);
      });
    `,
  });

  await page.getByRole('treeitem', { name: 'network tab test' }).dblclick();
  await page.getByRole('tab', { name: 'Network' }).click();
  await page.getByRole('listitem').filter({ hasText: 'post-data-1' }).click();
  const headersPanel = page.getByRole('tabpanel', { name: 'Headers' });

  await headersPanel.getByRole('button', { name: 'Request Headers × 16' }).click();
  await expect(headersPanel.getByRole('region', { name: 'Request Headers × 16' })).toBeHidden();
  await expect(headersPanel.getByRole('region', { name: 'General' })).toContainText(/Start.+Duration\d+ms/);

  await headersPanel.getByRole('button', { name: 'General' }).click();
  await expect(headersPanel.getByRole('region', { name: 'Request Headers × 16' })).toBeHidden();
  await expect(headersPanel.getByRole('region', { name: 'General' })).toBeHidden();

  await headersPanel.getByRole('button', { name: 'General' }).click();
  await expect(headersPanel.getByRole('region', { name: 'Request Headers × 16' })).toBeHidden();
  await expect(headersPanel.getByRole('region', { name: 'General' })).toContainText(/Start.+Duration\d+ms/);

  // Re-opening should preserve open state
  await page.getByRole('tabpanel', { name: 'Network' }).getByRole('button', { name: 'Close' }).click();
  await page.getByRole('listitem').filter({ hasText: 'post-data-1' }).click();
  await expect(headersPanel.getByRole('region', { name: 'Request Headers × 16' })).toBeHidden();
  await expect(headersPanel.getByRole('region', { name: 'General' })).toContainText(/Start.+Duration\d+ms/);
});
