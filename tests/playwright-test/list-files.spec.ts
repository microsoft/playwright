/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';

test('should list files', async ({ runCLICommand }) => {
  const result = await runCLICommand({
    'playwright.config.ts': `
      module.exports = { projects: [{ name: 'foo' }, { name: 'bar' }] };
    `,
    'a.test.js': ``
  }, 'list-files');
  expect(result.exitCode).toBe(0);

  const data = JSON.parse(result.stdout);
  expect(data).toEqual({
    projects: [
      {
        name: 'foo',
        testDir: expect.stringContaining('list-files-should-list-files-playwright-test'),
        use: {},
        files: [
          expect.stringContaining('a.test.js')
        ]
      },
      {
        name: 'bar',
        testDir: expect.stringContaining('list-files-should-list-files-playwright-test'),
        use: {},
        files: [
          expect.stringContaining('a.test.js')
        ]
      }
    ]
  });
});

test('should include testIdAttribute', async ({ runCLICommand }) => {
  const result = await runCLICommand({
    'playwright.config.ts': `
      module.exports = {
        use: { testIdAttribute: 'myid' }
      };
    `,
    'a.test.js': ``
  }, 'list-files');
  expect(result.exitCode).toBe(0);

  const data = JSON.parse(result.stdout);
  expect(data).toEqual({
    projects: [
      {
        name: '',
        testDir: expect.stringContaining('list-files-should-include-testIdAttribute-playwright-test'),
        use: {
          testIdAttribute: 'myid'
        },
        files: [
          expect.stringContaining('a.test.js')
        ]
      },
    ]
  });
});

test('should report error', async ({ runCLICommand }) => {
  const result = await runCLICommand({
    'playwright.config.ts': `
      const a = 1;
      a = 2;
    `,
    'a.test.js': ``
  }, 'list-files');
  expect(result.exitCode).toBe(0);

  const data = JSON.parse(result.stdout);
  expect(data).toEqual({
    error: {
      location: {
        file: expect.stringContaining('playwright.config.ts'),
        line: 3,
        column: 8,
      },
      message: 'TypeError: Assignment to constant variable.',
      stack: expect.stringContaining('TypeError: Assignment to constant variable.'),
    }
  });
});
