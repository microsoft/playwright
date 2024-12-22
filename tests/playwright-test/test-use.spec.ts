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

test('should merge options', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: 'foo',
        bar: 'bar',
      });

      test.use({ foo: 'foo2' });
      test.use({ bar: 'bar2' });
      test('test', ({ foo, bar }) => {
        expect(foo).toBe('foo2');
        expect(bar).toBe('bar2');
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should run tests with different test options in the same worker', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base } from '@playwright/test';
      export * from '@playwright/test';
      export const test = base.extend({
        foo: 'foo',
      });
    `,
    'a.test.ts': `
      import { test, expect } from './helper';
      test('test', ({ foo }, testInfo) => {
        expect(foo).toBe('foo');
        expect(testInfo.workerIndex).toBe(0);
      });

      test.describe('suite1', () => {
        test.use({ foo: 'bar' });
        test('test1', ({ foo }, testInfo) => {
          expect(foo).toBe('bar');
          expect(testInfo.workerIndex).toBe(0);
        });

        test.describe('suite2', () => {
          test.use({ foo: 'baz' });
          test('test2', ({ foo }, testInfo) => {
            expect(foo).toBe('baz');
            expect(testInfo.workerIndex).toBe(0);
          });
        });
      });
    `
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should throw when setting worker options in describe', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [undefined, { scope: 'worker' }],
      });
      test.describe('suite', () => {
        test.use({ foo: 'bar' });
        test('test', ({ foo }, testInfo) => {
        });
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain([
    `Cannot use({ foo }) in a describe group, because it forces a new worker.`,
    `Make it top-level in the test file or put in the configuration file.`,
  ].join('\n'));
  expect(result.output).toContain(`{ foo: 'bar' }`);
});

test('should run tests with different worker options', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base } from '@playwright/test';
      export * from '@playwright/test';
      export const test = base.extend({
        foo: [undefined, { scope: 'worker' }],
      });
    `,
    'a.test.ts': `
      import { test, expect } from './helper';
      test('test', ({ foo }, testInfo) => {
        expect(foo).toBe(undefined);
        expect(testInfo.workerIndex).toBe(0);
      });
    `,
    'b.test.ts': `
      import { test, expect } from './helper';
      test.use({ foo: 'bar' });

      test('test1', ({ foo }, testInfo) => {
        expect(foo).toBe('bar');
        expect(testInfo.workerIndex).toBe(1);
      });

      test('test2', ({ foo }, testInfo) => {
        expect(foo).toBe('bar');
        expect(testInfo.workerIndex).toBe(1);
      });
    `,
    'c.test.ts': `
      import { test, expect } from './helper';
      test.use({ foo: 'baz' });
      test('test2', ({ foo }, testInfo) => {
        expect(foo).toBe('baz');
        expect(testInfo.workerIndex).toBe(2);
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
});

test('should use options from the config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base } from '@playwright/test';
      export * from '@playwright/test';
      export const test = base.extend({
        foo: [ 'foo', { option: true } ],
      });
    `,
    'playwright.config.ts': `
      module.exports = { use: { foo: 'bar' } };
    `,
    'a.test.ts': `
      import { test, expect } from './helper';
      test('test1', ({ foo }) => {
        expect(foo).toBe('bar');
      });

      test.describe('suite1', () => {
        test.use({ foo: 'baz' });

        test('test2', ({ foo }) => {
          expect(foo).toBe('baz');
        });
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('test.use() should throw if called from beforeAll ', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(() => {
        test.use({});
      });
      test('should work', async () => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Playwright Test did not expect test.use() to be called here');
});
