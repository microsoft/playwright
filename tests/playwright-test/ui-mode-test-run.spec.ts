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

const basicTestTree = {
  'a.test.ts': `
    import { test, expect } from '@playwright/test';
    test('passes', () => {});
    test('fails', () => { expect(1).toBe(2); });
    test.describe('suite', () => {
      test('inner passes', () => {});
      test('inner fails', () => { expect(1).toBe(2); });
    });
  `,
  'b.test.ts': `
    import { test, expect } from '@playwright/test';
    test('passes', () => {});
    test('fails', () => { expect(1).toBe(2); });
  `,
  'c.test.ts': `
    import { test, expect } from '@playwright/test';
    test('passes', () => {});
    test.skip('skipped', () => {});
  `,
};

test('should run visible', async ({ runUITest }) => {
  const page = await runUITest(basicTestTree);
  await expect.poll(dumpTestTree(page), { timeout: 0 }).toContain(`
    ▼ ◯ a.test.ts
  `);

  await page.getByTitle('Run all').click();

  await expect.poll(dumpTestTree(page), { timeout: 0 }).toBe(`
    ▼ ❌ a.test.ts
        ✅ passes
        ❌ fails <=
      ► ❌ suite
    ▼ ❌ b.test.ts
        ✅ passes
        ❌ fails
    ▼ ✅ c.test.ts
        ✅ passes
        ⊘ skipped
  `);
});

test('should run on double click', async ({ runUITest }) => {
  const page = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(2); });
    `,
  });

  await page.getByText('passes').dblclick();

  await expect.poll(dumpTestTree(page), { timeout: 0 }).toBe(`
    ▼ ◯ a.test.ts
        ✅ passes <=
        ◯ fails
  `);
});

test('should run on Enter', async ({ runUITest }) => {
  const page = await runUITest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
      test('fails', () => { expect(1).toBe(2); });
    `,
  });

  await page.getByText('fails').click();
  await page.keyboard.press('Enter');

  await expect.poll(dumpTestTree(page), { timeout: 0 }).toBe(`
    ▼ ❌ a.test.ts
        ◯ passes
        ❌ fails <=
  `);
});
