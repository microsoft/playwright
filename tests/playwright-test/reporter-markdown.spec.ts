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

import * as fs from 'fs';
import { expect, test } from './playwright-test-fixtures';

test('simple report', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        retries: 1,
        reporter: 'markdown',
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('failing 1', async ({}) => {
        expect(1).toBe(2);
      });
      test('flaky 1', async ({}) => {
        expect(test.info().retry).toBe(1);
      });
      test.skip('skipped 1', async ({}) => {});
    `,
    'b.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 2', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('failing 2', async ({}) => {
        expect(1).toBe(2);
      });
      test.skip('skipped 2', async ({}) => {});
    `,
    'c.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 3', async ({}) => {
        expect(1 + 1).toBe(2);
      });
      test('flaky 2', async ({}) => {
        expect(test.info().retry).toBe(1);
      });
      test.skip('skipped 3', async ({}) => {});
    `
  };
  const { exitCode } = await runInlineTest(files);
  expect(exitCode).toBe(1);
  const reportFile = await fs.promises.readFile(test.info().outputPath('report.md'));
  expect(reportFile.toString()).toBe(`:x: <b>failed: 2</b>
 - a.test.js:6:11 › failing 1
 - b.test.js:6:11 › failing 2

:warning: <b>flaky: 2</b>
 - a.test.js:9:11 › flaky 1
 - c.test.js:6:11 › flaky 2

:ballot_box_with_check: <b>skipped: 3</b>

:white_check_mark: <b>passed: 3</b>
`);
});

test('custom report file', async ({ runInlineTest }) => {
  const files = {
    'playwright.config.ts': `
      module.exports = {
        reporter: [['markdown', { outputFile: 'my-report.md' }]],
      };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('math 1', async ({}) => {
        expect(1 + 1).toBe(2);
      });
    `,
  };

  const { exitCode } = await runInlineTest(files);
  expect(exitCode).toBe(0);
  const reportFile = await fs.promises.readFile(test.info().outputPath('my-report.md'));
  expect(reportFile.toString()).toBe(`:x: <b>failed: 0</b>

:white_check_mark: <b>passed: 1</b>
`);
});