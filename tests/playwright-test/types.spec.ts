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

test('sanity', async ({runTSC}) => {
  const result = await runTSC({
    'a.spec.ts': `
      const { test } = pwt;
      // @ts-expect-error
      test.foo();
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should check types of fixtures', async ({runTSC}) => {
  const result = await runTSC({
    'helper.ts': `
      export type MyOptions = { foo: string, bar: number };
      export const test = pwt.test.extend<{ foo: string }, { bar: number }>({
        foo: 'foo',
        bar: [ 42, { scope: 'worker' } ],
      });

      const good1 = test.extend<{}>({ foo: async ({ bar }, run) => run('foo') });
      const good2 = test.extend<{}>({ bar: ({}, run) => run(42) });
      const good3 = test.extend<{}>({ bar: ({}, run) => run(42) });
      const good4 = test.extend<{}>({ bar: async ({ bar }, run) => run(42) });
      const good5 = test.extend<{}>({ foo: async ({ foo }, run) => run('foo') });
      const good6 = test.extend<{ baz: boolean }>({
        baz: false,
        foo: async ({ baz }, run) => run('foo')
      });
      const good7 = test.extend<{ baz: boolean }>({
        baz: [ false, { auto: true } ],
      });

      // @ts-expect-error
      const fail1 = test.extend<{}>({ foo: 42 });
      // @ts-expect-error
      const fail2 = test.extend<{}>({ bar: async ({ foo }, run) => run(42) });
      // @ts-expect-error
      const fail3 = test.extend<{}>({ baz: 42 });
      // @ts-expect-error
      const fail4 = test.extend<{}>({ foo: async ({ foo }, run) => run(42) });
      // @ts-expect-error
      const fail5 = test.extend<{}>({ bar: async ({}, run) => run('foo') });
      const fail6 = test.extend<{ baz: boolean }>({
        // @ts-expect-error
        baz: [ true, { scope: 'worker' } ],
      });
      const fail7 = test.extend<{}, { baz: boolean }>({
        // @ts-expect-error
        baz: [ true, { scope: 'test' } ],
      });
      const fail8 = test.extend<{}, { baz: boolean }>({
        // @ts-expect-error
        baz: true,
      });
    `,
    'playwright.config.ts': `
      import { MyOptions } from './helper';
      const configs1: pwt.Config[] = [];
      configs1.push({ use: { foo: '42', bar: 42 } });
      configs1.push({ use: { foo: '42', bar: 42 }, timeout: 100 });

      const configs2: pwt.Config<MyOptions>[] = [];
      configs2.push({ use: { foo: '42', bar: 42 } });
      // @ts-expect-error
      pwt.runTests({ use: { foo: '42', bar: 42 } }, {});
      // @ts-expect-error
      configs2.push({ use: { bar: '42' } });
      // @ts-expect-error
      configs2.push(new Env2());
      // @ts-expect-error
      configs2.push({ use: { foo: 42, bar: 42 } });
      // @ts-expect-error
      configs2.push({ beforeAll: async () => { return {}; } });
      // TODO: next line should not compile.
      configs2.push({ timeout: 100 });
      // @ts-expect-error
      configs2.push('alias');
      // TODO: next line should not compile.
      configs2.push({});
    `,
    'a.spec.ts': `
      import { test } from './helper';
      test.use({ foo: 'foo' });
      test.use({});

      // @ts-expect-error
      test.use({ foo: 42 });
      // @ts-expect-error
      test.use({ baz: 'baz' });

      test('my test', async ({ foo, bar }) => {
        bar += parseInt(foo);
      });
      test('my test', ({ foo, bar }) => {
        bar += parseInt(foo);
      });
      test('my test', () => {});
      // @ts-expect-error
      test('my test', async ({ a }) => {
      });

      // @ts-expect-error
      test.beforeEach(async ({ a }) => {});
      test.beforeEach(async ({ foo, bar }) => {});
      test.beforeEach(() => {});

      // @ts-expect-error
      test.beforeAll(async ({ a }) => {});
      // @ts-expect-error
      test.beforeAll(async ({ foo, bar }) => {});
      test.beforeAll(async ({ bar }) => {});
      test.beforeAll(() => {});

      // @ts-expect-error
      test.afterEach(async ({ a }) => {});
      test.afterEach(async ({ foo, bar }) => {});
      test.afterEach(() => {});

      // @ts-expect-error
      test.afterAll(async ({ a }) => {});
      // @ts-expect-error
      test.afterAll(async ({ foo, bar }) => {});
      test.afterAll(async ({ bar }) => {});
      test.afterAll(() => {});
    `
  });
  expect(result.exitCode).toBe(0);
});

test('config should allow void/empty options', async ({runTSC}) => {
  const result = await runTSC({
    'playwright.config.ts': `
      const configs: pwt.Config[] = [];
      configs.push({});
      configs.push({ timeout: 100 });
      configs.push();
      configs.push({ use: { foo: 42 }});
    `,
    'a.spec.ts': `
      const { test } = pwt;
      test('my test', async () => {
      });
    `
  });
  expect(result.exitCode).toBe(0);
});
