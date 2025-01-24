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

const reporter = `
  class Reporter {
    onBegin(config, suite) {
      console.log(JSON.stringify(config.metadata, null, 2));
    }
     
    printsToStdio() {
      return true;
    } 
  }
  module.exports = Reporter;
`;

test('should render html report git info metadata', async ({ runUITest }) => {
  const { page, testProcess } = await runUITest({
    'reporter.ts': reporter,
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        populateGitInfo: true,
        reporter: './reporter.ts',
      });
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {});
    `
  }, {
    BUILD_URL: 'https://playwright.dev',
  });

  await page.getByTitle('Run all').click();
  await expect(page.getByTestId('status-line')).toHaveText('1/1 passed (100%)');

  // 1. testProcess.output is not populated with console.log from reporter
  // 2. even with PWTEST_DEBUG=1 output contains unpopulated metadata: { actualWorkers: 1 }
  expect(testProcess.output).toContain(`"ci.link": "https://playwright.dev"`);
});
