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
      const test = pwt.test.extend({
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
      export const test = pwt.test.extend({
        foo: 'foo',
      });
    `,
    'a.test.ts': `
      import { test } from './helper';
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

test('should run tests with different worker options', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export const test = pwt.test.extend({
        foo: [undefined, { scope: 'worker' }],
      });
    `,
    'a.test.ts': `
      import { test } from './helper';
      test('test', ({ foo }, testInfo) => {
        expect(foo).toBe(undefined);
        console.log('\\n%%test=' + testInfo.workerIndex);
      });

      test.describe('suite1', () => {
        test.use({ foo: 'bar' });
        test('test1', ({ foo }, testInfo) => {
          expect(foo).toBe('bar');
          console.log('\\n%%test1=' + testInfo.workerIndex);
        });

        test.describe('suite2', () => {
          test.use({ foo: 'baz' });
          test('test2', ({ foo }, testInfo) => {
            expect(foo).toBe('baz');
            console.log('\\n%%test2=' + testInfo.workerIndex);
          });
        });

        test('test3', ({ foo }, testInfo) => {
          expect(foo).toBe('bar');
          console.log('\\n%%test3=' + testInfo.workerIndex);
        });
      });
    `,
    'b.test.ts': `
      import { test } from './helper';
      test.use({ foo: 'qux' });
      test('test4', ({ foo }, testInfo) => {
        expect(foo).toBe('qux');
        console.log('\\n%%test4=' + testInfo.workerIndex);
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);

  const workerIndexMap = new Map();
  const allWorkers = new Set();
  for (const line of result.output.split('\n')) {
    if (line.startsWith('%%')) {
      const [ name, workerIndex ] = line.substring(2).split('=');
      allWorkers.add(workerIndex);
      workerIndexMap.set(name, workerIndex);
    }
  }

  expect(workerIndexMap.size).toBe(5);
  expect(workerIndexMap.get('test1')).toBe(workerIndexMap.get('test3'));
  expect(allWorkers.size).toBe(4);
  for (let i = 0; i < 4; i++)
    expect(allWorkers.has(String(i)));
});

test('should use options from the config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export const test = pwt.test.extend({
        foo: 'foo',
      });
    `,
    'playwright.config.ts': `
      module.exports = { use: { foo: 'bar' } };
    `,
    'a.test.ts': `
      import { test } from './helper';
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
