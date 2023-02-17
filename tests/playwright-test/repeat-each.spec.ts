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

test('should repeat from command line', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('test', ({}, testInfo) => {
        console.log('REPEAT ' + testInfo.repeatEachIndex);
        expect(1).toBe(1);
      });
    `
  }, { 'repeat-each': 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.output).toContain('REPEAT 0');
  expect(result.output).toContain('REPEAT 1');
  expect(result.output).toContain('REPEAT 2');
  expect(result.output).not.toContain('REPEAT 3');
});

test('should repeat based on config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { projects: [
        { name: 'no-repeats' },
        { repeatEach: 2, name: 'two-repeats' },
      ] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('my test', ({}, testInfo) => {});
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  const names = result.report.suites[0].specs[0].tests.map(test => test.projectName);
  expect(names).toEqual(['no-repeats', 'two-repeats', 'two-repeats']);
});
