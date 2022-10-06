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

test('should import esm from ts when package.json has type module in experimental mode', async ({ runInlineTest, nodeVersion }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(nodeVersion.major < 16);
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

test('should propagate subprocess exit code in experimental mode', async ({ runInlineTest, nodeVersion }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(nodeVersion.major < 16);
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

test('should respect path resolver in experimental mode', async ({ runInlineTest, nodeVersion }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(nodeVersion.major < 16);
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
      import { foo } from 'util/b.js';
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

test('should use source maps', async ({ runInlineTest, nodeVersion }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15202' });
  // We only support experimental esm mode on Node 16+
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `
      export default { projects: [{name: 'foo'}] };
    `,
    'a.test.ts': `
      const { test } = pwt;

      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  }, { reporter: 'list' });

  const output = stripAnsi(result.output);
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(output).toContain('[foo] › a.test.ts:7:7 › check project name');
});

test('should show the codeframe in errors', async ({ runInlineTest, nodeVersion }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `
      export default { projects: [{name: 'foo'}] };
    `,
    'a.test.ts': `
      const { test } = pwt;

      test('check project name', ({}, testInfo) => {
        expect(1).toBe(2);
        expect(testInfo.project.name).toBe('foo');
      });

      test('foobar', async ({}) => {
        const error = new Error('my-message');
        error.name = 'FooBarError';
        throw error;
      });
    `
  }, { reporter: 'list' }, {
    FORCE_COLOR: '0',
  });

  const output = stripAnsi(result.output);
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(2);
  expect(output, 'error carrot—via source maps—is positioned appropriately').toContain(
      [
        `    >  8 |         expect(1).toBe(2);`,
        `         |                   ^`
      ].join('\n'));
  expect(result.output).toContain('FooBarError: my-message');
  expect(result.output).not.toContain('at a.test.ts');
  expect(result.output).toContain(`  12 |       test('foobar', async ({}) => {`);
  expect(result.output).toContain(`> 13 |         const error = new Error('my-message');`);
  expect(result.output).toContain('     |                       ^');
  expect(result.output).toContain('  14 |         error.name = \'FooBarError\';');
});

test('should filter by line', async ({ runInlineTest, nodeVersion }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15200' });
  // We only support experimental esm mode on Node 16+
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `
      export default { projects: [{name: 'foo'}] };
    `,
    'foo/x.spec.ts': `
      pwt.test('one', () => { expect(1).toBe(2); });
      pwt.test('two', () => { expect(1).toBe(2); });
      pwt.test('three', () => { expect(1).toBe(2); });
      `,
    'foo/y.spec.ts': `pwt.test('fails', () => { expect(1).toBe(2); });`,
  }, undefined, undefined, { additionalArgs: ['x.spec.ts:6'] });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toMatch(/x\.spec\.ts.*two/);
});
