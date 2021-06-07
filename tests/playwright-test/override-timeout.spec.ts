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

test('should consider dynamically set value', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { timeout: 100 };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('pass', ({}, testInfo) => {
        expect(testInfo.timeout).toBe(100);
      })
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should allow different timeouts', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { projects: [
        { timeout: 200 },
        { timeout: 100 },
      ] };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('pass', ({}, testInfo) => {
        console.log('timeout:' + testInfo.timeout);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('timeout:100');
  expect(result.output).toContain('timeout:200');
});

test('should prioritize value set via command line', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { timeout: 100 };
    `,
    'a.test.js': `
      const { test } = pwt;
      test('pass', ({}, testInfo) => {
        expect(testInfo.timeout).toBe(1000);
      })
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
