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

test('should get top level stdio', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      console.log('\\n%% top level stdout');
      console.error('\\n%% top level stderr');
      test('is a test', () => {
        console.log('\\n%% stdout in a test');
        console.error('\\n%% stderr in a test');
      });
    `
  });
  // top level logs appear twice, because the file is required twice
  expect(result.outputLines.sort()).toEqual([
    'stderr in a test',
    'stdout in a test',
    'top level stderr',
    'top level stderr',
    'top level stdout',
    'top level stdout',
  ]);
});

test('should get stdio from worker fixture teardown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base, expect } from '@playwright/test';
      export const test = base.extend({
        fixture: [ async ({}, run) => {
          console.log('\\n%% worker setup');
          await run();
          console.log('\\n%% worker teardown');
        }, { scope: 'worker' } ]
      });
    `,
    'a.spec.js': `
      const { test } = require('./helper');
      test('is a test', async ({fixture}) => {});
    `
  });
  expect(result.outputLines).toEqual([
    'worker setup',
    'worker teardown'
  ]);
});

test('should ignore stdio when quiet', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { quiet: true };
    `,
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('is a test', () => {
        console.log('\\n%% stdout in a test');
        console.error('\\n%% stderr in a test');
      });
    `
  }, { reporter: 'list' });
  expect(result.output).not.toContain('%%');
});

test('should support console colors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('console log', () => {
        console.log('process.stdout.isTTY = ' + process.stdout.isTTY);
        console.log('process.stderr.isTTY = ' + process.stderr.isTTY);
        console.log({ b: true, n: 123, s: 'abc' });
        console.error({ b: false, n: 123, s: 'abc' });
      });
    `
  });
  expect(result.output).toContain(`process.stdout.isTTY = true`);
  expect(result.output).toContain(`process.stderr.isTTY = true`);
  // The output should have colors.
  expect(result.rawOutput).toContain(`{ b: \x1b[33mtrue\x1b[39m, n: \x1b[33m123\x1b[39m, s: \x1b[32m'abc'\x1b[39m }`);
  expect(result.rawOutput).toContain(`{ b: \x1b[33mfalse\x1b[39m, n: \x1b[33m123\x1b[39m, s: \x1b[32m'abc'\x1b[39m }`);
});

test('should override hasColors and getColorDepth', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test('console log', () => {
        console.log('process.stdout.hasColors(1) = ' + process.stdout.hasColors(1));
        console.log('process.stderr.hasColors(1) = ' + process.stderr.hasColors(1));
        console.log('process.stdout.getColorDepth() > 0 = ' + (process.stdout.getColorDepth() > 0));
        console.log('process.stderr.getColorDepth() > 0 = ' + (process.stderr.getColorDepth() > 0));
      });
    `
  });
  expect(result.output).toContain(`process.stdout.hasColors(1) = true`);
  expect(result.output).toContain(`process.stderr.hasColors(1) = true`);
  expect(result.output).toContain(`process.stdout.getColorDepth() > 0 = true`);
  expect(result.output).toContain(`process.stderr.getColorDepth() > 0 = true`);
});

test('should not throw type error when using assert', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      const assert = require('assert');
      test('assert no type error', () => {
        assert.strictEqual(1, 2);
      });
    `
  });
  expect(result.output).not.toContain(`TypeError: process.stderr.hasColors is not a function`);
  expect(result.output).toContain(`AssertionError`);
});

test('should provide stubs for tty.WriteStream methods on process.stdout/stderr', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/29839' });
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      import type * as tty from 'tty';
      async function checkMethods(stream: tty.WriteStream) {
        expect(stream.isTTY).toBe(true);
        await new Promise<void>(r =>  stream.clearLine(-1, r));;
        await new Promise<void>(r =>  stream.clearScreenDown(r));;
        await new Promise<void>(r =>  stream.cursorTo(0, 0, r));;
        await new Promise<void>(r =>  stream.cursorTo(0, r));;
        await new Promise<void>(r =>  stream.moveCursor(1, 1, r));;
        expect(stream.getWindowSize()).toEqual([stream.columns, stream.rows]);
        // getColorDepth() and hasColors() are covered in other tests.
      }
      test('process.stdout implementd tty.WriteStream methods', () => {
        checkMethods(process.stdout);
      });
      test('process.stderr implementd tty.WriteStream methods', () => {
        checkMethods(process.stderr);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});
