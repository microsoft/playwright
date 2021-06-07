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

test('should respect .gitignore', async ({runInlineTest}) => {
  const result = await runInlineTest({
    '.gitignore': `a.spec.js`,
    'a.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => {});
    `,
    'b.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => {});
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect nested .gitignore', async ({runInlineTest}) => {
  const result = await runInlineTest({
    'a/.gitignore': `a.spec.js`,
    'a/a.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => {});
    `,
    'a/b.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => {});
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect enclosing .gitignore', async ({runInlineTest}) => {
  const result = await runInlineTest({
    '.gitignore': `a/a.spec.js`,
    'a/a.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => {});
    `,
    'a/b.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => {});
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect negations and comments in .gitignore', async ({runInlineTest}) => {
  const result = await runInlineTest({
    '.gitignore': `
      # A comment
      dir1/
      /dir2
      #a.spec.js
      !dir1/foo/a.spec.js
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => console.log('\\n%%a.spec.js'));
    `,
    'dir1/a.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => console.log('\\n%%dir1/a.spec.js'));
    `,
    'dir1/foo/a.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => console.log('\\n%%dir1/foo/a.spec.js'));
    `,
    'dir2/a.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => console.log('\\n%%dir2/a.spec.js'));
    `,
    'dir3/.gitignore': `
      b.*.js
    `,
    'dir3/a.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => console.log('\\n%%dir3/a.spec.js'));
    `,
    'dir3/b.spec.js': `
      const { test } = pwt;
      test('pass', ({}) => console.log('\\n%%dir3/b.spec.js'));
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%a.spec.js',
    '%%dir1/foo/a.spec.js',
    '%%dir3/a.spec.js',
  ]);
});
