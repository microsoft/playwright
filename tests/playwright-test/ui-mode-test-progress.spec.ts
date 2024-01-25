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
import { test, expect, retries, dumpTestTree } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

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
  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/one.html/
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
  ).toHaveText(/4        await page.goto\('http:\/\/localhost:\d+\/one.html/);

  // Unlock the navigation step.
  onePromise.resolve();

  await expect(
      page.frameLocator('iframe.snapshot-visible[name=snapshot]').locator('body'),
      'verify snapshot'
  ).toHaveText('One');
  await expect(listItem).toHaveText([
    /Before Hooks[\d.]+m?s/,
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
    /Before Hooks[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/one.html[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/two.html[\d.]+m?s/,
    /After Hooks[\d.]+m?s/,
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
  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /page.gotoabout:blank[\d.]+m?s/,
    /page.setContent[\d.]+m?s/,
  ]);

  // Manually select page.goto.
  await page.getByTestId('actions-tree').getByText('page.goto').click();

  // Generate more actions and check that we are still on the page.goto action.
  latch.open();
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
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
  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/one.html[\d.]+m?s/,
    /page.setContent[\d.]+m?s/,
  ]);

  // Once page.setContent is visible, we can be sure that page.goto has all required
  // resources in the trace. Switch to it and check that everything renders.
  await page.getByTestId('actions-tree').getByText('page.goto').click();

  await expect(
      page.frameLocator('iframe.snapshot-visible[name=snapshot]').locator('body'),
      'verify background'
  ).toHaveCSS('background-color', 'rgb(255, 0, 0)');
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
  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /page.gotoabout:blank[\d.]+m?s/,
  ]);

  latch.open();
});

test('should show live trace for serial', async ({ runUITest, server, createLatch }) => {
  const latch = createLatch();

  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      let page;
      test.describe.configure({ mode: 'serial' });
      test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
      });
      test('one', async ({ }) => {
        await page.setContent('<input id=checkbox type=checkbox></input>');
        await page.locator('input').check();
        await expect(page.locator('input')).toBeChecked();
      });

      test('two', async ({ }) => {
        await page.locator('input').uncheck();
        await expect(page.locator('input')).not.toBeChecked();
        ${latch.blockingCode}
      });
    `,
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ one
        ◯ two
  `);
  await page.getByText('two', { exact: true }).click();
  await page.getByTitle('Run all').click();

  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks[\d.]+m?s/,
    /locator.unchecklocator\('input'\)[\d.]+m?s/,
    /expect.not.toBeCheckedlocator\('input'\)[\d.]/,
  ]);
});

test('should show live trace from hooks', async ({ runUITest, createLatch }) => {
  const latch1 = createLatch();
  const latch2 = createLatch();

  const { page } = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(async ({ browser }) => {
        const page = await browser.newPage();
        ${latch1.blockingCode}
        await page.close();
      });
      test.beforeEach(async ({ browser }) => {
        const page = await browser.newPage();
        ${latch2.blockingCode}
        await page.close();
      });
      test('test one', async ({ page }) => {
        await page.setContent('Page content');
      });
    `,
  });

  await expect.poll(dumpTestTree(page)).toBe(`
    ▼ ◯ a.test.ts
        ◯ test one
  `);
  await page.getByText('test one').dblclick();

  const listItem = page.getByTestId('actions-tree').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks/,
    /beforeAll hook/,
    /fixture: browser/,
    /browser.newPage/,
  ]);
  latch1.open();
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks/,
    /beforeAll hook/,
    /beforeEach hook/,
    /browser.newPage/,
  ]);
  latch2.open();
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /Before Hooks/,
    /page.setContent/,
    /After Hooks/,
  ]);
});
