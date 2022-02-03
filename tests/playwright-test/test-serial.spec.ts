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
      const { test } = pwt;
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
  expect(result.skipped).toBe(2);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test1',
    '%%test2',
    '%%test3',
  ]);
});

test('test.describe.serial should work in describe', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
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
  expect(result.skipped).toBe(2);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test1',
    '%%test2',
    '%%test3',
  ]);
});

test('test.describe.serial should work with retry', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
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
  expect(result.skipped).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test1',
    '%%test2',
    '%%test3',
    '%%test1',
    '%%test2',
    '%%test3',
    '%%test4',
  ]);
});

test('test.describe.serial should work with retry and beforeAll failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
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
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test1',
    '%%beforeAll',
    '%%test1',
    '%%beforeAll',
    '%%test2',
  ]);
});

test('test.describe.serial should work with retry and afterAll failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
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
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test1',
    '%%afterAll',
    '%%test1',
    '%%afterAll',
    '%%test2',
  ]);
});

test('test.describe.serial.only should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
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
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%test2',
    '%%test3',
  ]);
});

test('test.describe.serial should work with test.fail', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
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
  expect(result.skipped).toBe(1);
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%zero',
    '%%one',
    '%%two',
  ]);
});

test('test.describe.serial should work with test.fail and retries', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
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
  expect(result.output.split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%zero',
    '%%one',
    '%%two',
    '%%zero',
    '%%one',
    '%%two',
    '%%three',
  ]);
});

test('test.describe.serial should throw inside test.describe.parallel', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test.describe.parallel('parallel suite', () => {
        test.describe.serial('serial suite', () => {
        });
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('a.test.ts:7:23: describe.serial cannot be nested inside describe.parallel');
});
