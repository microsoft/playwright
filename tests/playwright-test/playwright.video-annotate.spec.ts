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

import { test, expect } from './playwright-test-fixtures';

const configWithTestAnnotation = `
  module.exports = { use: { video: { mode: 'on', show: { test: { level: 'step' } } } } };
`;

test('should show file, test title and step in the annotation overlay', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': configWithTestAnnotation,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      async function overlays(page) {
        return await page.locator('.x-pw-user-overlay').evaluateAll(
            els => els.map(el => el.innerText.split('\\n')));
      }

      test('my test', async ({ page }) => {
        await test.step('first step', async () => {
          expect(await overlays(page)).toEqual([['a.test.ts', 'my test', 'first step']]);
        });
        expect(await overlays(page)).toEqual([['a.test.ts', 'my test']]);
        await test.step('second step', async () => {
          expect(await overlays(page)).toEqual([['a.test.ts', 'my test', 'second step']]);
          await test.step('nested step', async () => {
            expect(await overlays(page)).toEqual([['a.test.ts', 'my test', 'second step', 'nested step']]);
          });
        });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should not stack annotation overlays when a page opens during a step', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': configWithTestAnnotation,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('my test', async ({ page, context }) => {
        await test.step('first step', async () => {
          const second = await context.newPage();
          await expect(page.locator('.x-pw-user-overlay')).toHaveCount(1);
          await expect(second.locator('.x-pw-user-overlay')).toHaveCount(1);
        });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should not fail a step when a page closes while the overlay is updated', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': configWithTestAnnotation,
    'a.test.ts': `
      import { test } from '@playwright/test';

      test('my test', async ({ context, page }) => {
        const pages = [];
        for (let i = 0; i < 5; i++)
          pages.push(await context.newPage());
        const closed = Promise.all(pages.map(p => p.close()));
        await test.step('first step', async () => {});
        await test.step('second step', async () => {});
        await closed;
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
