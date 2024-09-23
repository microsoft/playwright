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
import path from 'path';

test('should return the location of a syntax error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'error.spec.js': `
      const x = {
        foo: 'bar';
      };
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('error.spec.js');
  expect(result.output).toContain('(3:18)');
});

test('should return the location of a syntax error with deep stack', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'error.ts': `
      const x = {
        foo: 'bar';
      };
    `,
    'qux.ts': `
      import { error } from './error';
      export function qux() { error() }
    `,
    'baz.ts': `
      import { qux } from './qux';
      export function baz() { qux() }
    `,
    'bar.ts': `
      import { baz } from './baz';
      export function bar() { baz() }
    `,
    'foo.ts': `
      import { bar } from './bar';
      export function foo() { bar() }
    `,
    'test.spec.ts': `
      import { foo } from './foo';
      foo();
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('qux.ts:2:7');
  expect(result.output).toContain('baz.ts:2:7');
  expect(result.output).toContain('bar.ts:2:7');
  expect(result.output).toContain('foo.ts:2:7');
  expect(result.output).toContain('test.spec.ts:2:7');
});

test('should print an improper error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'error.spec.js': `
      throw 123;
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('123');
});

test('should print a null error', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'error.spec.js': `
      throw null;
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('null');
});

test('should return the location of a syntax error in typescript', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'error.spec.ts': `
      const x = {
        foo: 'bar';
      };
    `
  }, {}, {
    FORCE_COLOR: '0'
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('error.spec.ts');
  expect(result.output).toContain(`'bar';`);
});

test('should allow export default form the config file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { timeout: 1000 };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fails', async ({}, testInfo) => {
        await new Promise(f => setTimeout(f, 2000));
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Test timeout of 1000ms exceeded.');
});

test('should validate configuration object', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { timeout: '1000' };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('works', () => {});
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('playwright.config.ts: config.timeout must be a non-negative number');
});

test('should match tests well', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('works', () => {});
    `,
    'hello.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('works', () => {});
    `,
    'strange.....spec.ts': `
      import { test, expect } from '@playwright/test';
      test('works', () => {});
    `,
    'badspec.ts': `
      import { test, expect } from '@playwright/test';
      test('bad', () => { throw new Error('badspec.ts')});
    `,
    'specspec.ts': `
      import { test, expect } from '@playwright/test';
      test('bad', () => { throw new Error('specspec.ts')});
    `,
    'a.testtest.ts': `
      import { test, expect } from '@playwright/test';
      test('bad', () => { throw new Error('a.testtest.ts')});
    `,
    'b.testspec.ts': `
      import { test, expect } from '@playwright/test';
      test('bad', () => { throw new Error('b.testspec.ts')});
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should load an mjs file', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'a.spec.mjs': `
        import { test, expect } from '@playwright/test';
        test('succeeds', () => {
          expect(1 + 1).toBe(2);
        });
      `
  });
  expect(passed).toBe(1);
  expect(exitCode).toBe(0);
});

test('should allow using import', async ({ runInlineTest }) => {
  const { exitCode } = await runInlineTest({
    'a.spec.js': `
        import fs from 'fs';
        import { test, expect } from '@playwright/test';
        test('succeeds', () => {
          expect(1 + 1).toBe(2);
        });
      `
  });
  expect(exitCode).toBe(0);
});

test('should load esm when package.json has type module', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'a.esm.test.js': `
      import { test, expect } from '@playwright/test';
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should load mjs config file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.mjs': `
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should load mts config file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.mts': `
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should load ts from esm when package.json has type module', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      import { bar } from './bar.js';
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `,
    'bar.ts': `
      import { foo } from './foo.js';
      export const bar = foo;
    `,
    'foo.ts': `
      export const foo: string = 'foo';
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).not.toContain(`is an experimental feature`);
});

test('should filter stack trace for simple expect', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', () => {
        test.expect(1+1).toEqual(3);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).not.toContain(path.sep + `playwright-test`);
  expect(result.output).not.toContain(path.sep + `playwright-core`);
  expect(result.output).not.toContain('internal');
});

test('should filter stack trace for web-first assertions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({page}) => {
        await expect(page.locator('x-foo'), 'x-foo must be visible').toBeVisible({timeout: 1});
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).not.toContain(path.sep + `playwright-test`);
  expect(result.output).not.toContain(path.sep + `playwright-core`);
  expect(result.output).not.toContain('internal');
});

test('should filter out event emitter from stack traces', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      const EventEmitter = require('events');
      test('should work', async ({}) => {
        const emitter = new EventEmitter();
        emitter.on('event', function handle() { expect(1).toBe(2); });
        emitter.emit('event');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  const outputWithoutGoodStackFrames = result.output.split('\n').filter(line => !line.includes(testInfo.outputPath())).join('\n');
  expect(outputWithoutGoodStackFrames).not.toContain('EventEmitter.emit');
});

test('should filter out syntax error stack traces', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', ({}) => {
        // syntax error: cannot have await in non-async function
        await Promise.resolve();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).not.toContain('babel');
  expect(result.output).not.toContain('    at ');
});

test('should filter stack trace for raw errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({}) => {
        throw new Error('foobar!');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('foobar!');
  expect(result.output).not.toContain(path.sep + `playwright-test`);
  expect(result.output).not.toContain(path.sep + `playwright-core`);
  expect(result.output).not.toContain('internal');
});

test('should not filter out POM', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export function foo() {
        throw new Error('foo');
      }
    `,
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      const { foo } = require('./helper');
      test('should work', ({}) => {
        foo();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('foo');
  expect(result.output).toContain('helper.ts');
  expect(result.output).toContain('expect-test.spec.ts');
  expect(result.output).not.toContain(path.sep + `playwright-test`);
  expect(result.output).not.toContain(path.sep + `playwright-core`);
  expect(result.output).not.toContain('internal');
});

test('should work with cross-imports - 1', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'test1.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test 1', async ({}) => {
        await new Promise(x => setTimeout(x, 500));
        console.log('running TEST-1');
      });
    `,
    'test2.spec.ts': `
      import * as _ from './test1.spec';
      import { test, expect } from '@playwright/test';
      test('test 2', async ({}) => {
        await new Promise(x => setTimeout(x, 500));
        console.log('running TEST-2');
      });
    `
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('TEST-1');
  expect(result.output).toContain('TEST-2');
});

test('should work with cross-imports - 2', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'test1.spec.ts': `
      import { test, expect } from '@playwright/test';
      import * as _ from './test2.spec';
      test('test 1', async ({}) => {
        await new Promise(x => setTimeout(x, 500));
        console.log('running TEST-1');
      });
    `,
    'test2.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('test 2', async ({}) => {
        await new Promise(x => setTimeout(x, 500));
        console.log('running TEST-2');
      });
    `
  }, { workers: 2, reporter: 'list' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(0);
  expect(result.output).toContain('TEST-1');
  expect(result.output).toContain('TEST-2');
});

test('should load web server w/o esm loader in esm module', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        webServer: {
          command: 'node ws.js',
          port: 9876,
          timeout: 5000,
        },
        projects: [{name: 'foo'}]
      }`,
    'package.json': `{ "type": "module" }`,
    'ws.js': `
      console.log('NODE_OPTIONS ' + process.env.NODE_OPTIONS);
      setTimeout(() => {}, 100000);
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('passes', () => {});
    `
  }, {}, { DEBUG: 'pw:webserver' });

  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('NODE_OPTIONS undefined');
});

test('should load a jsx/tsx files', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'a.spec.tsx': `
      import { test, expect } from '@playwright/test';
      const component = () => <div></div>;
      test('succeeds', () => {
        expect(1 + 1).toBe(2);
      });
    `,
    'b.spec.jsx': `
      import { test, expect } from '@playwright/test';
      const component = () => <div></div>;
      test('succeeds', () => {
        expect(1 + 1).toBe(2);
      });
    `
  });
  expect(passed).toBe(2);
  expect(exitCode).toBe(0);
});

test('should load a jsx/tsx files in ESM mode', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'package.json': JSON.stringify({
      type: 'module'
    }),
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({ projects: [{name: 'foo'}] });
    `,
    'a.spec.tsx': `
      import { test, expect } from '@playwright/test';
      const component = () => <div></div>;
      test('succeeds', () => {
        expect(1 + 1).toBe(2);
      });
    `,
    'b.spec.jsx': `
      import { test, expect } from '@playwright/test';
      const component = () => <div></div>;
      test('succeeds', () => {
        expect(1 + 1).toBe(2);
      });
    `
  });
  expect(passed).toBe(2);
  expect(exitCode).toBe(0);
});

test('should load jsx with top-level component', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'a.spec.tsx': `
      import { test, expect } from '@playwright/test';
      const component = <div>Hello <span>world</span></div>;
      test('succeeds', () => {
        expect(component).toEqual({
          __pw_type: 'jsx',
          type: 'div',
          props: {
            children: [
              'Hello ',
              {
                __pw_type: 'jsx',
                type: 'span',
                props: {
                  children: 'world'
                },
              }
            ]
          },
        });
      });
    `,
  });
  expect(passed).toBe(1);
  expect(exitCode).toBe(0);
});

test('should load a jsx/tsx files with fragments', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'helper.tsx': `
      export const component = () => <><div></div></>;
      export function add(a: number, b: number) {
        return a + b;
      }
    `,
    'helper2.jsx': `
      const component = () => <><div></div></>;
      function add(a, b) {
        return a + b;
      }
      module.exports = { add, component }
    `,
    'a.spec.ts': `
      import { add } from './helper';
      import { test, expect } from '@playwright/test';
      test('succeeds', () => {
        expect(add(1, 1)).toBe(2);
      });
    `,
    'b.spec.js': `
      const { add } = require('./helper2');
      import { test, expect } from '@playwright/test';
      test('succeeds', () => {
        expect(add(1, 1)).toBe(2);
      });
    `
  });
  expect(passed).toBe(2);
  expect(exitCode).toBe(0);
});

test('should remove type imports from ts', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { Point } from 'helper';
      const p: Point = {};

      import { test, expect } from '@playwright/test';
      test('pass', ({}) => {});
    `,
    'node_modules/helper/index.d.ts': `
      export type Point = {};
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve directory import to index.js file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should resolve directory import to index.ts file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should resolve directory import to index.tsx file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should resolve directory import to index.mjs file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should resolve directory import to index.jsx file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should resolve file import before directory import in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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
    'playwright-utils/index.jsx': `
      export function gimmeAOne() {
        // intentionally return the wrong thing because this file shouldn't be resolved.
        return 2;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve .js import to .ts file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should resolve .js import to .tsx file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should resolve .js import to .tsx file in non-ESM mode for components', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should import export assignment from ts', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import number from './utils.js';
      test('pass', () => {
        expect(number).toBe(1);
      });
    `,
    'utils.ts': `
      export = 1;
    `
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should resolve no-extension import to .ts file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should resolve no-extension import to .tsx file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should resolve no-extension import to .jsx file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
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

test('should not resolve .mjs import to .ts file in non-ESM mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils.mjs';
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
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`Cannot find module './playwright-utils.mjs'`);
});

test('should resolve absolute .js import to .ts file', async ({ runInlineTest }) => {
  const filePath = test.info().outputPath('playwright-utils.js');
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from ${JSON.stringify(filePath)};
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

test('should resolve no-extension import of module into .ts file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'node_modules/playwright-utils/index.js': `
      exports.foo = 42;
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { gimmeAOne } from './playwright-utils';
      test('pass', ({}) => {
        expect(gimmeAOne()).toBe(1);
      });
    `,
    'playwright-utils.ts': `
      import { foo } from 'playwright-utils';
      export function gimmeAOne() {
        return foo - 41;
      }
    `,
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should support node imports', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': 'export default {}',
    'package.json': JSON.stringify({
      type: 'module'
    }),
    'test.json': 'test data',
    'utils.mjs': `
      import fs from "node:fs/promises";

      export async function utilityModuleThatImportsNodeModule() {
        return await fs.readFile('test.json', 'utf8');
      }
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { utilityModuleThatImportsNodeModule } from './utils.mjs';

      test('pass', async () => {
        expect(await utilityModuleThatImportsNodeModule()).toBe('test data');
      });
    `
  });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should complain when one test file imports another', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      import { foo } from './b.test';

      test('pass1', async () => {
        expect(foo).toBe('foo');
      });
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      export const foo = 'foo';

      test('pass2', async () => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`test file "a.test.ts" should not import test file "b.test.ts"`);
});

test('should support dynamic imports and requires of js, ts from js, ts and cjs', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      const foo: string = 'foo';
      module.exports.foo = foo;
    `,
    'helper2.ts': `
      module.exports.bar = 'bar';
    `,
    'helper3.js': `
      module.exports.baz = 'baz';
    `,
    'helper4.ts': `
      const foo: string = 'foo';
      module.exports.foo = foo;
    `,
    'passthrough.cjs': `
      module.exports.load = () => import('./helper2');
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('pass', async () => {
        const { foo } = await import('./helper');
        expect(foo).toBe('foo');

        const { baz } = await import('./helper3');
        expect(baz).toBe('baz');
      });
    `,
    'b.test.ts': `
      import { test, expect } from '@playwright/test';
      import { load } from './passthrough.cjs';

      test('pass', async () => {
        const { foo } = await import('./helper');
        expect(foo).toBe('foo');

        const { bar } = await load();
        expect(bar).toBe('bar');
      });
    `,
    'c.test.js': `
      import { test, expect } from '@playwright/test';

      test('pass', async () => {
        const { foo } = await import('./helper');
        expect(foo).toBe('foo');
      });
    `,
    'd.test.js': `
      import { test, expect } from '@playwright/test';

      test('pass', async () => {
        const { foo } = require('./helper4');
        expect(foo).toBe('foo');
      });
    `,
  }, { workers: 1 });
  expect(result.passed).toBe(4);
  expect(result.exitCode).toBe(0);
});

test('should support dynamic imports of esm-only packages', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'node_modules/foo-pkg/package.json': `
      {
        "name": "foo-pkg",
        "type": "module",
        "exports": { "default": "./index.js" }
      }
    `,
    'node_modules/foo-pkg/index.js': `
      export const foo = 'bar';
    `,
    'package.json': `{ "name": "test-project" }`,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';

      test('pass', async () => {
        const { foo } = await import('foo-pkg');
        expect(foo).toBe('bar');
      });
    `,
  }, { workers: 1 });
  expect(result.passed).toBe(1);
  expect(result.exitCode).toBe(0);
});

test('should allow test.extend.ts and test.ts files', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'test.extend.ts': `
      export { test, expect } from '@playwright/test';
    `,
    'test.ts': `
      export const helper = 42;
    `,
    'a.test.ts': `
      import { test, expect } from './test.extend';
      import { helper } from './test';
      test('pass1', async () => {
        expect(helper).toBe(42);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should remove import css', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import './index.css';
      import foo from './index.css';
      import { bar } from './index.css';

      import { test, expect } from '@playwright/test';
      test('pass', async () => {});
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
