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

test('should create test n times', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'reporter.ts': `
      export default class Reporter {
        onBegin(config, suite) {
          const visit = suite => {
            for (const test of suite.tests || [])
              console.log('\\n%%title=' + test.title + ', tags=' + test.tags.join(','));
            for (const child of suite.suites || [])
              visit(child);
          };
          visit(suite);
        }
        onError(error) {
          console.log(error);
        }
      }
    `,
    'playwright.config.ts': `
      module.exports = {
        reporter: './reporter',
        tag: '@global',
      };
    `,
    'stdio.spec.js': `
      import { test, expect } from '@playwright/test';
      test('no-repeat', () => {
      });
      test('repeat-equal-1', { tag: '@foo', repeat: 1 }, () => {
      });
      test('repeat-equal-2', { tag: ['@foo', '@bar'], repeat: 2 }, () => {
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.outputLines).toEqual([
    `title=no-repeat, tags=@global`,
    `title=repeat-equal-1, tags=@global,@foo,@repeat=1`,
    `title=repeat-equal-2 (1/2), tags=@global,@foo,@bar,@repeat=2`,
    `title=repeat-equal-2 (2/2), tags=@global,@foo,@bar,@repeat=2`,
  ]);
});
