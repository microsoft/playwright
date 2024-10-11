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

const testFiles = {
  'a1.test.ts': `
    import { test, expect } from '@playwright/test';
    test('a1-test1', async () => { console.log('\\n%% a1-test1'); });
    test('a1-test2', async () => { console.log('\\n%% a1-test2'); });
  `,
  'a2.test.ts': `
    import { test, expect } from '@playwright/test';
    test('a2-test1', async () => { console.log('\\n%% a2-test1'); });
    test('a2-test2', async () => { console.log('\\n%% a2-test2'); });
  `,
  'a3.test.ts': `
    import { test, expect } from '@playwright/test';
    test('a3-test1', async () => { console.log('\\n%% a3-test1'); });
  `,
  'a4.test.ts': `
    import { test, expect } from '@playwright/test';
    test('a4-test1', async () => { console.log('\\n%% a4-test1'); });
  `,
};

test('config.filter function should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: (test) => test.title === 'a2-test2',
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  result.outputLines.sort();
  expect(result.outputLines).toEqual([
    'a2-test2',
  ]);
});

test('config.filter filterTests should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: {
          filterTests: (tests) => tests.filter((test, index) => index % 2 === 0),
        },
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  result.outputLines.sort();
  expect(result.outputLines).toEqual([
    'a1-test1',
    'a2-test1',
    'a3-test1',
  ]);
});

test('config.filter filterTestGroups should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: {
          filterTestGroups: (testgroups) => testgroups.filter((testgroup, index) => index % 2 === 1),
        },
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  result.outputLines.sort(); // Due to parallel execution, the order of output lines is not deterministic.
  expect(result.outputLines).toEqual([
    'a2-test1',
    'a2-test2',
    'a4-test1',
  ]);
});

test('config.filter async filterTests should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: {
          filterTests: (tests) => Promise.resolve(tests.filter((test, index) => index % 2 === 0)),
        },
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  result.outputLines.sort();
  expect(result.outputLines).toEqual([
    'a1-test1',
    'a2-test1',
    'a3-test1',
  ]);
});

test('config.filter async filterTestGroups should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: {
          filterTestGroups: (testgroups) => Promise.resolve(testgroups.filter((testgroup, index) => index % 2 === 1)),
        },
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  result.outputLines.sort(); // Due to parallel execution, the order of output lines is not deterministic.
  expect(result.outputLines).toEqual([
    'a2-test1',
    'a2-test2',
    'a4-test1',
  ]);
});

test('config.filter function should have access to config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter(test) {
          console.log('\\n%% .config.workers: '+this.config.workers);
          return test.title === 'a2-test2'
        },
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  result.outputLines.sort();
  expect(result.outputLines).toEqual([
    // filter function is called once per test...
    '.config.workers: 2',
    '.config.workers: 2',
    '.config.workers: 2',
    '.config.workers: 2',
    '.config.workers: 2',
    '.config.workers: 2',
    'a2-test2',
  ]);
});

test('config.filter filterTests should have access to config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: {
          filterTests(tests) {
            console.log('\\n%% .config.workers: '+this.config.workers);
            return tests.filter((test, index) => index % 2 === 0)
          },
        },
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  result.outputLines.sort();
  expect(result.outputLines).toEqual([
    // filterTests is only called once...
    '.config.workers: 2',
    'a1-test1',
    'a2-test1',
    'a3-test1',
  ]);
});

test('config.filter filterTestGroups should have access to config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: {
          filterTestGroups(testgroups) {
            console.log('\\n%% .config.workers: '+this.config.workers);
            return testgroups.filter((testgroup, index) => index % 2 === 1);
          },
        },
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  result.outputLines.sort(); // Due to parallel execution, the order of output lines is not deterministic.
  expect(result.outputLines).toEqual([
    // filterTestGroups is only called once...
    '.config.workers: 2',
    'a2-test1',
    'a2-test2',
    'a4-test1',
  ]);
});

test('config.filter invalid function should throw', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: (test) => undefined,
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: Invalid filter result: filter function should return a boolean');
});

test('config.filter invalid filterTests should throw', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: {
          filterTests: (tests) => undefined,
        },
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: Invalid filter result: tests should be an array');
});

test('config.filter invalid filterTestGroups should throw', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    ...testFiles,
    'playwright.config.ts': `
      module.exports = {
        filter: {
          filterTestGroups: (testgroups) => undefined,
        },
      };
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: Invalid filter result: test groups should be an array');
});
