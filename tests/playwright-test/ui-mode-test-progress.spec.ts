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

import { ManualPromise } from '../../packages/playwright-core/lib/utils/manualPromise';
import { test, expect } from './ui-mode-fixtures';

test('should update trace live', async ({ runUITest, server }) => {
  const onePromise = new ManualPromise();

  server.setRoute('/one.html', async (req, res) => {
    await onePromise;
    res.end('<html>One</html>');
  });

  const twoPromise = new ManualPromise();
  server.setRoute('/two.html', async (req, res) => {
    await twoPromise;
    res.end('<html>Two</html>');
  });

  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('live test', async ({ page }) => {
        await page.goto('${server.PREFIX}/one.html');
        await page.goto('${server.PREFIX}/two.html');
      });
    `,
  });

  // Start test.
  await page.getByText('live test').dblclick();

  // It should halt on loading one.html.
  const listItem = page.getByTestId('action-list').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /browserContext.newPage[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/one.html/
  ], { timeout: 15000 });

  await expect(
      listItem.locator(':scope.selected'),
      'last action to be selected'
  ).toHaveText(/page.goto/);
  await expect(
      listItem.locator(':scope.selected .codicon.codicon-loading'),
      'spinner'
  ).toBeVisible();

  await expect(
      page.locator('.CodeMirror .source-line-running'),
      'check source tab',
  ).toHaveText(/4        await page.goto\('http:\/\/localhost:\d+\/one.html/);

  // Unlock the navigation step.
  onePromise.resolve();

  await expect(
      page.frameLocator('iframe.snapshot-visible[name=snapshot]').locator('body'),
      'verify snapshot'
  ).toHaveText('One', { timeout: 15000 });
  await expect(listItem).toHaveText([
    /browserContext.newPage[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/one.html[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/two.html/
  ]);
  await expect(
      listItem.locator(':scope.selected'),
      'last action to be selected'
  ).toHaveText(/page.goto/);
  await expect(
      listItem.locator(':scope.selected .codicon.codicon-loading'),
      'spinner'
  ).toBeVisible();

  await expect(
      page.locator('.CodeMirror .source-line-running'),
      'check source tab',
  ).toHaveText(/5        await page.goto\('http:\/\/localhost:\d+\/two.html/);

  // Unlock the navigation step.
  twoPromise.resolve();

  await expect(
      page.frameLocator('iframe.snapshot-visible[name=snapshot]').locator('body'),
      'verify snapshot'
  ).toHaveText('Two');

  await expect(listItem).toHaveText([
    /browserContext.newPage[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/one.html[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/two.html[\d.]+m?s/
  ]);
});

test('should preserve action list selection upon live trace update', async ({ runUITest, server, createLatch }) => {
  const latch = createLatch();

  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('live test', async ({ page }) => {
        await page.goto('about:blank');
        await page.setContent('hello');
        ${latch.blockingCode}
        await page.setContent('world');
        await new Promise(() => {});
      });
    `,
  });

  // Start test.
  await page.getByText('live test').dblclick();

  // It should wait on the latch.
  const listItem = page.getByTestId('action-list').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /browserContext.newPage[\d.]+m?s/,
    /page.gotoabout:blank[\d.]+m?s/,
    /page.setContent[\d.]+m?s/,
  ], { timeout: 15000 });

  // Manually select page.goto.
  await page.getByTestId('action-list').getByText('page.goto').click();

  // Generate more actions and check that we are still on the page.goto action.
  latch.open();
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /browserContext.newPage[\d.]+m?s/,
    /page.gotoabout:blank[\d.]+m?s/,
    /page.setContent[\d.]+m?s/,
    /page.setContent[\d.]+m?s/,
  ]);
  await expect(
      listItem.locator(':scope.selected'),
      'selected action stays the same'
  ).toHaveText(/page.goto/);
});

test('should update tracing network live', async ({ runUITest, server }) => {
  server.setRoute('/style.css', async (req, res) => {
    res.end('body { background: red; }');
  });

  server.setRoute('/one.html', async (req, res) => {
    res.end(`
      <head>
        <link rel=stylesheet href="./style.css"></link>
      </head>
      <body>
        One
      </body>
    `);
  });

  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('live test', async ({ page }) => {
        await page.goto('${server.PREFIX}/one.html');
        await page.setContent('hello');
        await new Promise(() => {});
      });
    `,
  });

  // Start test.
  await page.getByText('live test').dblclick();

  // It should wait on the latch.
  const listItem = page.getByTestId('action-list').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /browserContext.newPage[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/one.html[\d.]+m?s/,
    /page.setContent[\d.]+m?s/,
  ], { timeout: 15000 });

  // Once page.setContent is visible, we can be sure that page.goto has all required
  // resources in the trace. Switch to it and check that everything renders.
  await page.getByTestId('action-list').getByText('page.goto').click();

  await expect(
      page.frameLocator('iframe.snapshot-visible[name=snapshot]').locator('body'),
      'verify background'
  ).toHaveCSS('background-color', 'rgb(255, 0, 0)', { timeout: 15000 });
});

test('should show trace w/ multiple contexts', async ({ runUITest, server, createLatch }) => {
  const latch = createLatch();

  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeEach(async ({ request }) => {
        await request.get('${server.EMPTY_PAGE}');
      });
      test('live test', async ({ page }) => {
        await page.goto('about:blank');
        ${latch.blockingCode}
      });
    `,
  });

  // Start test.
  await page.getByText('live test').dblclick();

  // It should wait on the latch.
  const listItem = page.getByTestId('action-list').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /apiRequestContext.get[\d.]+m?s/,
    /browserContext.newPage[\d.]+m?s/,
    /page.gotoabout:blank[\d.]+m?s/,
  ], { timeout: 15000 });

  latch.open();
});
