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
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');

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
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');

  await page.getByText('Network', { exact: true }).click();

  const networkItems = page.getByRole('list', { name: 'Network requests' }).getByRole('listitem');
  await expect(networkItems).toHaveCount(10);

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
  await expect(networkItems).toHaveCount(10);
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
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');

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

test('should pretty-print JSON request body', async ({ runUITest, server }) => {
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
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');

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

  // Toggle off pretty print to see original request body
  await payloadPanel.getByRole('button', { name: 'Pretty print', exact: true }).click();
  await expect(payloadPanel.locator('.CodeMirror-code .CodeMirror-line')).toHaveText([
    '{"data":{"key":"value","array":["value-1","value-2"]}}'
  ], { useInnerText: true });
});

test('should pretty-print XML request body', async ({ runUITest, server }) => {
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
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');

  await page.getByText('Network', { exact: true }).click();
  await page.getByText('post-xml-data').click();
  await page.getByRole('tabpanel', { name: 'Network' }).getByRole('tab', { name: 'Payload' }).click();
  const payloadPanel = page.getByRole('tabpanel', { name: 'Payload' });
  await expect(payloadPanel.locator('.CodeMirror-code .CodeMirror-line')).toHaveText([
    '<?xml version="1.0"?>',
    '<note to="Alice" from="Bob">',
    '    <body>Hello &amp; welcome!</body>',
    '</note>'
  ], { useInnerText: true });

  // Toggle off pretty print to see original request body
  await payloadPanel.getByRole('button', { name: 'Pretty print', exact: true }).click();
  await expect(payloadPanel.locator('.CodeMirror-code .CodeMirror-line')).toHaveText([
    '<?xml version="1.0"?><note to="Alice" from="Bob"><body>Hello &amp; welcome!</body></note>'
  ], { useInnerText: true });
});

test('should pretty-print response bodies and show formatting errors', async ({ runUITest, server }) => {
  server.setRoute('/response-json-good', (_, res) => res.setHeader('Content-Type', 'application/json').end('{"ok":true,"items":[1,2]}'));
  server.setRoute('/response-json-bad', (_, res) => res.setHeader('Content-Type', 'application/json').end('{"ok":true,,}'));

  const { page } = await runUITest({
    'network-tab.test.ts': `
      import { test } from '@playwright/test';
      test('network response tab', async ({ request }) => {
        await Promise.all([
          request.get('${server.PREFIX}/response-json-good'),
          request.get('${server.PREFIX}/response-json-bad'),
        ].map(r => r.then(res => res.text())));
      });
    `,
  });

  await page.getByText('network response tab').dblclick();
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');
  await page.getByRole('tab', { name: 'Network' }).click();

  const networkList = page.getByRole('list', { name: 'Network requests' }).getByRole('listitem');
  const responsePanel = page.getByRole('tabpanel', { name: 'Response' });

  // Pretty printed by default
  await networkList.filter({ hasText: 'response-json-good' }).click();
  await page.getByRole('tabpanel', { name: 'Network' }).getByRole('tab', { name: 'Response' }).click();
  await expect(responsePanel.locator('.CodeMirror-code .CodeMirror-line')).toHaveText([
    '{',
    '  "ok": true,',
    '  "items": [',
    '    1,',
    '    2',
    '  ]',
    '}',
  ], { useInnerText: true });

  // Toggle off to see original body
  const prettyPrint = responsePanel.getByRole('button', { name: 'Pretty print', exact: true });
  const prettyPrintError = responsePanel.getByTitle('Formatting failed');
  await prettyPrint.click();
  await expect(responsePanel.locator('.CodeMirror-code .CodeMirror-line')).toHaveText([
    '{"ok":true,"items":[1,2]}',
  ], { useInnerText: true });
  await expect(prettyPrintError).toBeHidden();

  // Re-enable pretty print so errors are surfaced
  await prettyPrint.click();

  // Malformed JSON shows badge and preserves original text
  await networkList.filter({ hasText: 'response-json-bad' }).click();
  await expect(responsePanel.locator('.CodeMirror-code .CodeMirror-line')).toHaveText([
    '{"ok":true,,}',
  ], { useInnerText: true });
  await expect(prettyPrintError).toBeVisible();
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
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');

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
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');

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
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');

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

test('should copy network request', async ({ runUITest, server }) => {
  const { page } = await runUITest({
    'network-tab.test.ts': `
      import { test, expect } from '@playwright/test';
      test('network tab test', async ({ page }) => {
        await page.goto('${server.PREFIX}/network-tab/network.html');
        await page.evaluate(() => (window as any).donePromise);
      });
    `,
  });

  await page.evaluate(() => {
    (window as any).__clipboardCall = '';
    navigator.clipboard.writeText = async (text: string) => {
      (window as any).__clipboardCall = text;
    };
  });

  await page.getByRole('treeitem', { name: 'network tab test' }).dblclick();
  await expect(page.getByTestId('workbench-run-status')).toContainText('Passed');

  await page.getByRole('tab', { name: 'Network' }).click();
  await page.getByRole('listitem').filter({ hasText: 'post-data-1' }).click();

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);

  await page.getByRole('button', { name: 'Copy request' }).hover();
  await page.getByRole('button', { name: 'Copy as cURL' }).click();
  await expect(async () => {
    const curlRequest = await page.evaluate(() => (window as any).__clipboardCall);
    if (process.platform === 'win32') {
      expect(curlRequest).toContain(`curl ^"${server.PREFIX}/post-data-1^"`);
      expect(curlRequest).toContain(`-H ^"content-type: application/json^"`);
      expect(curlRequest).toContain(`--data-raw ^"^{^\\^"data^\\^":^{^\\^"key^\\^":^\\^"value^\\^",^\\^"array^\\^":^[^\\^"value-1^\\^",^\\^"value-2^\\^"^]^}^}^"`);
    } else {
      expect(curlRequest).toContain(`curl '${server.PREFIX}/post-data-1'`);
      expect(curlRequest).toContain(`-H 'content-type: application/json'`);
      expect(curlRequest).toContain(`--data-raw '{"data":{"key":"value","array":["value-1","value-2"]}}'`);
    }
  }).toPass();

  await page.getByRole('button', { name: 'Copy request' }).hover();
  await page.getByRole('button', { name: 'Copy as Fetch' }).click();
  await expect(async () => {
    const fetchRequest = await page.evaluate(() => (window as any).__clipboardCall);
    expect(fetchRequest).toContain(`fetch("${server.PREFIX}/post-data-1", {`);
    expect(fetchRequest).toContain(`"content-type": "application/json"`);
    expect(fetchRequest).toContain(`"body": "{\\"data\\":{\\"key\\":\\"value\\",\\"array\\":[\\"value-1\\",\\"value-2\\"]}}"`);
    expect(fetchRequest).toContain(`"method": "POST"`);
  }).toPass();

  await page.getByRole('button', { name: 'Copy request' }).hover();
  await page.getByRole('button', { name: 'Copy as Playwright' }).click();
  await expect(async () => {
    const playwrightRequest = await page.evaluate(() => (window as any).__clipboardCall);
    expect(playwrightRequest).toContain(`await page.request.post('${server.PREFIX}/post-data-1', {`);
    expect(playwrightRequest.replaceAll('\r\n', '\n')).toContain(
        `  data: '{"data":{"key":"value","array":["value-1","value-2"]}}'`
    );
    expect(playwrightRequest).toContain(`'content-type': 'application/json'`);
  }).toPass();
});


test('should preserve selection during test run', async ({ runUITest, server }, testInfo) => {
  const { page } = await runUITest({
    'network-tab.test.ts': `
      import { test, expect } from '@playwright/test';
      test('network tab test', async ({ page }) => {
        await page.goto('${server.PREFIX}/network-tab/network.html');
        // Keep test running to make sure that selected network entry stay open
        await page.waitForTimeout(${testInfo.timeout});
      });
    `,
  });

  await page.getByRole('treeitem', { name: 'network tab test' }).dblclick();
  await page.getByRole('tab', { name: 'Network' }).click();
  await page.getByRole('listitem').filter({ hasText: 'network.html' }).click();
  const headersPanel = page.getByRole('tabpanel', { name: 'Headers' });
  await expect(headersPanel).toBeVisible();

  // Wait to ensure that trace polling (every 500ms) does not close the selected entry
  await page.waitForTimeout(1000);
  await expect(headersPanel).toBeVisible();
});
