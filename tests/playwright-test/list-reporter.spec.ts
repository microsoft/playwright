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

import { test, expect, stripAscii } from './playwright-test-fixtures';

test('render each test with project name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'foo' },
        { name: 'bar' },
      ] };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('fails', async ({}) => {
        expect(1).toBe(0);
      });
      test('passes', async ({}) => {
        expect(0).toBe(0);
      });
    `,
  }, { reporter: 'list' });
  const text = stripAscii(result.output);
  const positiveStatusMarkPrefix = process.platform === 'win32' ? 'ok' : '✓ ';
  const negativateStatusMarkPrefix = process.platform === 'win32' ? 'x ' : '✘ ';
  expect(text).toContain(`${negativateStatusMarkPrefix} 1) [foo] › a.test.ts:6:7 › fails`);
  expect(text).toContain(`${negativateStatusMarkPrefix} 2) [bar] › a.test.ts:6:7 › fails`);
  expect(text).toContain(`${positiveStatusMarkPrefix} [foo] › a.test.ts:9:7 › passes`);
  expect(text).toContain(`${positiveStatusMarkPrefix} [bar] › a.test.ts:9:7 › passes`);
  expect(result.exitCode).toBe(1);
});
