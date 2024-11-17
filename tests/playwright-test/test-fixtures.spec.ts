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

test('test() should support fixture in test details', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        input: 'input',
        foo: async ({ input }, use) => {
          await use(input);
        }
      });

      test('test', { fixtures: { input: 'asd' } }, ({ foo }) => {
        expect(foo).toBe('asd');
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('fixtures from the first test should not leak into the second test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        input: 'defaultInput',
        foo: async ({ input }, use) => {
          await use(input);
        }
      });

      test('test1', { fixtures: { input: 'asd' } }, ({ foo }) => {
        expect(foo).toBe('asd');
      });

      test('test2', ({ foo }) => {
        expect(foo).toBe('defaultInput');
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});
