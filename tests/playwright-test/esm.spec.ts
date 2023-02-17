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

test('should load nested as esm when package.json has type module', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'nested/folder/a.esm.test.js': `
      import { test, expect } from '@playwright/test';
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should support import assertions', async ({ runInlineTest, nodeVersion }) => {
  // We only support experimental esm mode on Node 16+
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'playwright.config.ts': `
      import packageJSON from './package.json' assert { type: 'json' };
      export default { };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'a.esm.test.ts': `
      import { test, expect } from '@playwright/test';

      test('check project name', ({}, testInfo) => {
        expect(1).toBe(1);
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
      import { test, expect } from '@playwright/test';
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
      import { test, expect } from '@playwright/test';
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
      import { test, expect } from '@playwright/test';
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
      import { test, expect } from '@playwright/test';

      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  }, { reporter: 'list' });

  const output = result.output;
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(output).toContain('[foo] › a.test.ts:4:7 › check project name');
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
      import { test, expect } from '@playwright/test';

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

  const output = result.output;
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(2);
  expect(output, 'error carrot—via source maps—is positioned appropriately').toContain(
      [
        `    > 5 |         expect(1).toBe(2);`,
        `        |                   ^`
      ].join('\n'));
  expect(result.output).toContain('FooBarError: my-message');
  expect(result.output).not.toContain('at a.test.ts');
  expect(result.output).toContain(`   9 |       test('foobar', async ({}) => {`);
  expect(result.output).toContain(`> 10 |         const error = new Error('my-message');`);
  expect(result.output).toContain('     |                       ^');
  expect(result.output).toContain('  11 |         error.name = \'FooBarError\';');
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
      import { test, expect } from '@playwright/test';
      test('one', () => { expect(1).toBe(2); });
      test('two', () => { expect(1).toBe(2); });
      test('three', () => { expect(1).toBe(2); });
    `,
    'foo/y.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', () => { expect(1).toBe(2); });
    `,
  }, undefined, undefined, { additionalArgs: ['x.spec.ts:4'] });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toMatch(/x\.spec\.ts.*two/);
});

test('should resolve .js import to .ts file in ESM mode', async ({ runInlineTest, nodeVersion }) => {
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils.js';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils.ts': `
      export function gimmeAOne() {
        return 1;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve .js import to .tsx file in ESM mode', async ({ runInlineTest, nodeVersion }) => {
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils.js';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils.tsx': `
      export function gimmeAOne() {
        return 1;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve .js import to .tsx file in ESM mode for components', async ({ runInlineTest, nodeVersion }) => {
  test.skip(nodeVersion.major < 16);
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/experimental-ct-react';
      export default defineConfig({ projects: [{name: 'foo'}] });
    `,
    'playwright/index.html': `<script type="module" src="./index.ts"></script>`,
    'playwright/index.ts': ``,

    'src/button.tsx': `
      export const Button = () => <button>Button</button>;
    `,

    'src/test.spec.tsx': `
      import { test, expect } from '@playwright/experimental-ct-react';
      import { Button } from './button.js';
      test('pass', async ({ mount }) => {
        await mount(<Button></Button>);
      });
    `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});
