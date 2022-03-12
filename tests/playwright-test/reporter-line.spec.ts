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

import { test, expect, trimLineEnds, stripAnsi } from './playwright-test-fixtures';

test('should work with tty', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('passing test', async ({}) => {
      });
      test.skip('skipped test', async ({}) => {
      });
      test('flaky test', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
      test('failing test', async ({}) => {
        expect(1).toBe(0);
      });
    `,
  }, { retries: '1', reporter: 'line', workers: '1' }, {
    PLAYWRIGHT_LIVE_TERMINAL: '1',
    FORCE_COLOR: '0',
    PW_TEST_DEBUG_REPORTERS: '1',
  });
  expect(result.exitCode).toBe(1);
  expect(trimLineEnds(result.output)).toContain(trimLineEnds(`Running 4 tests using 1 worker


<lineup><erase><lineup><erase>a.test.js:6:7 › passing test
25% [1/4] Passed: 1 Flaky: 0 Failed: 0 Skipped: 0 (XXms)
<lineup><erase><lineup><erase>a.test.js:8:12 › skipped test
50% [2/4] Passed: 1 Flaky: 0 Failed: 0 Skipped: 1 (XXms)
<lineup><erase><lineup><erase>a.test.js:10:7 › flaky test
75% [3/4] Passed: 1 Flaky: 0 Failed: 0 Skipped: 1 (XXms)
<lineup><erase><lineup><erase>a.test.js:10:7 › flaky test (retry #1)
99% [4/4] (retries) Passed: 1 Flaky: 1 Failed: 0 Skipped: 1 (XXms)
<lineup><erase><lineup><erase>  1) a.test.js:10:7 › flaky test ===================================================================

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 0

       9 |       });
      10 |       test('flaky test', async ({}, testInfo) => {
    > 11 |         expect(testInfo.retry).toBe(1);
         |                                ^
      12 |       });
      13 |       test('failing test', async ({}) => {
      14 |         expect(1).toBe(0);

        at ${testInfo.outputPath('a.test.js')}:11:32


<lineup><erase><lineup><erase>a.test.js:13:7 › failing test
99% [5/4] (retries) Passed: 1 Flaky: 1 Failed: 0 Skipped: 1 (XXms)
<lineup><erase><lineup><erase>a.test.js:13:7 › failing test (retry #1)
99% [6/4] (retries) Passed: 1 Flaky: 1 Failed: 1 Skipped: 1 (XXms)
<lineup><erase><lineup><erase>  2) a.test.js:13:7 › failing test =================================================================

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 0
    Received: 1

      12 |       });
      13 |       test('failing test', async ({}) => {
    > 14 |         expect(1).toBe(0);
         |                   ^
      15 |       });
      16 |

        at ${testInfo.outputPath('a.test.js')}:14:19

    Retry #1 ---------------------------------------------------------------------------------------

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 0
    Received: 1

      12 |       });
      13 |       test('failing test', async ({}) => {
    > 14 |         expect(1).toBe(0);
         |                   ^
      15 |       });
      16 |

        at ${testInfo.outputPath('a.test.js')}:14:19


<lineup><erase><lineup><erase>
  1 failed
    a.test.js:13:7 › failing test ==================================================================
  1 flaky
    a.test.js:10:7 › flaky test ====================================================================
  1 skipped
  1 passed`));
});

test('should work with non-tty', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('passing test', async ({}) => {
      });
      test.skip('skipped test', async ({}) => {
      });
      test('flaky test', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
      test('failing test', async ({}) => {
        expect(1).toBe(0);
      });
    `,
  }, { retries: '1', reporter: 'line', workers: '1' }, {
    FORCE_COLOR: '0',
    PW_TEST_DEBUG_REPORTERS: '1',
  });
  expect(result.exitCode).toBe(1);
  expect(trimLineEnds(result.output)).toContain(trimLineEnds(`
Running 4 tests using 1 worker
25% [1/4] Passed: 1 Flaky: 0 Failed: 0 Skipped: 0 (XXms)
50% [2/4] Passed: 1 Flaky: 0 Failed: 0 Skipped: 1 (XXms)
75% [3/4] Passed: 1 Flaky: 0 Failed: 0 Skipped: 1 (XXms)
99% [4/4] (retries) Passed: 1 Flaky: 1 Failed: 0 Skipped: 1 (XXms)
  1) a.test.js:10:7 › flaky test ===================================================================

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 0

       9 |       });
      10 |       test('flaky test', async ({}, testInfo) => {
    > 11 |         expect(testInfo.retry).toBe(1);
         |                                ^
      12 |       });
      13 |       test('failing test', async ({}) => {
      14 |         expect(1).toBe(0);

        at ${testInfo.outputPath('a.test.js')}:11:32


  2) a.test.js:13:7 › failing test =================================================================

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 0
    Received: 1

      12 |       });
      13 |       test('failing test', async ({}) => {
    > 14 |         expect(1).toBe(0);
         |                   ^
      15 |       });
      16 |

        at ${testInfo.outputPath('a.test.js')}:14:19

    Retry #1 ---------------------------------------------------------------------------------------

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 0
    Received: 1

      12 |       });
      13 |       test('failing test', async ({}) => {
    > 14 |         expect(1).toBe(0);
         |                   ^
      15 |       });
      16 |

        at ${testInfo.outputPath('a.test.js')}:14:19



  1 failed
    a.test.js:13:7 › failing test ==================================================================
  1 flaky
    a.test.js:10:7 › flaky test ====================================================================
  1 skipped
  1 passed`));
});

test('should respect tty width', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test('passing test', async ({}) => {
      });
      test.skip('skipped test', async ({}) => {
      });
      test('flaky test', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
      test('failing test', async ({}) => {
        expect(1).toBe(0);
      });
    `,
  }, { retries: '1', reporter: 'line', workers: '1' }, {
    PLAYWRIGHT_LIVE_TERMINAL: '1',
    FORCE_COLOR: '0',
    PWTEST_TTY_WIDTH: '30',
    PW_TEST_DEBUG_REPORTERS: '1',
  });
  expect(result.exitCode).toBe(1);
  const text = stripAnsi(result.output);
  expect(text).toContain(`a.test.js:6:7 › passing test`);
  expect(text).toContain(`25% [1/4] Passed: 1 Flaky: 0 F`);
  expect(text).not.toContain(`25% [1/4] Passed: 1 Flaky: 0 Fa`);
  expect(text).toContain(`a.test.js:10:7 › fl (retry #1)`);
  expect(text).toContain(`99% [4/4] (retries) Passed: 1 `);
  expect(text).not.toContain(`99% [4/4] (retries) Passed: 1 F`);
});

test('should spare status updates in non-tty mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      for (let i = 0; i < 300; i++) {
        test('test' + i, () => {});
      }
    `,
  }, { reporter: 'line', workers: '1' }, {
    FORCE_COLOR: '0',
    PW_TEST_DEBUG_REPORTERS: '1',
  });
  expect(result.exitCode).toBe(0);
  const lines = [`Running 300 tests using 1 worker`, `0% [1/300] Passed: 1 Flaky: 0 Failed: 0 Skipped: 0 (XXms)`];
  for (let i = 1; i <= 99; i++)
    lines.push(`${i}% [${3 * i - 1}/300] Passed: ${3 * i - 1} Flaky: 0 Failed: 0 Skipped: 0 (XXms)`);
  lines.push('');
  lines.push('  300 passed');
  expect(trimLineEnds(result.output)).toContain(lines.join('\n'));
});
