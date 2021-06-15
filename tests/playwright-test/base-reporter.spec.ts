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

import { test, expect, stripAscii } from './playwright-test-fixtures';
import * as path from 'path';

test('handle long test names', async ({ runInlineTest }) => {
  const title = 'title'.repeat(30);
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('${title}', async ({}) => {
        expect(1).toBe(0);
      });
    `,
  });
  expect(stripAscii(result.output)).toContain('expect(1).toBe');
  expect(result.exitCode).toBe(1);
});

test('print the error name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
    const { test } = pwt;
    test('foobar', async ({}) => {
      const error = new Error('my-message');
      error.name = 'FooBarError';
      throw error;
    });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('FooBarError: my-message');
});

test('print should print the error name without a message', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
    const { test } = pwt;
    test('foobar', async ({}) => {
      const error = new Error();
      error.name = 'FooBarError';
      throw error;
    });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('FooBarError');
});

test('print an error in a codeframe', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'my-lib.ts': `
    const foobar = () => {
      const error = new Error('my-message');
      error.name = 'FooBarError';
      throw error;
    }
    export default () => {
      foobar();
    }
    `,
    'a.spec.ts': `
    const { test } = pwt;
    import myLib from './my-lib';
    test('foobar', async ({}) => {
      const error = new Error('my-message');
      error.name = 'FooBarError';
      throw error;
    });
    `
  }, {}, {
    FORCE_COLOR: '0',
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('FooBarError: my-message');
  expect(result.output).toContain('test(\'foobar\', async');
  expect(result.output).toContain('throw error;');
  expect(result.output).toContain('import myLib from \'./my-lib\';');
});

test('should print slow tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'foo' },
          { name: 'bar' },
          { name: 'baz' },
          { name: 'qux' },
        ],
        reportSlowTests: { max: 0, threshold: 500 },
      };
    `,
    'dir/a.test.js': `
      const { test } = pwt;
      test('slow test', async ({}) => {
        await new Promise(f => setTimeout(f, 1000));
      });
    `,
    'dir/b.test.js': `
      const { test } = pwt;
      test('fast test', async ({}) => {
        await new Promise(f => setTimeout(f, 100));
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(8);
  expect(stripAscii(result.output)).toContain(`Slow test: dir${path.sep}a.test.js [foo] (`);
  expect(stripAscii(result.output)).toContain(`Slow test: dir${path.sep}a.test.js [bar] (`);
  expect(stripAscii(result.output)).toContain(`Slow test: dir${path.sep}a.test.js [baz] (`);
  expect(stripAscii(result.output)).toContain(`Slow test: dir${path.sep}a.test.js [qux] (`);
  expect(stripAscii(result.output)).not.toContain(`Slow test: dir${path.sep}b.test.js [foo] (`);
  expect(stripAscii(result.output)).not.toContain(`Slow test: dir${path.sep}b.test.js [bar] (`);
  expect(stripAscii(result.output)).not.toContain(`Slow test: dir${path.sep}b.test.js [baz] (`);
  expect(stripAscii(result.output)).not.toContain(`Slow test: dir${path.sep}b.test.js [qux] (`);
});

test('should not print slow tests', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'baz' },
          { name: 'qux' },
        ],
        reportSlowTests: null,
      };
    `,
    'dir/a.test.js': `
      const { test } = pwt;
      test('slow test', async ({}) => {
        await new Promise(f => setTimeout(f, 1000));
      });
      test('fast test', async ({}) => {
        await new Promise(f => setTimeout(f, 100));
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(stripAscii(result.output)).not.toContain('Slow test');
});
