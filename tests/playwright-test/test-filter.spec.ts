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

test('--filter should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [{}, { name: 'p1' }, { name: 'p2' }] };
    `,
    'filter.json': `
      {
        "titlePath": [
          ["p2", "b.test.ts", "test2"],
          ["p1", "a.test.ts", "suite2", "test2"],
          ["p1", "b.test.ts", "suite2", "test1"],
          ["", "a.test.ts", "suite1", "test1"]
        ]
      }
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe('suite1', () => {
        test('test1', async () => { console.log('\\n%%a-' + test.info().project.name + '-suite1-test1'); });
        test('test2', async () => { console.log('\\n%%a-' + test.info().project.name + '-suite1-test2'); });
      });
      test.describe('suite2', () => {
        test('test1', async () => { console.log('\\n%%a-' + test.info().project.name + '-suite2-test1'); });
        test('test2', async () => { console.log('\\n%%a-' + test.info().project.name + '-suite2-test2'); });
      });
      test('test1', async () => { console.log('\\n%%a-' + test.info().project.name + '-test1'); });
      test('test2', async () => { console.log('\\n%%a-' + test.info().project.name + '-test2'); });
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe('suite1', () => {
        test('test1', async () => { console.log('\\n%%b-' + test.info().project.name + '-suite1-test1'); });
        test('test2', async () => { console.log('\\n%%b-' + test.info().project.name + '-suite1-test2'); });
      });
      test.describe('suite2', () => {
        test('test1', async () => { console.log('\\n%%b-' + test.info().project.name + '-suite2-test1'); });
        test('test2', async () => { console.log('\\n%%b-' + test.info().project.name + '-suite2-test2'); });
      });
      test('test1', async () => { console.log('\\n%%b-' + test.info().project.name + '-test1'); });
      test('test2', async () => { console.log('\\n%%b-' + test.info().project.name + '-test2'); });
    `,
  }, { workers: 1, filter: 'filter.json' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(result.failed).toBe(0);
  expect(result.outputLines).toEqual([
    'a--suite1-test1',
    'a-p1-suite2-test2',
    'b-p1-suite2-test1',
    'b-p2-test2',
  ]);
});

test('--filter should complain about missing file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', () => {});
    `,
  }, { workers: 1, filter: 'filter.json' });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Failed to read test filter file "${test.info().outputPath('filter.json')}"`);
});

test('--filter should complain about malformed file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'filter.json': `
      { "titlePath": [[], "not an array"] }
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', () => {});
    `,
  }, { workers: 1, filter: 'filter.json' });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Failed to read test filter file "${test.info().outputPath('filter.json')}": Wrong test filter file format`);
});
