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
      import { test, expect } from '@playwright/test';
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

      export const base = test.extend({
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
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test1 = base.extend({ param: [ 'default', { option: true } ] });
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

test('mergeTests should be able to merge', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { param: 'from-config' },
      };
    `,
    'a.test.ts': `
      import { test, expect, mergeTests } from '@playwright/test';
      const base = test.extend({
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

      const test3 = mergeTests(test1, test2);

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

test('test.extend should print nice message when used as mergeTests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test1 = base.extend({});
      const test2 = base.extend({});
      const test3 = test1.extend(test2);

      test3('test', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Did you mean to call mergeTests()?');
});

test('mergeTests should print nice message when used as extend', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect, mergeTests } from '@playwright/test';
      const test3 = mergeTests(base, {});
      test3('test', () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Did you mean to call test.extend() with fixtures instead?');
});

test('test.use() with undefined should not be ignored', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { option1: 'config' },
      };
    `,
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        option1: [ 'default', { option: true } ],
        option2: [ 'default', { option: true } ],
      });
      test('test1', async ({ option1, option2 }) => {
        console.log('test1: option1=' + option1);
        console.log('test1: option2=' + option2);
      });

      test.describe('', () => {
        test.use({ option1: 'foo', option2: 'foo' });
        test('test2', async ({ option1, option2 }) => {
          console.log('test2: option1=' + option1);
          console.log('test2: option2=' + option2);
        });

        test.describe('', () => {
          test.use({ option1: undefined, option2: undefined });
          test('test3', async ({ option1, option2 }) => {
            console.log('test3: option1=' + option1);
            console.log('test3: option2=' + option2);
          });
        });
      });

      test.extend({ option1: undefined, option2: undefined })('test4', async ({ option1, option2 }) => {
        console.log('test4: option1=' + option1);
        console.log('test4: option2=' + option2);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(result.output).toContain('test1: option1=config');
  expect(result.output).toContain('test1: option2=default');
  expect(result.output).toContain('test2: option1=foo');
  expect(result.output).toContain('test2: option2=foo');
  expect(result.output).toContain('test3: option1=config');
  expect(result.output).toContain('test3: option2=default');
  expect(result.output).toContain('test4: option1=config');
  expect(result.output).toContain('test4: option2=default');
});

test('undefined values in config and test.use should be reverted to default', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: { option1: undefined, option2: undefined },
      };
    `,
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        option1: [ 'default1', { option: true } ],
        option2: [ 'default2', { option: true } ],
        option3: [ 'default3', { option: true } ],
      });
      test.use({ option2: undefined, option3: undefined });
      test('my test', async ({ option1, option2, option3 }) => {
        console.log('option1=' + option1);
        console.log('option2=' + option2);
        console.log('option3=' + option3);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('option1=default1');
  expect(result.output).toContain('option2=default2');
  expect(result.output).toContain('option3=default3');
});
