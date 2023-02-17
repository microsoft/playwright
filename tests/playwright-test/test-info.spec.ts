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

test('should work directly', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('test 1', async ({}, testInfo) => {
        expect(testInfo.title).toBe('test 1');
      });
      test('test 2', async ({}, testInfo) => {
        expect(testInfo.title).toBe('test 2');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should work via fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base } from '@playwright/test';
      export * from '@playwright/test';
      export const test = base.extend({
        title: async ({}, run, testInfo) => {
          await run(testInfo.title);
        },
      });
    `,
    'a.test.js': `
      const { test, expect } = require('./helper');
      test('test 1', async ({title}) => {
        expect(title).toBe('test 1');
      });
      test('test 2', async ({title}) => {
        expect(title).toBe('test 2');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should work via test.info', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base } from '@playwright/test';
      export * from '@playwright/test';
      export const test = base.extend({
        title: async ({}, run) => {
          await run(base.info().title);
        },
      });
    `,
    'a.test.js': `
      const { test, expect } = require('./helper');
      test('test 1', async ({title}) => {
        expect(test.info().title).toBe('test 1');
        expect(title).toBe('test 1');
      });
      test('test 2', async ({title}) => {
        expect(title).toBe('test 2');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
});

test('should throw outside test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test.info();
      test('test 1', async ({title}) => {});
    `,
  });
  const output = result.output;
  expect(result.exitCode).toBe(1);
  expect(output).toContain('test.info() can only be called while test is running');
});
