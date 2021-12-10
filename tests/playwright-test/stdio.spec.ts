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
      const { test } = pwt;
      console.log('\\n%% top level stdout');
      console.error('\\n%% top level stderr');
      test('is a test', () => {
        console.log('\\n%% stdout in a test');
        console.error('\\n%% stderr in a test');
      });
    `
  });
  // top level logs appear twice, because the file is required twice
  expect(result.output.split('\n').filter(x => x.startsWith('%%')).sort()).toEqual([
    '%% stderr in a test',
    '%% stdout in a test',
    '%% top level stderr',
    '%% top level stderr',
    '%% top level stdout',
    '%% top level stdout',
  ]);
});

test('should get stdio from worker fixture teardown', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      export const test = pwt.test.extend({
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
  expect(result.output.split('\n').filter(x => x.startsWith('%%'))).toEqual([
    '%% worker setup',
    '%% worker teardown'
  ]);
});

test('should get stdio from beforeAll and afterAll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      const { test } = pwt;
      test.beforeAll(() => console.log('before'));
      test('is a test', () => {});
      test.afterAll(() => console.error('after'));
    `
  });
  expect(result.report.suites[0].hooks[0].tests[0].results[0].stdout).toEqual([{ text: 'before\n' }]);
  expect(result.report.suites[0].hooks[1].tests[0].results[0].stderr).toEqual([{ text: 'after\n' }]);
});

test('should ignore stdio when quiet', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { quiet: true };
    `,
    'a.spec.js': `
      const { test } = pwt;
      test('is a test', () => {
        console.log('\\n%% stdout in a test');
        console.error('\\n%% stderr in a test');
      });
    `
  }, { reporter: 'list' }, { PWTEST_SKIP_TEST_OUTPUT: '' });
  expect(result.output).not.toContain('%%');
});
