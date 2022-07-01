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

test('should fall back to launchOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          launchOptions: {
            headless: false,
            channel: 'chrome',
          }
        }
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ headless, channel }) => {
        expect.soft(headless).toBe(false);
        expect.soft(channel).toBe('chrome');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should override launchOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          headless: false,
          channel: 'chrome',
          launchOptions: {
            headless: true,
            channel: 'msedge',
          }
        }
      };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('pass', async ({ headless, channel }) => {
        expect.soft(headless).toBe(false);
        expect.soft(channel).toBe('chrome');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
