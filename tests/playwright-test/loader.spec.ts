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
  expect(result.output).toContain('error.spec.js:6');
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
      const { test } = pwt;
      test('fails', async ({}, testInfo) => {
        await new Promise(f => setTimeout(f, 2000));
      });
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Timeout of 1000ms exceeded.');
});

test('should validate configuration object', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default { timeout: '1000' };
    `,
    'a.test.ts': `
      const { test } = pwt;
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
      const { test } = pwt;
      test('works', () => {});
    `,
    'hello.spec.ts': `
      const { test } = pwt;
      test('works', () => {});
    `,
    'test.ts': `
      const { test } = pwt;
      test('works', () => {});
    `,
    'spec.ts': `
      const { test } = pwt;
      test('works', () => {});
    `,
    'strange.....spec.ts': `
      const { test } = pwt;
      test('works', () => {});
    `,
    'badspec.ts': `
      const { test } = pwt;
      test('bad', () => { throw new Error('badspec.ts')});
    `,
    'specspec.ts': `
      const { test } = pwt;
      test('bad', () => { throw new Error('specspec.ts')});
    `,
    'a.testtest.ts': `
      const { test } = pwt;
      test('bad', () => { throw new Error('a.testtest.ts')});
    `,
    'b.testspec.ts': `
      const { test } = pwt;
      test('bad', () => { throw new Error('b.testspec.ts')});
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);
});

test('should load an mjs file', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'a.spec.mjs': `
        const { test } = pwt;
        test('succeeds', () => {
          expect(1 + 1).toBe(2);
        });
      `
  });
  expect(passed).toBe(1);
  expect(exitCode).toBe(0);
});

test('should throw a nice error if a js file uses import', async ({ runInlineTest }) => {
  const { exitCode, output } = await runInlineTest({
    'a.spec.js': `
        import fs from 'fs';
        const { test } = folio;
        test('succeeds', () => {
          expect(1 + 1).toBe(2);
        });
      `
  });
  expect(exitCode).toBe(1);
  expect(output).toContain('a.spec.js');
  expect(output).toContain('JavaScript files must end with .mjs to use import.');
});

test('should load esm when package.json has type module', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      //@no-header
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'a.esm.test.js': `
      const { test } = pwt;
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should load esm config files', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.mjs': `
      //@no-header
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should fail to load ts from esm when package.json has type module', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      //@no-header
      import * as fs from 'fs';
      export default { projects: [{name: 'foo'}] };
    `,
    'package.json': JSON.stringify({ type: 'module' }),
    'a.test.js': `
      import { foo } from './b.ts';
      const { test } = pwt;
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `,
    'b.ts': `
      export const foo: string = 'foo';
    `
  });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Cannot import a typescript file from an esmodule');
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
      const { test } = pwt;
      test('check project name', ({}, testInfo) => {
        expect(testInfo.project.name).toBe('foo');
      });
    `,
    'b.ts': `
      export const foo: string = 'foo';
    `
  }, {}, {
    PW_EXPERIMENTAL_TS_ESM: true
  });

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
  }, {}, {
    PW_EXPERIMENTAL_TS_ESM: true
  });

  expect(result.exitCode).toBe(1);
});

test('should filter stack trace for simple expect', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('should work', () => {
        test.expect(1+1).toEqual(3);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
});

test('should filter stack trace for web-first assertions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('should work', async ({page}) => {
        await expect(page.locator('x-foo'), 'x-foo must be visible').toBeVisible({timeout: 1});
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
});

test('should filter out event emitter from stack traces', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      const EventEmitter = require('events');
      test('should work', async ({}) => {
        const emitter = new EventEmitter();
        emitter.on('event', function handle() { expect(1).toBe(2); });
        emitter.emit('event');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  const outputWithoutGoodStackFrames = stripAnsi(result.output).split('\n').filter(line => !line.includes(testInfo.outputPath())).join('\n');
  expect(outputWithoutGoodStackFrames).not.toContain('EventEmitter.emit');
});

test('should filter stack trace for raw errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('should work', async ({}) => {
        throw new Error('foobar!');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain('foobar!');
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
});

test('should not filter out POM', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export function foo() {
        throw new Error('foo');
      }
    `,
    'expect-test.spec.ts': `
      const { test } = pwt;
      const { foo } = require('./helper');
      test('should work', ({}) => {
        foo();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain('foo');
  expect(stripAnsi(result.output)).toContain('helper.ts');
  expect(stripAnsi(result.output)).toContain('expect-test.spec.ts');
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
});

test('should filter stack even without default Error.prepareStackTrace', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      const { test } = pwt;
      test('should work', ({}) => {
        Error.prepareStackTrace = undefined;
        throw new Error('foobar');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(stripAnsi(result.output)).toContain('foobar');
  expect(stripAnsi(result.output)).toContain('expect-test.spec.ts');
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-test`);
  expect(stripAnsi(result.output)).not.toContain(path.sep + `playwright-core`);
  expect(stripAnsi(result.output)).not.toContain('internal');
  const stackLines = stripAnsi(result.output).split('\n').filter(line => line.includes('    at '));
  expect(stackLines.length).toBe(1);
});

