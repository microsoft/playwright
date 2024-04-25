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

test('test.describe.serial should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.serial('serial suite', () => {
        test('test1', async ({}) => {
          console.log('\\n%%test1');
        });
        test('test2', async ({}) => {
          console.log('\\n%%test2');
        });

        test.describe('inner suite', () => {
          test('test3', async ({}) => {
            console.log('\\n%%test3');
            expect(1).toBe(2);
          });
          test('test4', async ({}) => {
            console.log('\\n%%test4');
          });
        });

        test('test5', async ({}) => {
          console.log('\\n%%test5');
        });
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.didNotRun).toBe(2);
  expect(result.outputLines).toEqual([
    'test1',
    'test2',
    'test3',
  ]);
});

test('test.describe.serial should work in describe', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe('serial suite', () => {
        test.describe.configure({ mode: 'serial' });
        test('test1', async ({}) => {
          console.log('\\n%%test1');
        });
        test('test2', async ({}) => {
          console.log('\\n%%test2');
        });

        test.describe('inner suite', () => {
          test('test3', async ({}) => {
            console.log('\\n%%test3');
            expect(1).toBe(2);
          });
          test('test4', async ({}) => {
            console.log('\\n%%test4');
          });
        });

        test('test5', async ({}) => {
          console.log('\\n%%test5');
        });
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.didNotRun).toBe(2);
  expect(result.outputLines).toEqual([
    'test1',
    'test2',
    'test3',
  ]);
});

test('test.describe.serial should work with retry', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.serial('serial suite', () => {
        test('test1', async ({}) => {
          console.log('\\n%%test1');
        });
        test('test2', async ({}) => {
          console.log('\\n%%test2');
        });

        test.describe('inner suite', () => {
          test('test3', async ({}, testInfo) => {
            console.log('\\n%%test3');
            expect(testInfo.retry).toBe(1);
          });
          test('test4', async ({}) => {
            console.log('\\n%%test4');
            expect(1).toBe(2);
          });
        });

        test('test5', async ({}) => {
          console.log('\\n%%test5');
        });
      });
    `,
  }, { retries: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.flaky).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.didNotRun).toBe(1);
  expect(result.outputLines).toEqual([
    'test1',
    'test2',
    'test3',
    'test1',
    'test2',
    'test3',
    'test4',
  ]);
});

test('test.describe.serial should work with retry and beforeAll failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.serial('serial suite', () => {
        test('test1', async ({}) => {
          console.log('\\n%%test1');
        });

        test.describe('inner suite', () => {
          test.beforeAll(async ({}, testInfo) => {
            console.log('\\n%%beforeAll');
            expect(testInfo.retry).toBe(1);
          });
          test('test2', async ({}) => {
            console.log('\\n%%test2');
          });
        });
      });
    `,
  }, { retries: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.flaky).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'test1',
    'beforeAll',
    'test1',
    'beforeAll',
    'test2',
  ]);
});

test('test.describe.serial should work with retry and afterAll failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.serial('serial suite', () => {
        test.describe('inner suite', () => {
          let firstRun = false;
          test('test1', async ({}, testInfo) => {
            console.log('\\n%%test1');
            firstRun = testInfo.retry === 0;
          });
          test.afterAll(async ({}, testInfo) => {
            console.log('\\n%%afterAll');
            expect(firstRun).toBe(false);
          });
        });

        test('test2', async ({}) => {
          console.log('\\n%%test2');
        });
      });
    `,
  }, { retries: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.flaky).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'test1',
    'afterAll',
    'test1',
    'afterAll',
    'test2',
  ]);
});

test('test.describe.serial.only should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('test1', async ({}) => {
        console.log('\\n%%test1');
      });
      test.describe.serial.only('serial suite', () => {
        test('test2', async ({}) => {
          console.log('\\n%%test2');
        });
        test('test3', async ({}) => {
          console.log('\\n%%test3');
        });
      });
      test('test4', async ({}) => {
        console.log('\\n%%test4');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'test2',
    'test3',
  ]);
});

test('test.describe.serial should work with test.fail', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.serial('suite', () => {
        test('zero', () => {
          console.log('\\n%%zero');
        });

        test('one', ({}) => {
          console.log('\\n%%one');
          test.fail();
          expect(1).toBe(2);
        });

        test('two', ({}, testInfo) => {
          console.log('\\n%%two');
          test.fail();
          expect(testInfo.retry).toBe(0);
        });

        test('three', () => {
          console.log('\\n%%three');
        });
      });
    `,
  }, { retries: 0 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.didNotRun).toBe(1);
  expect(result.outputLines).toEqual([
    'zero',
    'one',
    'two',
  ]);
});

test('test.describe.serial should work with test.fail and retries', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.serial('suite', () => {
        test('zero', () => {
          console.log('\\n%%zero');
        });

        test('one', ({}) => {
          console.log('\\n%%one');
          test.fail();
          expect(1).toBe(2);
        });

        test('two', ({}, testInfo) => {
          console.log('\\n%%two');
          test.fail();
          expect(testInfo.retry).toBe(0);
        });

        test('three', () => {
          console.log('\\n%%three');
        });
      });
    `,
  }, { retries: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.flaky).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.outputLines).toEqual([
    'zero',
    'one',
    'two',
    'zero',
    'one',
    'two',
    'three',
  ]);
});

test('test.describe.serial should work inside test.describe.parallel', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.parallel('parallel suite', () => {
        test.describe.serial('serial suite', () => {
          test('one', async ({}) => {
            await new Promise(f => setTimeout(f, 2000));
            console.log('\\n%%1-one');
          });
          test('two', async ({}) => {
            await new Promise(f => setTimeout(f, 1000));
            console.log('\\n%%1-two');
          });
        });

        test.describe.serial('serial suite 2', () => {
          test('one', async ({}) => {
            await new Promise(f => setTimeout(f, 2000));
            console.log('\\n%%2-one');
          });
          test('two', async ({}) => {
            await new Promise(f => setTimeout(f, 1000));
            console.log('\\n%%2-two');
          });
        });
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(result.output).toContain('Running 4 tests using 2 workers');
  const lines = result.outputLines;
  // First test in each worker started before the second test in the other.
  // This means they were actually running in parallel.
  expect(lines.indexOf('1-one')).toBeLessThan(lines.indexOf('2-two'));
  expect(lines.indexOf('2-one')).toBeLessThan(lines.indexOf('1-two'));
  expect(lines.sort()).toEqual([
    '1-one',
    '1-two',
    '2-one',
    '2-two',
  ]);
});

test('test.describe.serial should work with fullyParallel', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.serial('serial suite', () => {
        test('one', async ({}) => {
          await new Promise(f => setTimeout(f, 1000));
          console.log('\\n%%one');
        });
        test('two', async ({}) => {
          await new Promise(f => setTimeout(f, 500));
          console.log('\\n%%two');
        });
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.outputLines).toEqual([
    'one',
    'two',
  ]);
});

test('serial fail + skip is failed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ mode: 'serial', retries: 1 });
      test.describe.serial('serial suite', () => {
        test('one', async () => {
          expect(test.info().retry).toBe(0);
        });
        test('two', async () => {
          expect(1).toBe(2);
        });
        test('three', async () => {
        });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.flaky).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.interrupted).toBe(0);
  expect(result.didNotRun).toBe(1);
});

test('serial skip + fail is failed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ mode: 'serial', retries: 1 });
      test.describe.serial('serial suite', () => {
        test('one', async () => {
          expect(test.info().retry).toBe(1);
        });
        test('two', async () => {
          expect(1).toBe(2);
        });
        test('three', async () => {
        });
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.skipped).toBe(0);
  expect(result.flaky).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.interrupted).toBe(0);
  expect(result.didNotRun).toBe(1);
});
