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

import { test, expect, stripAnsi, trimLineEnds } from './playwright-test-fixtures';

test('should work with tty', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.skip('skipped test', async ({}) => {
      });
      test('flaky test', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
      test('passing test', async ({}) => {
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

<lineup><erase>[1/4] a.test.js:6:12 › skipped test
<lineup><erase>[2/4] a.test.js:8:7 › flaky test
<lineup><erase>[3/4] a.test.js:8:7 › flaky test (retry #1)
<lineup><erase>  1) a.test.js:8:7 › flaky test ====================================================================

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 0

       7 |       });
       8 |       test('flaky test', async ({}, testInfo) => {
    >  9 |         expect(testInfo.retry).toBe(1);
         |                                ^
      10 |       });
      11 |       test('passing test', async ({}) => {
      12 |       });

        at ${testInfo.outputPath('a.test.js')}:9:32


<lineup><erase>[4/4] a.test.js:11:7 › passing test
<lineup><erase>[5/4] (retries) a.test.js:13:7 › failing test
<lineup><erase>[6/4] (retries) a.test.js:13:7 › failing test (retry #1)
<lineup><erase>  2) a.test.js:13:7 › failing test =================================================================

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


<lineup><erase>
  1 failed
    a.test.js:13:7 › failing test ==================================================================
  1 flaky
    a.test.js:8:7 › flaky test =====================================================================
  1 skipped
  1 passed`));
});

test('should work with non-tty', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'a.test.js': `
      const { test } = pwt;
      test.skip('skipped test', async ({}) => {
      });
      test('flaky test', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
      test('passing test', async ({}) => {
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
  expect(trimLineEnds(result.output)).toContain(trimLineEnds(`Running 4 tests using 1 worker
[25%] a.test.js:6:12 › skipped test
[50%] a.test.js:8:7 › flaky test
[75%] a.test.js:8:7 › flaky test (retry #1)
  1) a.test.js:8:7 › flaky test ====================================================================

    Error: expect(received).toBe(expected) // Object.is equality

    Expected: 1
    Received: 0

       7 |       });
       8 |       test('flaky test', async ({}, testInfo) => {
    >  9 |         expect(testInfo.retry).toBe(1);
         |                                ^
      10 |       });
      11 |       test('passing test', async ({}) => {
      12 |       });

        at ${testInfo.outputPath('a.test.js')}:9:32


[99%] a.test.js:11:7 › passing test
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


[100%]

  1 failed
    a.test.js:13:7 › failing test ==================================================================
  1 flaky
    a.test.js:8:7 › flaky test =====================================================================
  1 skipped
  1 passed`));
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
  const lines = [`Running 300 tests using 1 worker`, `[0%] a.test.js:7:9 › test0`];
  for (let i = 1; i <= 99; i++)
    lines.push(`[${i}%] a.test.js:7:9 › test${3 * i - 2}`);
  lines.push('[100%]');
  lines.push('');
  lines.push('  300 passed');
  expect(trimLineEnds(result.output)).toContain(lines.join('\n'));
});

test('should print output', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      const { test } = pwt;
      test('foobar', async ({}, testInfo) => {
        process.stdout.write('one');
        process.stdout.write('two');
        console.log('full-line');
      });
    `
  }, { reporter: 'line' });
  expect(result.exitCode).toBe(0);
  expect(stripAnsi(result.output)).toContain([
    'a.spec.ts:6:7 › foobar',
    'one',
    '',
    'two',
    '',
    'full-line',
  ].join('\n'));
});
