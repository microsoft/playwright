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

test('should run retries immediately by default (leading)', async ({
  runInlineTest,
}) => {
  const result = await runInlineTest(
      {
        'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({}, testInfo) => {
        console.log('%%fail-' + testInfo.retry);
        expect(testInfo.retry).toBe(1);
      });
      test('pass', async ({}, testInfo) => {
        console.log('%%pass-' + testInfo.retry);
        expect(testInfo.retry).toBe(0);
      });
    `,
      },
      { retries: 1 }
  );

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.flaky).toBe(1);
  expect(result.outputLines).toEqual([
    'fail-0', // Initial run of 'fail'
    'fail-1', // Retry of 'fail' immediately after
    'pass-0', // Initial run of 'pass'
  ]);
});

test('should run retries immediately with leading strategy', async ({
  runInlineTest,
}) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { retries: 1, retryStrategy: 'leading' };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({}, testInfo) => {
        console.log('%%fail-' + testInfo.retry);
        expect(testInfo.retry).toBe(1);
      });
      test('pass', async ({}, testInfo) => {
        console.log('%%pass-' + testInfo.retry);
        expect(testInfo.retry).toBe(0);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.flaky).toBe(1);
  expect(result.outputLines).toEqual([
    'fail-0', // Initial run of 'fail'
    'fail-1', // Retry of 'fail' immediately after
    'pass-0', // Initial run of 'pass'
  ]);
});

test('should run retries after all tests with trailing strategy', async ({
  runInlineTest,
}) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { retries: 1, retryStrategy: 'trailing' };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({}, testInfo) => {
        console.log('%%fail-' + testInfo.retry);
        expect(testInfo.retry).toBe(1);
      });
      test('pass', async ({}, testInfo) => {
        console.log('%%pass-' + testInfo.retry);
        expect(testInfo.retry).toBe(0);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.flaky).toBe(1);
  expect(result.outputLines).toEqual([
    'fail-0', // Initial run of 'fail'
    'pass-0', // Initial run of 'pass'
    'fail-1', // Retry of 'fail' after 'pass' finished
  ]);
});

test('should run multiple retries after all tests with trailing strategy', async ({
  runInlineTest,
}) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { retries: 1, retryStrategy: 'trailing' };
    `,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('fail1', async ({}, testInfo) => {
        console.log('%%fail1-' + testInfo.retry);
        expect(testInfo.retry).toBe(1);
      });
      test('pass1', async ({}, testInfo) => {
        console.log('%%pass1-' + testInfo.retry);
        expect(testInfo.retry).toBe(0);
      });
      test('fail2', async ({}, testInfo) => {
        console.log('%%fail2-' + testInfo.retry);
        expect(testInfo.retry).toBe(1);
      });
       test('pass2', async ({}, testInfo) => {
        console.log('%%pass2-' + testInfo.retry);
        expect(testInfo.retry).toBe(0);
      });
    `,
  });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.flaky).toBe(2);
  // Order of initial runs and order of retries are deterministic with workers=1
  expect(result.outputLines).toEqual([
    'fail1-0',
    'pass1-0',
    'fail2-0',
    'pass2-0',
    'fail1-1',
    'fail2-1',
  ]);
});

test('should run serial retries after other tests with trailing strategy', async ({
  runInlineTest,
}) => {
  const result = await runInlineTest(
      {
        'playwright.config.ts': `
      module.exports = { retries: 1, retryStrategy: 'trailing' };
    `,
        'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test.describe.serial('serial', () => {
        test('s1-fail', async ({}, testInfo) => {
          console.log('%%s1-fail-' + testInfo.retry);
          expect(testInfo.retry).toBe(1);
        });
        test('s1-pass', async ({}, testInfo) => {
          console.log('%%s1-pass-' + testInfo.retry);
          // This should run only in the retry attempt because the previous test failed initially.
          expect(testInfo.retry).toBe(1);
        });
      });
      test('pass', async ({}, testInfo) => {
        console.log('%%pass-' + testInfo.retry);
        expect(testInfo.retry).toBe(0);
      });
    `,
      },
      { workers: 1 }
  ); // Use workers: 1 for deterministic order

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2); // pass, s1-pass (on retry)
  expect(result.flaky).toBe(1); // s1-fail
  expect(result.outputLines).toEqual([
    's1-fail-0', // Initial run of serial block fails here
    'pass-0', // Initial run of parallel test
    's1-fail-1', // Retry of serial block starts
    's1-pass-1', // Continues in serial block during retry
  ]);
});
