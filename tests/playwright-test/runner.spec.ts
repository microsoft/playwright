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
import path from 'path';
import { test, expect, stripAnsi } from './playwright-test-fixtures';

test('it should not allow multiple tests with the same name per suite', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tests/example.spec.js': `
      const { test } = pwt;
      test('i-am-a-duplicate', async () => {});
      test('i-am-a-duplicate', async () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('duplicate test titles are not allowed');
  expect(result.output).toContain(`- title: i-am-a-duplicate`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:6`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:7`);
});

test('it should enforce unique test names based on the describe block name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tests/example.spec.js': `
      const { test } = pwt;
      test.describe('hello', () => { test('my world', () => {}) });
      test.describe('hello my', () => { test('world', () => {}) });
      test('hello my world', () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('duplicate test titles are not allowed');
  expect(result.output).toContain(`- title: hello my world`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:6`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:7`);
  expect(result.output).toContain(`  - tests${path.sep}example.spec.js:8`);
});

test('it should not allow a focused test when forbid-only is used', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'tests/focused-test.spec.js': `
      const { test } = pwt;
      test.only('i-am-focused', async () => {});
    `
  }, { 'forbid-only': true });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('--forbid-only found a focused test.');
  expect(result.output).toContain(`- tests${path.sep}focused-test.spec.js:6 > i-am-focused`);
});

test('it should not hang and report results when worker process suddenly exits', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test('passed1', () => {});
      test('passed2', () => {});
      test('failed1', () => { process.exit(0); });
      test('skipped', () => {});
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(result.skipped).toBe(1);
  expect(result.output).toContain('Worker process exited unexpectedly');
});

test('sigint should stop workers', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test('interrupted1', async () => {
        console.log('\\n%%SEND-SIGINT%%1');
        await new Promise(f => setTimeout(f, 3000));
      });
      test('skipped1', async () => {
        console.log('\\n%%skipped1');
      });
    `,
    'b.spec.js': `
      const { test } = pwt;
      test('interrupted2', async () => {
        console.log('\\n%%SEND-SIGINT%%2');
        await new Promise(f => setTimeout(f, 3000));
      });
      test('skipped2', async () => {
        console.log('\\n%%skipped2');
      });
    `,
  }, { 'workers': 2 }, {}, { sendSIGINTAfter: 2 });
  expect(result.exitCode).toBe(130);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(4);
  expect(result.output).toContain('%%SEND-SIGINT%%1');
  expect(result.output).toContain('%%SEND-SIGINT%%2');
  expect(result.output).not.toContain('%%skipped1');
  expect(result.output).not.toContain('%%skipped2');

  const interrupted2 = result.report.suites[1].specs[0];
  expect(interrupted2.title).toBe('interrupted2');
  expect(interrupted2.tests[0].results[0].workerIndex === 0 || interrupted2.tests[0].results[0].workerIndex === 1).toBe(true);

  const skipped2 = result.report.suites[1].specs[1];
  expect(skipped2.title).toBe('skipped2');
  expect(skipped2.tests[0].results[0].workerIndex).toBe(-1);
});

test('should use the first occurring error when an unhandled exception was thrown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'unhandled-exception.spec.js': `
      const test = pwt.test.extend({
        context: async ({}, test) => {
          await test(123)
          let errorWasThrownPromiseResolve = () => {}
          const errorWasThrownPromise = new Promise(resolve => errorWasThrownPromiseResolve = resolve);
          setTimeout(() => {
            errorWasThrownPromiseResolve();
            throw new Error('second error');
          }, 0)
          await errorWasThrownPromise;
        },
        page: async ({ context}, test) => {
          throw new Error('first error');
          await test(123)
        },
      });

      test('my-test', async ({ page }) => { });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.report.suites[0].specs[0].tests[0].results[0].error.message).toBe('first error');
});

test('worker interrupt should report errors', async ({ runInlineTest }) => {
  test.skip(process.platform === 'win32', 'No sending SIGINT on Windows');

  const result = await runInlineTest({
    'a.spec.js': `
      const test = pwt.test.extend({
        throwOnTeardown: async ({}, use) => {
          let reject;
          await use(new Promise((f, r) => reject = r));
          reject(new Error('INTERRUPT'));
        },
      });
      test('interrupted', async ({ throwOnTeardown }) => {
        console.log('\\n%%SEND-SIGINT%%');
        await throwOnTeardown;
      });
    `,
  }, {}, {}, { sendSIGINTAfter: 1 });
  expect(result.exitCode).toBe(130);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.skipped).toBe(1);
  expect(result.output).toContain('%%SEND-SIGINT%%');
  expect(result.output).toContain('Error: INTERRUPT');
});

test('should not stall when workers are available', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt
      test('fails-1', async () => {
        console.log('\\n%%fails-1-started');
        await new Promise(f => setTimeout(f, 2000));
        console.log('\\n%%fails-1-done');
        expect(1).toBe(2);
      });
      test('passes-1', async () => {
        console.log('\\n%%passes-1');
      });
    `,
    'b.spec.js': `
      const { test } = pwt
      test('passes-2', async () => {
        await new Promise(f => setTimeout(f, 1000));
        console.log('\\n%%passes-2-started');
        await new Promise(f => setTimeout(f, 3000));
        console.log('\\n%%passes-2-done');
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(2);
  expect(result.failed).toBe(1);
  expect(stripAnsi(result.output).split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%fails-1-started',
    '%%passes-2-started',
    '%%fails-1-done',
    '%%passes-1',
    '%%passes-2-done',
  ]);
});

test('should teardown workers that are redundant', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.js': `
      module.exports = pwt.test.extend({
        w: [async ({}, use) => {
          console.log('\\n%%worker setup');
          await use('worker');
          console.log('\\n%%worker teardown');
        }, { scope: 'worker' }],
      });
    `,
    'a.spec.js': `
      const test = require('./helper');
      test('test1', async ({ w }) => {
        await new Promise(f => setTimeout(f, 1500));
        console.log('\\n%%test-done');
      });
    `,
    'b.spec.js': `
      const test = require('./helper');
      test('test2', async ({ w }) => {
        await new Promise(f => setTimeout(f, 3000));
        console.log('\\n%%test-done');
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(stripAnsi(result.output).split('\n').filter(line => line.startsWith('%%'))).toEqual([
    '%%worker setup',
    '%%worker setup',
    '%%test-done',
    '%%worker teardown',
    '%%test-done',
    '%%worker teardown',
  ]);
});
