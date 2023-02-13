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

import { test, expect, countTimes } from './playwright-test-fixtures';

test('test.describe.parallel should throw inside test.describe.serial', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.serial('serial suite', () => {
        test.describe.parallel('parallel suite', () => {
        });
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: describe.parallel cannot be nested inside describe.serial');
  expect(result.output).toContain('a.test.ts:4');
});

test('test.describe.parallel should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.parallel('parallel suite', () => {
        test('test1', async ({}, testInfo) => {
          console.log('\\n%% worker=' + testInfo.workerIndex);
          await new Promise(f => setTimeout(f, 1000));
        });
        test('test2', async ({}, testInfo) => {
          console.log('\\n%% worker=' + testInfo.workerIndex);
          await new Promise(f => setTimeout(f, 1000));
        });
        test.describe('inner suite', () => {
          test('test3', async ({}, testInfo) => {
            console.log('\\n%% worker=' + testInfo.workerIndex);
            await new Promise(f => setTimeout(f, 1000));
          });
        });
      });
    `,
  }, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.output).toContain('%% worker=0');
  expect(result.output).toContain('%% worker=1');
  expect(result.output).toContain('%% worker=2');
});

test('test.describe.parallel should work in file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ mode: 'parallel' });
      test('test1', async ({}, testInfo) => {
        console.log('\\n%% worker=' + testInfo.workerIndex);
        await new Promise(f => setTimeout(f, 1000));
      });
      test('test2', async ({}, testInfo) => {
        console.log('\\n%% worker=' + testInfo.workerIndex);
        await new Promise(f => setTimeout(f, 1000));
      });
      test.describe('inner suite', () => {
        test('test3', async ({}, testInfo) => {
          console.log('\\n%% worker=' + testInfo.workerIndex);
          await new Promise(f => setTimeout(f, 1000));
        });
      });
    `,
  }, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.output).toContain('%% worker=0');
  expect(result.output).toContain('%% worker=1');
  expect(result.output).toContain('%% worker=2');
});

test('test.describe.parallel should work in describe', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe('parallel suite', () => {
        test.describe.configure({ mode: 'parallel' });
        test('test1', async ({}, testInfo) => {
          console.log('\\n%% worker=' + testInfo.workerIndex);
          await new Promise(f => setTimeout(f, 1000));
        });
        test('test2', async ({}, testInfo) => {
          console.log('\\n%% worker=' + testInfo.workerIndex);
          await new Promise(f => setTimeout(f, 1000));
        });
        test.describe('inner suite', () => {
          test('test3', async ({}, testInfo) => {
            console.log('\\n%% worker=' + testInfo.workerIndex);
            await new Promise(f => setTimeout(f, 1000));
          });
        });
      });
    `,
  }, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.output).toContain('%% worker=0');
  expect(result.output).toContain('%% worker=1');
  expect(result.output).toContain('%% worker=2');
});

test('config.fullyParallel should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async ({}, testInfo) => {
        console.log('\\n%% worker=' + testInfo.workerIndex);
        await new Promise(f => setTimeout(f, 1000));
      });
      test('test2', async ({}, testInfo) => {
        console.log('\\n%% worker=' + testInfo.workerIndex);
        await new Promise(f => setTimeout(f, 1000));
      });
      test.describe('inner suite', () => {
        test('test3', async ({}, testInfo) => {
          console.log('\\n%% worker=' + testInfo.workerIndex);
          await new Promise(f => setTimeout(f, 1000));
        });
      });
    `,
  }, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.output).toContain('%% worker=0');
  expect(result.output).toContain('%% worker=1');
  expect(result.output).toContain('%% worker=2');
});

test('project.fullyParallel should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [ { fullyParallel: true } ] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async ({}, testInfo) => {
        console.log('\\n%% worker=' + testInfo.workerIndex);
        await new Promise(f => setTimeout(f, 1000));
      });
      test('test2', async ({}, testInfo) => {
        console.log('\\n%% worker=' + testInfo.workerIndex);
        await new Promise(f => setTimeout(f, 1000));
      });
      test.describe('inner suite', () => {
        test('test3', async ({}, testInfo) => {
          console.log('\\n%% worker=' + testInfo.workerIndex);
          await new Promise(f => setTimeout(f, 1000));
        });
      });
    `,
  }, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.output).toContain('%% worker=0');
  expect(result.output).toContain('%% worker=1');
  expect(result.output).toContain('%% worker=2');
});

test('parallel mode should minimize running beforeAll/afterAll hooks', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ mode: 'parallel' });
      test.beforeAll(() => {
        console.log('\\n%%beforeAll');
      });
      test.afterAll(() => {
        console.log('\\n%%afterAll');
      });
      test('test1', () => {});
      test('test2', () => {});
      test('test3', () => {});
      test('test4', () => {});
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(countTimes(result.output, '%%beforeAll')).toBe(1);
  expect(countTimes(result.output, '%%afterAll')).toBe(1);
});

test('parallel mode should minimize running beforeAll/afterAll hooks 2', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ mode: 'parallel' });
      test.beforeAll(() => {
        console.log('\\n%%beforeAll');
      });
      test.afterAll(() => {
        console.log('\\n%%afterAll');
      });
      test('test1', () => {});
      test('test2', () => {});
      test('test3', () => {});
      test('test4', () => {});
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(countTimes(result.output, '%%beforeAll')).toBe(2);
  expect(countTimes(result.output, '%%afterAll')).toBe(2);
});
