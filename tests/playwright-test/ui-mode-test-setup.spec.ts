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

import { test, expect, retries } from './ui-mode-fixtures';

test.describe.configure({ mode: 'parallel', retries });

test('should run global setup and teardown', async ({ runUITest }) => {
  const { page, testProcess } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalSetup: './globalSetup',
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'globalSetup.ts': `
      export default () => console.log('\\n%%from-global-setup');
    `,
    'globalTeardown.ts': `
      export default () => console.log('\\n%%from-global-teardown');
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {});
    `
  });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  await page.close();
  await expect.poll(() => testProcess.outputLines()).toEqual([
    'from-global-setup',
    'from-global-teardown',
  ]);
});

test('should teardown on sigint', async ({ runUITest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');
  const { page, testProcess } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalSetup: './globalSetup',
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'globalSetup.ts': `
      export default () => console.log('\\n%%from-global-setup');
    `,
    'globalTeardown.ts': `
      export default () => console.log('\\n%%from-global-teardown');
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {});
    `
  });
  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');
  testProcess.process.kill('SIGINT');
  await expect.poll(() => testProcess.outputLines()).toEqual([
    'from-global-setup',
    'from-global-teardown',
  ]);
});
