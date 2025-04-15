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

test('should retry failures', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'retry-failures.spec.js': `
      import { test, expect } from '@playwright/test';
      test('flake', async ({}, testInfo) => {
        // Passes on the second run.
        expect(testInfo.retry).toBe(1);
      });
    `
  }, { retries: 10 });
  expect(result.exitCode).toBe(0);
  expect(result.flaky).toBe(1);
  expect(result.results.length).toBe(2);
  expect(result.results[0].workerIndex).toBe(0);
  expect(result.results[0].retry).toBe(0);
  expect(result.results[0].status).toBe('failed');
  expect(result.results[1].workerIndex).toBe(1);
  expect(result.results[1].retry).toBe(1);
  expect(result.results[1].status).toBe('passed');
});

test('should retry based on config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { projects: [
        { retries: 0, name: 'no-retries' },
        { retries: 2, name: 'two-retries' },
      ] };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test('pass', ({}, testInfo) => {
        // Passes on the third run.
        expect(testInfo.retry).toBe(2);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.flaky).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.results.length).toBe(4);
});

test('should retry based on test.describe.configure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = { retries: 2 };
    `,
    'a.test.js': `
      import { test, expect } from '@playwright/test';
      test.describe.configure({ retries: 1 });
      test('fail 1', ({}, testInfo) => {
        console.log('%%fail1-' + testInfo.retry);
        expect(1).toBe(2);
      });
    `,
    'b.test.js': `
      import { test, expect } from '@playwright/test';
      test('fail 4', ({}, testInfo) => {
        console.log('%%fail4-' + testInfo.retry);
        expect(1).toBe(2);
      });
      test.describe(() => {
        test.describe.configure({ retries: 0 });
        test('fail 2', ({}, testInfo) => {
          console.log('%%fail2-' + testInfo.retry);
          expect(1).toBe(2);
        });
        test.describe(() => {
          test.describe.configure({ retries: 1 });
          test.describe(() => {
            test('fail 3', ({}, testInfo) => {
              console.log('%%fail3-' + testInfo.retry);
              expect(1).toBe(2);
            });
          });
        });
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(4);
  expect(result.results.length).toBe(8);
  expect(result.output).toContain('%%fail1-0');
  expect(result.output).toContain('%%fail1-1');
  expect(result.output).not.toContain('%%fail1-2');
  expect(result.output).toContain('%%fail4-0');
  expect(result.output).toContain('%%fail4-1');
  expect(result.output).toContain('%%fail4-2');
  expect(result.output).not.toContain('%%fail4-3');
  expect(result.output).toContain('%%fail2-0');
  expect(result.output).not.toContain('%%fail2-1');
  expect(result.output).toContain('%%fail3-0');
  expect(result.output).toContain('%%fail3-1');
  expect(result.output).not.toContain('%%fail3-2');
});

test('should retry timeout', async ({ runInlineTest }) => {
  const { exitCode, passed, failed, output } = await runInlineTest({
    'one-timeout.spec.js': `
      import { test, expect } from '@playwright/test';
      test('timeout', async () => {
        await new Promise(f => setTimeout(f, 10000));
      });
    `
  }, { timeout: 1000, retries: 2, reporter: 'dot' });
  expect(exitCode).toBe(1);
  expect(passed).toBe(0);
  expect(failed).toBe(1);
  expect(output.split('\n')[2]).toBe('××T');
});

test('should fail on unexpected pass with retries', async ({ runInlineTest }) => {
  const { exitCode, failed, output } = await runInlineTest({
    'unexpected-pass.spec.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds', () => {
        test.fail();
        expect(1 + 1).toBe(2);
      });
    `
  }, { retries: 1 });
  expect(exitCode).toBe(1);
  expect(failed).toBe(1);
  expect(output).toContain('Expected to fail, but passed.');
});

test('should retry unexpected pass', async ({ runInlineTest }) => {
  const { exitCode, passed, failed, output } = await runInlineTest({
    'unexpected-pass.spec.js': `
      import { test, expect } from '@playwright/test';
      test('succeeds', () => {
        test.fail();
        expect(1 + 1).toBe(2);
      });
    `
  }, { retries: 2, reporter: 'dot' });
  expect(exitCode).toBe(1);
  expect(passed).toBe(0);
  expect(failed).toBe(1);
  expect(output.split('\n')[2]).toBe('××F');
});

test('should not retry expected failure', async ({ runInlineTest }) => {
  const { exitCode, passed, failed, output } = await runInlineTest({
    'expected-failure.spec.js': `
      import { test, expect } from '@playwright/test';
      test('fails', () => {
        test.fail();
        expect(1 + 1).toBe(3);
      });

      test('non-empty remaining',() => {
        expect(1 + 1).toBe(2);
      });
    `
  }, { retries: 2, reporter: 'dot' });
  expect(exitCode).toBe(0);
  expect(passed).toBe(2);
  expect(failed).toBe(0);
  expect(output.split('\n')[2]).toBe('··');
});

test('should retry unhandled rejection', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'unhandled-rejection.spec.js': `
      import { test, expect } from '@playwright/test';
      test('unhandled rejection', async () => {
        setTimeout(() => {
          throw new Error('Unhandled rejection in the test');
        });
        await new Promise(f => setTimeout(f, 2000));
      });
    `
  }, { retries: 2, reporter: 'dot' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n')[2]).toBe('××F');
  expect(result.output).toContain('Unhandled rejection');
});

test('should retry beforeAll failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.js': `
      import { test, expect } from '@playwright/test';
      test.beforeAll(async () => {
        throw new Error('BeforeAll is bugged!');
      });
      test('passing test', async () => {
      });
      test('another passing test', async () => {
      });
    `
  }, { retries: 2, reporter: 'dot' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.didNotRun).toBe(1);
  expect(result.output.split('\n')[2]).toBe('×°×°F°');
  expect(result.output).toContain('BeforeAll is bugged!');
});

test('should retry worker fixture setup failure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'helper.ts': `
      import { test as base, expect } from '@playwright/test';
      export const test = base.extend({
        worker: [ async () => {
          throw new Error('worker setup is bugged!');
        }, { scope: 'worker' } ]
      });
    `,
    'a.spec.ts': `
      import { test } from './helper';
      test('passing test', async ({ worker }) => {
      });
    `
  }, { retries: 2, reporter: 'dot' });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(1);
  expect(result.output.split('\n')[2]).toBe('××F');
  expect(result.output).toContain('worker setup is bugged!');
});

test('failed and skipped on retry should be marked as flaky', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test } from '@playwright/test';
      test('flaky test', async ({}, testInfo) => {
        if (!testInfo.retry)
          throw new Error('Failed on first run');
        test.skip(true, 'Skipped on first retry');
      });
    `
  }, { retries: 1, reporter: 'dot' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.flaky).toBe(1);
  expect(result.output).toContain('Failed on first run');
  expect(result.report.suites[0].specs[0].tests[0].annotations).toEqual([{ type: 'skip', description: 'Skipped on first retry' }]);
});
