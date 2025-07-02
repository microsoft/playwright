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

test('should access error in fixture', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'test-error-visible-in-env.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [async ({}, run, testInfo) => {
          await run();
          console.log('ERROR[[[' + JSON.stringify(testInfo.error, undefined, 2) + ']]]');
        }, { auto: true }],
      });
      test('ensure env handles test error', async ({}) => {
        expect(true).toBe(false);
      });
    `
  }, {});
  expect(result.exitCode).toBe(1);
  const start = result.output.indexOf('ERROR[[[') + 8;
  const end = result.output.indexOf(']]]');
  const data = JSON.parse(result.output.substring(start, end));
  expect(data.message).toContain('Object.is equality');
});

test('should access annotations in fixture', async ({ runInlineTest }) => {
  const { exitCode, report } = await runInlineTest({
    'test-data-visible-in-env.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: [async ({}, run, testInfo) => {
          await run();
          testInfo.annotations.push({ type: 'myname', description: 'hello' });
        }, { auto: true }],
      });
      test('ensure env can set data', async ({}, testInfo) => {
        test.slow(true, 'just slow');

        console.log('console.log');
        console.error('console.error');
        expect(testInfo.config.rootDir).toBeTruthy();
        expect(testInfo.file).toContain('test-data-visible-in-env');
      });
    `
  });
  expect(exitCode).toBe(0);
  const test = report.suites[0].specs[0].tests[0];
  expect(test.annotations).toEqual([
    { type: 'slow', description: 'just slow', location: { file: expect.any(String), line: 10, column: 14 } },
    { type: 'myname', description: 'hello' }
  ]);
  expect(test.results[0].stdout).toEqual([{ text: 'console.log\n' }]);
  expect(test.results[0].stderr).toEqual([{ text: 'console.error\n' }]);
});

test('should report projectName in result', async ({ runInlineTest }) => {
  const { exitCode, report } = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'foo' },
          {},
        ],
      };
    `,
    'test-data-visible-in-env.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('some test', async ({}, testInfo) => {
      });
    `
  });
  expect(report.suites[0].specs[0].tests[0].projectName).toBe('foo');
  expect(report.suites[0].specs[0].tests[1].projectName).toBe('');
  expect(exitCode).toBe(0);
});

test('should access testInfo.attachments in fixture', async ({ runInlineTest }) => {
  const { exitCode, report } = await runInlineTest({
    'test-data-visible-in-env.spec.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend({
        foo: async ({}, run, testInfo) => {
          await run();
          testInfo.attachments.push({ name: 'foo', body: Buffer.from([1, 2, 3]), contentType: 'application/octet-stream' });
        },
      });
      test('ensure fixture can set data', async ({ foo }) => {
      });
    `
  });
  expect(exitCode).toBe(0);
  const test = report.suites[0].specs[0].tests[0];
  expect(test.results[0].attachments[0]).toEqual({ name: 'foo', body: 'AQID', contentType: 'application/octet-stream' });
});
