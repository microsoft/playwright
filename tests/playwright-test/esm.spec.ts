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

import { test, expect, playwrightCtConfigText } from './playwright-test-fixtures';

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

test('should support import attributes', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import packageJSON from './package.json' with { type: 'json' };
      console.log('imported value (config): ' + packageJSON.foo);
      export default { };
    `,
    'package.json': JSON.stringify({ type: 'module', foo: 'bar' }),
    'a.test.ts': `
      import config from './package.json' with { type: 'json' };
      console.log('imported value (test): ' + config.foo);
      import { test, expect } from '@playwright/test';
      test('pass', async () => {});
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.stdout).toContain('imported value (config): bar');
  expect(result.stdout).toContain('imported value (test): bar');
});

test('should import esm from ts when package.json has type module in experimental mode', async ({ runInlineTest }) => {
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

test('should propagate subprocess exit code in experimental mode', async ({ runInlineTest }) => {
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

test('should respect path resolver in experimental mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': JSON.stringify({ type: 'module' }),
    'playwright.config.ts': `
      // Make sure that config can use the path mapping.
      import { foo } from 'util/b.js';
      export default {
        projects: [{ name: foo }],
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
        expect(testInfo.project.name).toBe('foo');
        expect(foo).toBe('foo');
      });
    `,
    'foo/bar/util/b.ts': `
      export const foo: string = 'foo';
    `,
  }, {});

  expect(result.exitCode).toBe(0);
});

test('should use source maps', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15202' });
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

test('should use source maps when importing a file throws an error', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29418' });

  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `
      export default {};
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      throw new Error('Oh my!');
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Error: Oh my!

   at a.test.ts:4

  2 |       import { test, expect } from '@playwright/test';
  3 |
> 4 |       throw new Error('Oh my!');
    |             ^
  `);
});

test('should show the codeframe in errors', async ({ runInlineTest }) => {
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

test('should filter by line', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15200' });
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

test('should resolve directory import to index.js file in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils/index.js': `
      export function gimmeAOne() {
        return 1;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve directory import to index.ts file in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils/index.ts': `
      export function gimmeAOne() {
        return 1;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve directory import to index.tsx file in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils/index.tsx': `
      export function gimmeAOne() {
        return 1;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve directory import to index.mjs file in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils/index.mjs': `
      export function gimmeAOne() {
        return 1;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve directory import to index.jsx file in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils/index.jsx': `
      export function gimmeAOne() {
        return 1;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve file import before directory import in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils.js': `
      export function gimmeAOne() {
        return 1;
      }
    `,
    'playwright-utils/index.js': `
      export function gimmeAOne() {
        // intentionally return the wrong thing because this file shouldn't be resolved.
        return 2;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve .js import to .ts file in ESM mode', async ({ runInlineTest }) => {
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

test('should resolve .js import to .tsx file in ESM mode', async ({ runInlineTest }) => {
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

test('should resolve .js import to .jsx file in ESM mode', async ({ runInlineTest }) => {
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
    'playwright-utils.jsx': `
      export function gimmeAOne() {
        return 1;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve no-extension import to .ts file in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
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

test('should resolve no-extension import to .tsx file in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
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

test('should resolve no-extension import to .jsx file in ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default { projects: [{name: 'foo'}] };`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils.jsx': `
      export function gimmeAOne() {
        return 1;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve .js import to .tsx file in ESM mode for components', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': playwrightCtConfigText,
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

test('should load cjs config and test in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.cjs': `
      const fs = require('fs');
      module.exports = { projects: [{name: 'foo'}] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `,
    'b.spec.cjs': `
      const { test, expect } = require('@playwright/test');
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should allow ESM when config is cjs', async ({ runInlineTest, nodeVersion }) => {
  test.skip(nodeVersion.major < 18, 'ESM loader is enabled conditionally with older API');

  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'playwright.config.cjs': `
      const fs = require('fs');
      module.exports = { projects: [{name: 'foo'}] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should load mts without config', async ({ runInlineTest, nodeVersion }) => {
  test.skip(nodeVersion.major < 18, 'ESM loader is enabled conditionally with older API');

  const result = await runInlineTest({
    'a.test.mts': `
      import { test, expect } from '@playwright/test';
      test('check project name', ({}, testInfo) => {
        expect(true).toBe(true);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should load type module without config', async ({ runInlineTest, nodeVersion }) => {
  test.skip(nodeVersion.major < 18, 'ESM loader is enabled conditionally with older API');

  const result = await runInlineTest({
    'package.json': `{ "type": "module" }`,
    'helper.js': `
      const foo = 42;
      export default foo;
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import foo from './helper.js';
      test('check project name', ({}, testInfo) => {
        expect(foo).toBe(42);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should be able to use use execSync with a Node.js file inside a spec', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/24516' });
  const result = await runInlineTest({
    'global-setup.ts': `
      import { execSync, spawnSync, fork } from 'child_process';
      console.log('%%global-setup import level');
      console.log('%%execSync: ' + execSync('node hello.js').toString());
      console.log('%%spawnSync: ' + spawnSync('node', ['hello.js']).stdout.toString());
      export default async () => {
        console.log('%%global-setup export level');
        console.log('%%execSync: ' + execSync('node hello.js').toString());
        console.log('%%spawnSync: ' + spawnSync('node', ['hello.js']).stdout.toString());
        const child = fork('hellofork.js');
        child.on('message', (m) => console.log('%%fork: ' + m));
        await new Promise((resolve) => child.on('exit', (code) => resolve(code)));
      }
    `,
    'global-teardown.ts': `
      import { execSync, spawnSync, fork } from 'child_process';
      console.log('%%global-teardown import level');
      console.log('%%execSync: ' + execSync('node hello.js').toString());
      console.log('%%spawnSync: ' + spawnSync('node', ['hello.js']).stdout.toString());
      export default async () => {
        console.log('%%global-teardown export level');
        console.log('%%execSync: ' + execSync('node hello.js').toString());
        console.log('%%spawnSync: ' + spawnSync('node', ['hello.js']).stdout.toString());
        const child = fork('hellofork.js');
        child.on('message', (m) => console.log('%%fork: ' + m));
        await new Promise((resolve) => child.on('exit', (code) => resolve(code)));
      }
    `,
    'package.json': `{ "type": "module" }`,
    'playwright.config.ts': `export default {
      projects: [{name: 'foo'}],
      globalSetup: './global-setup.ts',
      globalTeardown: './global-teardown.ts',
    };`,
    'hello.js': `console.log('hello from hello.js');`,
    'hellofork.js': `process.send('hello from hellofork.js');`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { execSync, spawnSync, fork } from 'child_process';
      console.log('%%inside test file');
      console.log('%%execSync: ' + execSync('node hello.js').toString());
      console.log('%%spawnSync: ' + spawnSync('node', ['hello.js']).stdout.toString());
      test('check project name', async ({}) => {
        console.log('%%inside test');
        console.log('%%execSync: ' + execSync('node hello.js').toString());
        console.log('%%spawnSync: ' + spawnSync('node', ['hello.js']).stdout.toString());
        const child = fork('hellofork.js');
        child.on('message', (m) => console.log('%%fork: ' + m));
        await new Promise((resolve) => child.on('exit', (code) => resolve(code)));
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toEqual([
    'global-setup import level',
    'execSync: hello from hello.js',
    'spawnSync: hello from hello.js',
    'global-teardown import level',
    'execSync: hello from hello.js',
    'spawnSync: hello from hello.js',
    'global-setup export level',
    'execSync: hello from hello.js',
    'spawnSync: hello from hello.js',
    'fork: hello from hellofork.js',
    'inside test file',
    'execSync: hello from hello.js',
    'spawnSync: hello from hello.js',
    'inside test file',
    'execSync: hello from hello.js',
    'spawnSync: hello from hello.js',
    'inside test',
    'execSync: hello from hello.js',
    'spawnSync: hello from hello.js',
    'fork: hello from hellofork.js',
    'global-teardown export level',
    'execSync: hello from hello.js',
    'spawnSync: hello from hello.js',
    'fork: hello from hellofork.js',
  ]);
});

test('should be able to use mergeTests/mergeExpect', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.mjs': `
      import { test as base, expect as baseExpect, mergeTests, mergeExpects } from '@playwright/test';
      const test = mergeTests(
        base.extend({
          myFixture1: '1',
        }),
        base.extend({
          myFixture2: '2',
        }),
      );

      const expect = mergeExpects(
        baseExpect.extend({
          async toBeFoo1(page, x) {
            return { pass: true, message: () => '' };
          }
        }),
        baseExpect.extend({
          async toBeFoo2(page, x) {
            return { pass: true, message: () => '' };
          }
        }),
      );

      test('merged', async ({ myFixture1, myFixture2 }) => {
        console.log('%%myFixture1: ' + myFixture1);
        console.log('%%myFixture2: ' + myFixture2);
        await expect(1).toBeFoo1();
        await expect(1).toBeFoo2();
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.outputLines).toContain('myFixture1: 1');
  expect(result.outputLines).toContain('myFixture2: 2');
});

test('should exit after merge-reports', async ({ runInlineTest, mergeReports }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/28699' });
  const result = await runInlineTest({
    'merge.config.ts': `
      export default { reporter: 'line' };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'nested/folder/a.esm.test.js': `
      import { test, expect } from '@playwright/test';
      test('test 1', ({}, testInfo) => {});
    `
  }, undefined, undefined, { additionalArgs: ['--reporter', 'blob'] });
  expect(result.exitCode).toBe(0);
  const { exitCode } = await mergeReports(test.info().outputPath('blob-report'), undefined, { additionalArgs: ['-c', 'merge.config.ts'] });
  expect(exitCode).toBe(0);
});
