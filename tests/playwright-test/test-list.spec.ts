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

import path from 'path';
import fs from 'fs';
import { test, expect } from './playwright-test-fixtures';

const varietyWorkspace = {
  'playwright.config.ts': `
    module.exports = { projects: [{ name: 'p1' }, { name: 'p2' }], testDir: 'tests', };
  `,
  'dir/test.list': `
      # this is a multiline comment

      # with an empty line in between
    [p1] > dir1/a.test.ts > test1
    [p2] › dir2${path.sep}b.spec.ts › suite › test2

    # more comments
          dir3/c.spec.ts > test2
  `,
  'empty.list': `
      # nothing to see here
  `,
  'ignore.list': `
    [p1] > dir1/a.test.ts > test1
  `,
  'tests/dir1/a.test.ts': `
    import { test, expect } from '@playwright/test';
    test('test1', async () => { console.log('\\n%%a-test1-' + test.info().project.name); });
    test('test2', async () => { console.log('\\n%%a-test2-' + test.info().project.name); });
  `,
  'tests/dir2/b.spec.ts': `
    import { test, expect } from '@playwright/test';
    test.describe('suite', () => {
      test('test1', async () => { console.log('\\n%%b-test1-' + test.info().project.name); });
      test.describe(() => {
        test('test2', async () => { console.log('\\n%%b-test2-' + test.info().project.name); });
      });
    });
  `,
  'tests/dir3/c.spec.ts': `
    import { test, expect } from '@playwright/test';
    test('test1', async () => { console.log('\\n%%c-test1-' + test.info().project.name); });
    test('test2', async () => { console.log('\\n%%c-test2-' + test.info().project.name); });
  `,
};

test('--test-list should work', async ({ runInlineTest }) => {
  const result = await runInlineTest(varietyWorkspace, { 'workers': 1, 'test-list': 'dir/test.list' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(result.outputLines).toEqual([
    'a-test1-p1',
    'c-test2-p1',
    'b-test2-p2',
    'c-test2-p2',
  ]);
});

test('--test-list-invert should work', async ({ runInlineTest }) => {
  const result = await runInlineTest(varietyWorkspace, { 'workers': 1, 'test-list-invert': 'dir/test.list' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(8);
  expect(result.outputLines).toEqual([
    'a-test2-p1',
    'b-test1-p1',
    'b-test2-p1',
    'c-test1-p1',
    'a-test1-p2',
    'a-test2-p2',
    'b-test1-p2',
    'c-test1-p2',
  ]);
});

test('--test-list applies before --test-list-invert', async ({ runInlineTest }) => {
  const result = await runInlineTest(varietyWorkspace, { 'workers': 1, 'test-list': 'dir/test.list', 'test-list-invert': 'ignore.list' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.outputLines).toEqual([
    'c-test2-p1',
    'b-test2-p2',
    'c-test2-p2',
  ]);
});

test('empty --test-list should work', async ({ runInlineTest }) => {
  const result = await runInlineTest(varietyWorkspace, { 'workers': 1, 'test-list': 'empty.list' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.outputLines).toEqual([
  ]);
});

test('--list output should work for --test-list', async ({ runInlineTest }) => {
  const listResult = await runInlineTest(varietyWorkspace, { 'list': true });
  expect(listResult.exitCode).toBe(0);
  const lines = listResult.output.split('\n').filter(line => !line.includes('Listing tests') && !line.includes('Total:'));
  await fs.promises.writeFile(test.info().outputPath('generated.list'), lines.join('\n'), 'utf-8');

  const result = await runInlineTest(varietyWorkspace, { 'workers': 1, 'test-list': 'generated.list' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(12);
  expect(result.outputLines).toEqual([
    'a-test1-p1',
    'a-test2-p1',
    'b-test1-p1',
    'b-test2-p1',
    'c-test1-p1',
    'c-test2-p1',
    'a-test1-p2',
    'a-test2-p2',
    'b-test1-p2',
    'b-test2-p2',
    'c-test1-p2',
    'c-test2-p2',
  ]);
});
