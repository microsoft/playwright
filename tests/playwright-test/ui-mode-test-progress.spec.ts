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
test.describe.configure({ mode: 'parallel' });

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

  const page = await runUITest({
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
      page.frameLocator('id=snapshot').locator('body'),
      'verify snapshot'
  ).toHaveText('One');
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
      page.frameLocator('id=snapshot').locator('body'),
      'verify snapshot'
  ).toHaveText('Two');

  await expect(listItem).toHaveText([
    /browserContext.newPage[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/one.html[\d.]+m?s/,
    /page.gotohttp:\/\/localhost:\d+\/two.html[\d.]+m?s/
  ]);
});
