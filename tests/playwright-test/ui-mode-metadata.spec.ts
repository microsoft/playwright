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

import { test } from './ui-mode-fixtures';

test.only('should display git info metadata', async ({ runUITest }) => {
  const { page } = await runUITest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        populateGitInfo: true,
      });
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {});
    `
  });
  await page.getByTitle('Run all').click();

  // todo: what to check?
});
