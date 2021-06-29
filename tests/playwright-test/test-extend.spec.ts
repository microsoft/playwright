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

      export const base = pwt.test.declare();
      export const test1 = base.extend(createDerivedFixtures('e1'));
      export const test2 = base.extend(createDerivedFixtures('e2'));
    `,
    'playwright.config.ts': `
      import { base } from './helper';

      function createBaseFixtures(suffix) {
        return {
          baseWorker: [async ({}, run) => {
            global.logs.push('beforeAll-' + suffix);
            await run();
            global.logs.push('afterAll-' + suffix);
            if (suffix.includes('base'))
              console.log(global.logs.join('\\n'));
          }, { scope: 'worker' }],

          baseTest: async ({ derivedWorker }, run) => {
            global.logs.push('beforeEach-' + suffix);
            await run();
            global.logs.push('afterEach-' + suffix);
          },
        };
      }

      module.exports = { projects: [
        { define: { test: base, fixtures: createBaseFixtures('base1') } },
        { define: { test: base, fixtures: createBaseFixtures('base2') } },
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

test('test.declare should be inserted at the right place', async ({ runInlineTest }) => {
  const { output, passed } = await runInlineTest({
    'helper.ts': `
      const test1 = pwt.test.extend({
        foo: async ({}, run) => {
          console.log('before-foo');
          await run('foo');
          console.log('after-foo');
        },
      });
      export const test2 = test1.declare<{ bar: string }>();
      export const test3 = test2.extend({
        baz: async ({ bar }, run) => {
          console.log('before-baz');
          await run(bar + 'baz');
          console.log('after-baz');
        },
      });
    `,
    'playwright.config.ts': `
      import { test2 } from './helper';
      const fixtures = {
        bar: async ({ foo }, run) => {
          console.log('before-bar');
          await run(foo + 'bar');
          console.log('after-bar');
        },
      };
      module.exports = {
        define: { test: test2, fixtures },
      };
    `,
    'a.test.js': `
      const { test3 } = require('./helper');
      test3('should work', async ({baz}) => {
        console.log('test-' + baz);
      });
    `,
  });
  expect(passed).toBe(1);
  expect(output).toContain([
    'before-foo',
    'before-bar',
    'before-baz',
    'test-foobarbaz',
    'after-baz',
    'after-bar',
    'after-foo',
  ].join('\n'));
});
