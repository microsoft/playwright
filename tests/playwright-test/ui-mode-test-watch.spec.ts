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

import { test, expect, dumpTestTree } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel' });

test('should watch files', async ({ runUITest, writeFiles }) => {
  const page = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(2); });
    `,
  });

  await page.getByText('fails').click();
  await page.getByRole('listitem').filter({ hasText: 'fails' }).getByTitle('Watch').click();
  await page.getByRole('listitem').filter({ hasText: 'fails' }).getByTitle('Run').click();

  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toBe(`
    ▼ ❌ a.test.ts
        ◯ passes
        ❌ fails 👁 <=
  `);

  await writeFiles({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(1); });
    `
  });

  await expect.poll(dumpTestTree(page), { timeout: 15000 }).toBe(`
    ▼ ◯ a.test.ts
        ◯ passes
        ✅ fails 👁 <=
  `);
});
