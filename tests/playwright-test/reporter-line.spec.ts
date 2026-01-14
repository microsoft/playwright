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

for (const useIntermediateMergeReport of [false, true] as const) {
  test.describe(`${useIntermediateMergeReport ? 'merged' : 'created'}`, () => {
    test.use({ useIntermediateMergeReport });

    test('render unexpected after retry', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          const { test, expect } = require('@playwright/test');
          test('one', async ({}) => {
            expect(1).toBe(0);
          });
        `,
      }, { retries: 3, reporter: 'line' });
      const text = result.output;
      expect(text).toContain('[1/1] a.test.js:3:11 › one');
      expect(text).toContain('[2/1] (retries) a.test.js:3:11 › one (retry #1)');
      expect(text).toContain('[3/1] (retries) a.test.js:3:11 › one (retry #2)');
      expect(text).toContain('[4/1] (retries) a.test.js:3:11 › one (retry #3)');
      expect(text).toContain('1 failed');
      expect(text).toContain('1) a.test');
      expect(text).not.toContain('2) a.test');
      expect(text).toContain('Retry #1 ────');
      expect(text).toContain('Retry #2 ────');
      expect(text).toContain('Retry #3 ────');
      expect(result.exitCode).toBe(1);
    });

    test('render flaky', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          import { test, expect } from '@playwright/test';
          test('one', async ({}, testInfo) => {
            expect(testInfo.retry).toBe(3);
          });
        `,
      }, { retries: 3, reporter: 'line' });
      const text = result.output;
      expect(text).toContain('1 flaky');
      expect(result.exitCode).toBe(0);
    });

    test('should print flaky failures', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('foobar', async ({}, testInfo) => {
            expect(testInfo.retry).toBe(1);
          });
        `
      }, { retries: '1', reporter: 'line' });
      expect(result.exitCode).toBe(0);
      expect(result.flaky).toBe(1);
      expect(result.output).toContain('expect(testInfo.retry).toBe(1)');
    });

    test('should work on CI', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.js': `
          const { test, expect } = require('@playwright/test');
          test('one', async ({}) => {
            expect(1).toBe(0);
          });
        `,
      }, { reporter: 'line' }, { CI: '1' });
      const text = result.output;
      expect(text).toContain('[1/1] a.test.js:3:11 › one');
      expect(text).toContain('1 failed');
      expect(text).toContain('1) a.test');
      expect(result.exitCode).toBe(1);
    });

    test('should print output', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.spec.ts': `
          import { test, expect } from '@playwright/test';
          test('foobar', async ({}, testInfo) => {
            process.stdout.write('one');
            process.stdout.write('two');
            console.log('full-line');
          });
        `
      }, { reporter: 'line' });
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain([
        'a.spec.ts:3:15 › foobar',
        'one',
        '',
        'two',
        '',
        'full-line',
      ].join('\n'));
    });

    test('should trim multiline step titles to first line', {
      annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31266' }
    }, async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
            await test.step(\`outer
                             1.0\`, async () => {
              await test.step(\`inner
                                1.1\`, async () => {
                expect(1).toBe(1);
              });
            });
          });
        `,
      }, { reporter: 'line' }, { PLAYWRIGHT_FORCE_TTY: '1' });
      const text = result.output;
      expect(text).toContain('[1/1] a.test.ts:3:15 › passes › outer › inner');
      expect(result.exitCode).toBe(0);
    });

    test('should render failed test steps', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
            await test.step('outer 1.0', async () => {
              await test.step('inner 1.1', async () => {
                expect(1).toBe(2);
              });
            });
          });
        `,
      }, { reporter: 'line' });
      const text = result.output;
      expect(text).toContain('1) a.test.ts:3:15 › passes › outer 1.0 › inner 1.1 ──');
      expect(result.exitCode).toBe(1);
    });

    test('should not render more than one failed test steps in header', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
            await test.step('outer 1.0', async () => {
              await test.step('inner 1.1', async () => {
                expect.soft(1).toBe(2);
              });
              await test.step('inner 1.2', async () => {
                expect.soft(1).toBe(2);
              });
            });
          });
        `,
      }, { reporter: 'line' });
      const text = result.output;
      expect(text).toContain('1) a.test.ts:3:15 › passes › outer 1.0 ──');
      expect(result.exitCode).toBe(1);
    });

    test('should not render more than one failed test steps in header (2)', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
            await test.step('outer 1.0', async () => {
              await test.step('inner 1.1', async () => {
                expect.soft(1).toBe(2);
              });
            });
            expect.soft(1).toBe(2);
          });
        `,
      }, { reporter: 'line' });
      const text = result.output;
      expect(text).toContain('1) a.test.ts:3:15 › passes ──');
      expect(result.exitCode).toBe(1);
    });

    test('should show error context with relative path', async ({ runInlineTest, useIntermediateMergeReport }) => {
      const result = await runInlineTest({
        'a.test.js': `
          const { test, expect } = require('@playwright/test');
          test('one', async ({ page }) => {
            await page.setContent('<div>hello</div>');
            expect(1).toBe(0);
          });
        `,
      }, { reporter: 'line' });
      const text = result.output;
      if (useIntermediateMergeReport)
        expect(text).toContain(`Error Context: ${path.join('blob-report', 'resources')}`);
      else
        expect(text).toContain(`Error Context: ${path.join('test-results', 'a-one', 'error-context.md')}`);
      expect(result.exitCode).toBe(1);
    });

    test('should not include global tag in the title', async ({ runInlineTest }) => {
      const result = await runInlineTest({
        'playwright.config.ts': `
          export default { tag: '@global' };
        `,
        'a.test.ts': `
          import { test, expect } from '@playwright/test';
          test('passes', async ({}) => {
          });
        `,
      }, { reporter: 'line' });
      expect(result.output).toContain('[1/1] a.test.ts:3:15 › passes\n');
      expect(result.output).not.toContain('@global');
      expect(result.exitCode).toBe(0);
    });
  });
}

test.describe('onTestPaused', () => {
  test.skip(process.platform === 'win32', 'No SIGINT on windows');

  test('pause at end', async ({ interactWithTestRunner }) => {
    const runner = await interactWithTestRunner({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('foo', async ({}) => {
        });

        test.afterEach(() => {
          console.log('Running teardown');
        });
      `,
    }, { pause: true, reporter: 'line' }, { PW_TEST_DEBUG_REPORTERS: '1' });

    await runner.waitForOutput('Paused at test end. Press Ctrl+C to end.');
    const { exitCode } = await runner.kill('SIGINT');
    expect(exitCode).toBe(130);

    expect(stripAnsi(runner.output)).toEqual(`
Running 1 test using 1 worker

[1/1] a.test.ts:3:13 › foo
  a.test.ts:3:13 › foo ─────────────────────────────────────────────────────────────────────────────
    Paused at test end. Press Ctrl+C to end.


[1/1] a.test.ts:3:13 › foo
a.test.ts:3:13 › foo
Running teardown

  1) a.test.ts:3:13 › foo ──────────────────────────────────────────────────────────────────────────

    Test was interrupted.


  1 interrupted
    a.test.ts:3:13 › foo ───────────────────────────────────────────────────────────────────────────
`);
  });

  test('pause at end - error in teardown', async ({ interactWithTestRunner }) => {
    const runner = await interactWithTestRunner({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('foo', async ({}) => {
        });

        test.afterEach(() => {
          throw new Error('teardown error');
        });
      `,
    }, { pause: true, reporter: 'line' }, { PW_TEST_DEBUG_REPORTERS: '1' });

    await runner.waitForOutput('Paused at test end. Press Ctrl+C to end.');
    const { exitCode } = await runner.kill('SIGINT');
    expect(exitCode).toBe(130);

    expect(stripAnsi(runner.output)).toEqual(`
Running 1 test using 1 worker

[1/1] a.test.ts:3:13 › foo
  a.test.ts:3:13 › foo ─────────────────────────────────────────────────────────────────────────────
    Paused at test end. Press Ctrl+C to end.


[1/1] a.test.ts:3:13 › foo
  1) a.test.ts:3:13 › foo ──────────────────────────────────────────────────────────────────────────

    Test was interrupted.

    Error: teardown error

      5 |
      6 |         test.afterEach(() => {
    > 7 |           throw new Error('teardown error');
        |                 ^
      8 |         });
      9 |       
        at ${test.info().outputPath('a.test.ts')}:7:17


  1 interrupted
    a.test.ts:3:13 › foo ───────────────────────────────────────────────────────────────────────────
`);
  });

  test('pause on error', async ({ interactWithTestRunner }) => {
    const runner = await interactWithTestRunner({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('fails', async ({}) => {
          expect.soft(2).toBe(3);
          expect(3).toBe(4);
        });
      `,
    }, { pause: true, reporter: 'line' }, { PW_TEST_DEBUG_REPORTERS: '1' });

    await runner.waitForOutput('Paused on error. Press Ctrl+C to end.');
    const { exitCode } = await runner.kill('SIGINT');
    expect(exitCode).toBe(130);

    expect(stripAnsi(runner.output)).toEqual(`
Running 1 test using 1 worker

[1/1] a.test.ts:3:13 › fails
  1) a.test.ts:3:13 › fails ────────────────────────────────────────────────────────────────────────

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 3
    Received: 2

      2 |         import { test, expect } from '@playwright/test';
      3 |         test('fails', async ({}) => {
    > 4 |           expect.soft(2).toBe(3);
        |                          ^
      5 |           expect(3).toBe(4);
      6 |         });
      7 |       
        at ${test.info().outputPath('a.test.ts')}:4:26

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 4
    Received: 3

      3 |         test('fails', async ({}) => {
      4 |           expect.soft(2).toBe(3);
    > 5 |           expect(3).toBe(4);
        |                     ^
      6 |         });
      7 |       
        at ${test.info().outputPath('a.test.ts')}:5:21

    Paused on error. Press Ctrl+C to end.


[1/1] a.test.ts:3:13 › fails


  1 failed
    a.test.ts:3:13 › fails ─────────────────────────────────────────────────────────────────────────
`);
  });
});
