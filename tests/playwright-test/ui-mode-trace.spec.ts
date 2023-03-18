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

import { test, expect } from './ui-mode-fixtures';
test.describe.configure({ mode: 'parallel' });

test('should merge trace events', async ({ runUITest, server }) => {
  const page = await runUITest({
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

  const listItem = page.getByTestId('action-list').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /browserContext\.newPage[\d.]+m?s/,
    /page\.setContent[\d.]+m?s/,
    /expect\.toBe[\d.]+m?s/,
    /locator\.clickgetByRole\('button'\)[\d.]+m?s/,
    /expect\.toBe[\d.]+m?s/,
  ]);
});

test('should locate sync assertions in source', async ({ runUITest, server }) => {
  const page = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('trace test', async ({}) => {
        expect(1).toBe(1);
      });
    `,
  });

  await page.getByText('trace test').dblclick();

  await expect(
      page.locator('.CodeMirror .source-line-running'),
      'check source tab',
  ).toHaveText('4        expect(1).toBe(1);');
});

test('should show snapshots for sync assertions', async ({ runUITest, server }) => {
  const page = await runUITest({
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

  const listItem = page.getByTestId('action-list').getByRole('listitem');
  await expect(
      listItem,
      'action list'
  ).toHaveText([
    /browserContext\.newPage[\d.]+m?s/,
    /page\.setContent[\d.]+m?s/,
    /locator\.clickgetByRole\('button'\)[\d.]+m?s/,
    /expect\.toBe[\d.]+m?s/,
  ]);

  await expect(
      page.frameLocator('id=snapshot').locator('button'),
      'verify snapshot'
  ).toHaveText('Submit');
});
