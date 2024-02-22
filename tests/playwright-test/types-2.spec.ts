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
      import { test, expect } from '@playwright/test';
      test.describe('suite', () => {
        test.beforeEach(async () => {});
        test.afterEach(async () => {});
        test.beforeAll(async () => {});
        test.afterAll(async () => {});
        test('my test', async({}, testInfo) => {
          expect(testInfo.title).toBe('my test');
          testInfo.annotations[0].type;
          test.setTimeout(123);
        });
        test.skip('my test', async () => {});
        test.fixme('my test', async () => {});
        test.fail('my test', async () => {});
      });
      test.describe(() => {
        test('my test', () => {});
      });
      test.describe.parallel('suite', () => {});
      test.describe.parallel.only('suite', () => {});
      test.describe.serial('suite', () => {});
      test.describe.serial.only('suite', () => {});
      test.describe.skip('suite', () => {});
      test.describe.fixme('suite', () => {});
      // @ts-expect-error
      test.foo();
      test.describe.configure({ mode: 'parallel' });
      test.describe.configure({ retries: 3, timeout: 123 });
      test('title', { tag: '@foo' }, () => {});
      test('title', { tag: ['@foo', '@bar'] }, () => {});
      test('title', { annotation: { type: 'issue' } }, () => {});
      test('title', { annotation: [{ type: 'issue' }, { type: 'foo', description: 'bar' }] }, () => {});
      test('title', {
        tag: '@foo',
        annotation: { type: 'issue' },
      }, () => {});
      test.skip('title', { tag: '@foo' }, () => {});
      test.fixme('title', { tag: '@foo' }, () => {});
      test.only('title', { tag: '@foo' }, () => {});
      test.fail('title', { tag: '@foo' }, () => {});
      test.describe('title', { tag: '@foo' }, () => {});
      test.describe('title', { annotation: { type: 'issue' } }, () => {});
      // @ts-expect-error
      test.describe({ tag: '@foo' }, () => {});
      test.describe.skip('title', { tag: '@foo' }, () => {});
      test.describe.fixme('title', { tag: '@foo' }, () => {});
      test.describe.only('title', { tag: '@foo' }, () => {});
    `
  });
  expect(result.exitCode).toBe(0);
});

test('can pass sync functions everywhere', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend<{ foo: string }>({
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
      import { test, expect } from '@playwright/test';
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
      import { test as base, expect, mergeTests } from '@playwright/test';
      export type Params = { foo: string };
      export const test = base;
      export const test1 = test.extend<Params>({ foo: [ 'foo', { option: true } ] });
      export const testW = test.extend<{}, { bar: string }>({ bar: ['bar', { scope: 'worker' }] });
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
      export const test4 = mergeTests(test1, testW);
      const test5 = test4.extend<{}, { hey: string, hey2: string }>({
        // @ts-expect-error
        hey: [async ({ foo }, use) => {
          await use(foo);
        }, { scope: 'worker' }],
        hey2: [async ({ bar }, use) => {
          await use(bar);
        }, { scope: 'worker' }],
      });
      export const test6 = test4.extend<{ hey: string }>({
        hey: async ({ foo }, use) => {
          await use(foo);
        },
      });
    `,
    'playwright.config.ts': `
      import { Params } from './helper';
      import { Config } from '@playwright/test';
      const configs: Config<Params>[] = [];

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
      import { test, test1, test2, test3, test4, test6 } from './helper';
      // @ts-expect-error
      test('my test', async ({ foo }) => {});
      test1('my test', async ({ foo }) => {});
      // @ts-expect-error
      test1('my test', async ({ foo, bar }) => {});
      test2('my test', async ({ foo, bar }) => {});
      // @ts-expect-error
      test2('my test', async ({ foo, baz }) => {});
      test4('my test', async ({ foo, bar }) => {});
      // @ts-expect-error
      test4('my test', async ({ foo, qux }) => {});
      test6('my test', async ({ bar, hey }) => {});
      // @ts-expect-error
      test6('my test', async ({ qux }) => {});
    `
  });
  expect(result.exitCode).toBe(0);
});

test('step should inherit return type from its callback ', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('my test', async ({ }) => {
        // @ts-expect-error
        const bad1: string = await test.step('my step', () => {
          return 10;
        });
        // @ts-expect-error
        const bad2: string = await test.step('my step', async () => {
          return 10;
        });
        const good: string = await test.step('my step', async () => {
          return 'foo';
        });
        await test.step('my step', async () => { });
        const good2: string = await test.step('my step', () => 'foo');
      });
    `
  });
  expect(result.exitCode).toBe(0);
});
