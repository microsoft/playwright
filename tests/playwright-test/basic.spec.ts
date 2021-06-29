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

test('should fail', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'one-failure.spec.ts': `
      const { test } = pwt;
      test('fails', () => {
        expect(1 + 1).toBe(7);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('1) one-failure.spec.ts:6');
});

test('should timeout', async ({ runInlineTest }) => {
  const { exitCode, passed, failed, output } = await runInlineTest({
    'one-timeout.spec.js': `
      const { test } = pwt;
      test('timeout', async () => {
        await new Promise(f => setTimeout(f, 10000));
      });
    `
  }, { timeout: 100 });
  expect(exitCode).toBe(1);
  expect(passed).toBe(0);
  expect(failed).toBe(1);
  expect(output).toContain('Timeout of 100ms exceeded.');
});

test('should succeed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'one-success.spec.js': `
      const { test } = pwt;
      test('succeeds', () => {
        expect(1 + 1).toBe(2);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(0);
});

test('should report suite errors', async ({ runInlineTest }) => {
  const { exitCode, failed, output } = await runInlineTest({
    'suite-error.spec.js': `
      if (new Error().stack.includes('workerRunner'))
        throw new Error('Suite error');

      const { test } = pwt;
      test('passes',() => {
        expect(1 + 1).toBe(2);
      });
    `
  });
  expect(exitCode).toBe(1);
  expect(failed).toBe(1);
  expect(output).toContain('Suite error');
});

test('should respect nested skip', async ({ runInlineTest }) => {
  const { exitCode, passed, failed, skipped } = await runInlineTest({
    'nested-skip.spec.js': `
      const { test } = pwt;
      test.describe('skipped', () => {
        test.skip();
        test('succeeds',() => {
          expect(1 + 1).toBe(2);
        });
      });
    `
  });
  expect(exitCode).toBe(0);
  expect(passed).toBe(0);
  expect(failed).toBe(0);
  expect(skipped).toBe(1);
});

test('should respect excluded tests', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'excluded.spec.ts': `
      const { test } = pwt;
      test('included test', () => {
        expect(1 + 1).toBe(2);
      });

      test('excluded test 1', () => {
        test.skip();
        expect(1 + 1).toBe(3);
      });

      test('excluded test 2', () => {
        test.skip();
        expect(1 + 1).toBe(3);
      });

      test.describe('included describe', () => {
        test('included describe test', () => {
          expect(1 + 1).toBe(2);
        });
      });

      test.describe('excluded describe', () => {
        test.skip();
        test('excluded describe test', () => {
          expect(1 + 1).toBe(3);
        });
      });
    `,
  });
  expect(passed).toBe(2);
  expect(exitCode).toBe(0);
});

test('should respect focused tests', async ({ runInlineTest }) => {
  const { exitCode, passed } = await runInlineTest({
    'focused.spec.ts': `
      const { test } = pwt;
      test('included test', () => {
        expect(1 + 1).toBe(3);
      });

      test.only('focused test', () => {
        expect(1 + 1).toBe(2);
      });

      test.only('focused only test', () => {
        expect(1 + 1).toBe(2);
      });

      test.describe.only('focused describe', () => {
        test('describe test', () => {
          expect(1 + 1).toBe(2);
        });
      });

      test.describe('non-focused describe', () => {
        test('describe test', () => {
          expect(1 + 1).toBe(3);
        });
      });

      test.describe.only('focused describe', () => {
        test('test1', () => {
          expect(1 + 1).toBe(2);
        });
        test.only('test2', () => {
          expect(1 + 1).toBe(2);
        });
        test('test3', () => {
          expect(1 + 1).toBe(2);
        });
        test.only('test4', () => {
          expect(1 + 1).toBe(2);
        });
      });
    `
  });
  expect(passed).toBe(5);
  expect(exitCode).toBe(0);
});

test('skip should take priority over fail', async ({ runInlineTest }) => {
  const { passed, skipped, failed } = await runInlineTest({
    'test.spec.ts': `
      const { test } = pwt;
      test.describe('failing suite', () => {
        test.fail();

        test('skipped', () => {
          test.skip();
          expect(1 + 1).toBe(3);
        });

        test('passing', () => {
          expect(1 + 1).toBe(3);
        });
        test('passing2', () => {
          expect(1 + 1).toBe(3);
        });

        test('failing', () => {
          expect(1 + 1).toBe(2);
        });
      });
    `
  });
  expect(passed).toBe(2);
  expect(skipped).toBe(1);
  expect(failed).toBe(1);
});

test('should focus test from one project', async ({ runInlineTest }) => {
  const { exitCode, passed, skipped, failed } = await runInlineTest({
    'playwright.config.ts': `
      import * as path from 'path';
      module.exports = { projects: [
        { testDir: path.join(__dirname, 'a') },
        { testDir: path.join(__dirname, 'b') },
      ] };
    `,
    'a/afile.spec.ts': `
      const { test } = pwt;
      test('just a test', () => {
        expect(1 + 1).toBe(3);
      });
    `,
    'b/bfile.spec.ts': `
      const { test } = pwt;
      test.only('focused test', () => {
        expect(1 + 1).toBe(2);
      });
    `,
  }, { reporter: 'list,json' });
  expect(passed).toBe(1);
  expect(failed).toBe(0);
  expect(skipped).toBe(0);
  expect(exitCode).toBe(0);
});

test('should work with default export', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'file.spec.ts': `
      import t from ${JSON.stringify(path.join(__dirname, 'entry'))};
      t('passed', () => {
        t.expect(1 + 1).toBe(2);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.failed).toBe(0);
});

test('should work with test wrapper', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.js': `
      console.log('%%helper');
      exports.wrap = (title, fn) => {
        pwt.test(title, fn);
      };
    `,
    'a.spec.js': `
      console.log('%%a.spec');
      const { wrap } = require('./helper');
      wrap('test1', () => {
        console.log('%%test1');
      });
      pwt.test.describe('suite1', () => {
        wrap('suite1.test1', () => {
          console.log('%%suite1.test1');
        });
      });
    `,
    'b.spec.js': `
      console.log('%%b.spec');
      const { wrap } = require('./helper');
      wrap('test2', () => {
        console.log('%%test2');
      });
      pwt.test.describe('suite2', () => {
        wrap('suite2.test2', () => {
          console.log('%%suite2.test2');
        });
      });
    `,
  }, { workers: 1, reporter: 'line' });
  expect(result.passed).toBe(4);
  expect(result.exitCode).toBe(0);
  expect(stripAscii(result.output).split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%a.spec',
    '%%helper',
    '%%b.spec',
    '%%a.spec',
    '%%helper',
    '%%test1',
    '%%suite1.test1',
    '%%b.spec',
    '%%test2',
    '%%suite2.test2',
  ]);
});

test('should work with test helper', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper-a.js': `
      console.log('%%helper-a');
      pwt.test('test1', () => {
        console.log('%%test1');
      });
      pwt.test.describe('suite1', () => {
        pwt.test('suite1.test1', () => {
          console.log('%%suite1.test1');
        });
      });
    `,
    'a.spec.js': `
      console.log('%%a.spec');
      require('./helper-a');
    `,
    'helper-b.js': `
      console.log('%%helper-b');
      pwt.test('test1', () => {
        console.log('%%test2');
      });
      pwt.test.describe('suite2', () => {
        pwt.test('suite2.test2', () => {
          console.log('%%suite2.test2');
        });
      });
    `,
    'b.spec.js': `
      console.log('%%b.spec');
      require('./helper-b');
    `,
  }, { workers: 1, reporter: 'line' });
  expect(result.passed).toBe(4);
  expect(result.exitCode).toBe(0);
  expect(stripAscii(result.output).split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%a.spec',
    '%%helper-a',
    '%%b.spec',
    '%%helper-b',
    '%%a.spec',
    '%%helper-a',
    '%%test1',
    '%%suite1.test1',
    '%%b.spec',
    '%%helper-b',
    '%%test2',
    '%%suite2.test2',
  ]);
});
