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

import { test, expect, stripAnsi } from './playwright-test-fixtures';

test('should print dependencies in CJS mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'helper.ts': `export function foo() {}`,
    'a.test.ts': `
      import './helper';
      pwt.test('passes', () => {});
    `,
    'b.test.ts': `
      import './helper';
      pwt.test('passes', () => {});
    `,
    'globalTeardown.ts': `
      import { fileDependencies } from '@playwright/test/lib/internalsForTest';
      export default () => {
        console.log('###' + JSON.stringify(fileDependencies()) + '###');
      };
    `
  }, {});

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  const output = stripAnsi(result.output);
  const deps = JSON.parse(output.match(/###(.*)###/)![1]);
  expect(deps).toEqual({
    'a.test.ts': ['helper.ts'],
    'b.test.ts': ['helper.ts'],
  });
});

test('should print dependencies in ESM mode', async ({ runInlineTest, nodeVersion }) => {
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({
        globalTeardown: './globalTeardown.ts',
      });
    `,
    'helper.ts': `export function foo() {}`,
    'a.test.ts': `
      import './helper.js';
      pwt.test('passes', () => {});
    `,
    'b.test.ts': `
      import './helper.js';
      pwt.test('passes', () => {});
    `,
    'globalTeardown.ts': `
      import { fileDependencies } from '@playwright/test/lib/internalsForTest';
      export default () => {
        console.log('###' + JSON.stringify(fileDependencies()) + '###');
      };
    `
  }, {});

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  const output = stripAnsi(result.output);
  const deps = JSON.parse(output.match(/###(.*)###/)![1]);
  expect(deps).toEqual({
    'a.test.ts': ['helper.ts'],
    'b.test.ts': ['helper.ts'],
  });
});
