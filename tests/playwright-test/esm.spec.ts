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

// Note: tests from this file are additionally run on Node16 bots.

test('should load nested as esm when package.json has type module', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      //@no-header
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'nested/folder/a.esm.test.js': `
      const { test } = pwt;
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should import esm from ts when package.json has type module in experimental mode', async ({ runInlineTest }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(parseInt(process.version.slice(1), 10) < 16);
  const result = await runInlineTest({
    'playwright.config.ts': `
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'a.test.ts': `
      import { foo } from './b.ts';
      import { bar } from './c.js';
      import { qux } from './d.js';
      const { test } = pwt;
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
        expect(bar).toBe('bar');
        expect(qux).toBe('qux');
      });
    `,
    'b.ts': `
      export const foo: string = 'foo';
    `,
    'c.ts': `
      export const bar: string = 'bar';
    `,
    'd.js': `
      //@no-header
      export const qux = 'qux';
    `,
  }, {});

  expect(result.exitCode).toBe(0);
});

test('should propagate subprocess exit code in experimental mode', async ({ runInlineTest }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(parseInt(process.version.slice(1), 10) < 16);
  const result = await runInlineTest({
    'package.json': JSON.stringify({ type: 'module' }),
    'a.test.ts': `
      const { test } = pwt;
      test('failing test', ({}, testInfo) => {
        expect(1).toBe(2);
      });
    `,
  }, {});

  expect(result.exitCode).toBe(1);
});

test('should respect path resolver in experimental mode', async ({ runInlineTest }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(parseInt(process.version.slice(1), 10) < 16);
  const result = await runInlineTest({
    'package.json': JSON.stringify({ type: 'module' }),
    'playwright.config.ts': `
      export default {
        projects: [{name: 'foo'}],
      };
    `,
    'tsconfig.json': `{
      "compilerOptions": {
        "target": "ES2019",
        "module": "commonjs",
        "lib": ["esnext", "dom", "DOM.Iterable"],
        "baseUrl": ".",
        "paths": {
          "util/*": ["./foo/bar/util/*"],
        },
      },
    }`,
    'a.test.ts': `
      import { foo } from 'util/b.ts';
      const { test } = pwt;
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe(foo);
      });
    `,
    'foo/bar/util/b.ts': `
      export const foo: string = 'foo';
    `,
  }, {});

  expect(result.exitCode).toBe(0);
});
