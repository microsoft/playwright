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

test('basics should work', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      const { test } = pwt;
      test.describe('suite', () => {
        test.beforeEach(async () => {});
        test('my test', async({}, testInfo) => {
          expect(testInfo.title).toBe('my test');
          testInfo.annotations[0].type;
        });
      });
      // @ts-expect-error
      test.foo();
    `
  });
  expect(result.exitCode).toBe(0);
});

test('can pass sync functions everywhere', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      const test = pwt.test.extend<{ foo: string }>({
        foo: ({}, use) => use('bar'),
      });
      test.beforeEach(({ foo }) => {});
      test.afterEach(({ foo }) => {});
      test.beforeAll(() => {});
      test.afterAll(() => {});
      test('my test', ({ foo }) => {});
    `
  });
  expect(result.exitCode).toBe(0);
});

test('can return anything from hooks', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      const { test } = pwt;
      test.beforeEach(() => '123');
      test.afterEach(() => 123);
      test.beforeAll(() => [123]);
      test.afterAll(() => ({ a: 123 }));
    `
  });
  expect(result.exitCode).toBe(0);
});

test('test.extend options should check types', async ({ runTSC }) => {
  const result = await runTSC({
    'helper.ts': `
      export type Params = { foo: string };
      export const test = pwt.test;
      export const test1 = test.extend<Params>({ foo: [ 'foo', { option: true } ] });
      export const test1b = test.extend<{ bar: string }>({ bar: [ 'bar', { option: true } ] });
      export const testerror = test.extend<{ foo: string }>({
        // @ts-expect-error
        foo: 123
      });
      export const test2 = test1.extend<{ bar: number }>({
        bar: async ({ foo }, run) => { await run(parseInt(foo)); }
      });
      export const test3 = test1.extend<{ bar: number }>({
        // @ts-expect-error
        bar: async ({ baz }, run) => { await run(42); }
      });
      // TODO: enable when _extendTest is out of experiment.
      // export const test4 = test1._extendTest(test1b);
      export const test4 = test1;
    `,
    'playwright.config.ts': `
      import { Params } from './helper';
      const configs: pwt.Config<Params>[] = [];

      configs.push({});

      configs.push({
        use: { foo: 'bar' },
      });

      configs.push({
        // @ts-expect-error
        use: { foo: true },
      });

      configs.push({
        // @ts-expect-error
        use: { unknown: true },
      });
      module.exports = configs;
    `,
    'a.spec.ts': `
      import { test, test1, test2, test3, test4 } from './helper';
      // @ts-expect-error
      test('my test', async ({ foo }) => {});
      test1('my test', async ({ foo }) => {});
      // @ts-expect-error
      test1('my test', async ({ foo, bar }) => {});
      test2('my test', async ({ foo, bar }) => {});
      // @ts-expect-error
      test2('my test', async ({ foo, baz }) => {});
      // TODO: enable when _extendTest is out of experiment.
      // test4('my test', async ({ foo, bar }) => {});
    `
  });
  expect(result.exitCode).toBe(0);
});
