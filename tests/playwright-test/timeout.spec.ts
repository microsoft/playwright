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

test('should run fixture teardown on timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export const test = pwt.test.extend({
        foo: async ({}, run, testInfo) => {
          await run();
          console.log('STATUS:' + testInfo.status);
        }
      });
    `,
    'c.spec.ts': `
      import { test } from './helper';
      test('works', async ({ foo }) => {
        await new Promise(f => setTimeout(f, 100000));
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('STATUS:timedOut');
});

test('should respect test.setTimeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const { test } = pwt;
      test('fails', async ({}) => {
        await new Promise(f => setTimeout(f, 1500));
      });
      test('passes', async ({}) => {
        await new Promise(f => setTimeout(f, 500));
        test.setTimeout(2000);
        await new Promise(f => setTimeout(f, 1000));
      });

      test.describe('suite', () => {
        test.beforeEach(() => {
          test.setTimeout(2000);
        });
        test('passes2', async ({}, testInfo) => {
          expect(testInfo.timeout).toBe(2000);
          await new Promise(f => setTimeout(f, 1500));
        });
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('Timeout of 1000ms exceeded');
});

test('should respect test.setTimeout outside of the test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const { test } = pwt;

      test.setTimeout(500);
      test('fails', async ({}) => {
        await new Promise(f => setTimeout(f, 1000));
      });
      test('passes', async ({}) => {
        await new Promise(f => setTimeout(f, 100));
      });

      test.describe('suite', () => {
        test.setTimeout(50);
        test('fails', async ({}) => {
          await new Promise(f => setTimeout(f, 100));
        });
        test('passes', async ({}) => {
        });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(2);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('Timeout of 500ms exceeded');
});

test('should timeout when calling test.setTimeout too late', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const { test } = pwt;
      test('fails', async ({}) => {
        await new Promise(f => setTimeout(f, 500));
        test.setTimeout(100);
        await new Promise(f => setTimeout(f, 1));
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Timeout of 100ms exceeded');
});

test('should respect test.slow', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const { test } = pwt;
      test('fails', async ({}) => {
        await new Promise(f => setTimeout(f, 1500));
      });
      test('passes', async ({}) => {
        test.slow();
        await new Promise(f => setTimeout(f, 1500));
      });

      test.describe('suite', () => {
        test.slow();
        test('passes2', async ({}, testInfo) => {
          expect(testInfo.timeout).toBe(3000);
          await new Promise(f => setTimeout(f, 1500));
        });
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('Timeout of 1000ms exceeded');
});
