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

test('test.extend should work', async ({ runInlineTest }) => {
  const { output, passed } = await runInlineTest({
    'helper.ts': `
      global.logs = [];

      function createDerivedFixtures(suffix) {
        return {
          derivedWorker: [async ({ baseWorker }, run) => {
            global.logs.push('beforeAll-' + suffix);
            await run();
            global.logs.push('afterAll-' + suffix);
            if (suffix.includes('base'))
              console.log(global.logs.join('\\n'));
          }, { scope: 'worker' }],

          derivedTest: async ({ baseTest, derivedWorker }, run) => {
            global.logs.push('beforeEach-' + suffix);
            await run();
            global.logs.push('afterEach-' + suffix);
          },
        };
      }

      export const base = pwt.test.extend({
        suffix: ['', { scope: 'worker', option: true } ],
        baseWorker: [async ({ suffix }, run) => {
          global.logs.push('beforeAll-' + suffix);
          await run();
          global.logs.push('afterAll-' + suffix);
          if (suffix.includes('base'))
            console.log(global.logs.join('\\n'));
        }, { scope: 'worker' }],

        baseTest: async ({ suffix, derivedWorker }, run) => {
          global.logs.push('beforeEach-' + suffix);
          await run();
          global.logs.push('afterEach-' + suffix);
        },
      });
      export const test1 = base.extend(createDerivedFixtures('e1'));
      export const test2 = base.extend(createDerivedFixtures('e2'));
    `,
    'playwright.config.ts': `
      module.exports = { projects: [
        { use: { suffix: 'base1' } },
        { use: { suffix: 'base2' } },
      ] };
    `,
    'a.test.ts': `
      import { test1, test2 } from './helper';
      test1('should work 1', async ({ derivedTest }) => {
        global.logs.push('test1');
      });
      test2('should work 2', async ({ derivedTest }) => {
        global.logs.push('test2');
      });
    `,
  });
  expect(passed).toBe(4);
  expect(output).toContain([
    'beforeAll-base1',
    'beforeAll-e1',
    'beforeEach-base1',
    'beforeEach-e1',
    'test1',
    'afterEach-e1',
    'afterEach-base1',
    'afterAll-e1',
    'afterAll-base1',
  ].join('\n'));
  expect(output).toContain([
    'beforeAll-base1',
    'beforeAll-e2',
    'beforeEach-base1',
    'beforeEach-e2',
    'test2',
    'afterEach-e2',
    'afterEach-base1',
    'afterAll-e2',
    'afterAll-base1',
  ].join('\n'));
  expect(output).toContain([
    'beforeAll-base2',
    'beforeAll-e1',
    'beforeEach-base2',
    'beforeEach-e1',
    'test1',
    'afterEach-e1',
    'afterEach-base2',
    'afterAll-e1',
    'afterAll-base2',
  ].join('\n'));
  expect(output).toContain([
    'beforeAll-base2',
    'beforeAll-e2',
    'beforeEach-base2',
    'beforeEach-e2',
    'test2',
    'afterEach-e2',
    'afterEach-base2',
    'afterAll-e2',
    'afterAll-base2',
  ].join('\n'));
});

test('config should override options but not fixtures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { param: 'config' },
      };
    `,
    'a.test.js': `
      const test1 = pwt.test.extend({ param: [ 'default', { option: true } ] });
      test1('default', async ({ param }) => {
        console.log('default-' + param);
      });

      const test2 = test1.extend({
        param: 'extend',
      });
      test2('extend', async ({ param }) => {
        console.log('extend-' + param);
      });

      const test3 = test1.extend({
        param: async ({ param }, use) => {
          await use(param + '-fixture');
        },
      });
      test3('fixture', async ({ param }) => {
        console.log('fixture-' + param);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(result.output).toContain('default-config');
  expect(result.output).toContain('extend-extend');
  expect(result.output).toContain('fixture-config-fixture');
});

test('test.extend should be able to merge', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { param: 'from-config' },
      };
    `,
    'a.test.js': `
      const base = pwt.test.extend({
        myFixture: 'abc',
      });

      const test1 = base
          .extend({
            param: [ 'default', { option: true } ],
            fixture1: ({ param }, use) => use(param + '+fixture1'),
            myFixture: 'override',
          });

      const test2 = base.extend({
        fixture2: ({}, use) => use('fixture2'),
      });

      const test3 = test1._extendTest(test2);

      test3('merged', async ({ param, fixture1, myFixture, fixture2 }) => {
        console.log('param-' + param);
        console.log('fixture1-' + fixture1);
        console.log('myFixture-' + myFixture);
        console.log('fixture2-' + fixture2);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('param-from-config');
  expect(result.output).toContain('fixture1-from-config+fixture1');
  expect(result.output).toContain('myFixture-override');
  expect(result.output).toContain('fixture2-fixture2');
});

test('test.extend should print nice message when used as _extendTest', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test1 = pwt.test.extend({});
      const test2 = pwt.test.extend({});
      const test3 = test1.extend(test2);

      test3('test', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Did you mean to call test._extendTest()?');
});

test('test._extendTest should print nice message when used as extend', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const test3 = pwt.test._extendTest({});
      test3('test', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Did you mean to call test.extend() with fixtures instead?');
});
