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
  }, { retries: '1', reporter: 'list', workers: '1' }, {
    PLAYWRIGHT_LIVE_TERMINAL: '1',
    FORCE_COLOR: '0',
    PW_TEST_DEBUG_REPORTERS: '1',
  });
  expect(result.exitCode).toBe(1);
  expect(trimLineEnds(result.output)).toContain(trimLineEnds(`Running 4 tests using 1 worker

<erase stats>
     a.test.js:6:12 › skipped test
[0/4]  Passed: 0  Flaky: 0  Failed: 0  Skipped: 0  (XXms)
<erase stats>
0 :   -  a.test.js:6:12 › skipped test
[1/4]  Passed: 0  Flaky: 0  Failed: 0  Skipped: 1  (XXms)
<erase stats>
     a.test.js:8:7 › flaky test
[1/4]  Passed: 0  Flaky: 0  Failed: 0  Skipped: 1  (XXms)
<erase stats>
1 :   x  a.test.js:8:7 › flaky test (XXms)
[2/4]  Passed: 0  Flaky: 0  Failed: 0  Skipped: 1  (XXms)
<erase stats>
     a.test.js:8:7 › flaky test (retry #1)
[2/4]  Passed: 0  Flaky: 0  Failed: 0  Skipped: 1  (XXms)
<erase stats>
2 :   ok a.test.js:8:7 › flaky test (retry #1) (XXms)
[3/4]  Passed: 0  Flaky: 1  Failed: 0  Skipped: 1  (XXms)
<erase stats>
     a.test.js:11:7 › passing test
[3/4]  Passed: 0  Flaky: 1  Failed: 0  Skipped: 1  (XXms)
<erase stats>
3 :   ok a.test.js:11:7 › passing test (XXms)
[4/4+retries]  Passed: 1  Flaky: 1  Failed: 0  Skipped: 1  (XXms)
<erase stats>
     a.test.js:13:7 › failing test
[4/4+retries]  Passed: 1  Flaky: 1  Failed: 0  Skipped: 1  (XXms)
<erase stats>
4 :   x  a.test.js:13:7 › failing test (XXms)
[5/4+retries]  Passed: 1  Flaky: 1  Failed: 0  Skipped: 1  (XXms)
<erase stats>
     a.test.js:13:7 › failing test (retry #1)
[5/4+retries]  Passed: 1  Flaky: 1  Failed: 0  Skipped: 1  (XXms)
<erase stats>
5 :   x  a.test.js:13:7 › failing test (retry #1) (XXms)
[6/4+retries]  Passed: 1  Flaky: 1  Failed: 1  Skipped: 1  (XXms)
<erase stats>


  1) a.test.js:13:7 › failing test =================================================================

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

  2) a.test.js:8:7 › flaky test ====================================================================

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
  }, { retries: '1', reporter: 'list', workers: '1' }, {
    FORCE_COLOR: '0',
    PW_TEST_DEBUG_REPORTERS: '1',
  });
  expect(result.exitCode).toBe(1);
  expect(trimLineEnds(result.output)).toContain(trimLineEnds(`Running 4 tests using 1 worker

  -  a.test.js:6:12 › skipped test
  x  a.test.js:8:7 › flaky test (XXms)
  ok a.test.js:8:7 › flaky test (retry #1) (XXms)
  ok a.test.js:11:7 › passing test (XXms)
  x  a.test.js:13:7 › failing test (XXms)
  x  a.test.js:13:7 › failing test (retry #1) (XXms)


  1) a.test.js:13:7 › failing test =================================================================

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

  2) a.test.js:8:7 › flaky test ====================================================================

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


  1 failed
    a.test.js:13:7 › failing test ==================================================================
  1 flaky
    a.test.js:8:7 › flaky test =====================================================================
  1 skipped
  1 passed`));
});

test('render steps', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('passes', async ({}) => {
        await test.step('outer 1.0', async () => {
          await test.step('inner 1.1', async () => {});
          await test.step('inner 1.1', async () => {});
        });
        await test.step('outer 2.0', async () => {
          await test.step('inner 2.1', async () => {});
          await test.step('inner 2.1', async () => {});
        });
      });
    `,
  }, { reporter: 'list' }, { PW_TEST_DEBUG_REPORTERS: '1', PLAYWRIGHT_LIVE_TERMINAL: '1' });
  const text = stripAnsi(result.output);
  const lines = text.split('\n').filter(l => l.startsWith('0 :'));
  lines.pop(); // Remove last item that contains [v] and time in ms.
  expect(lines).toEqual([
    '0 :      a.test.ts:6:7 › passes › outer 1.0',
    '0 :      a.test.ts:6:7 › passes › outer 1.0 › inner 1.1',
    '0 :      a.test.ts:6:7 › passes › outer 1.0',
    '0 :      a.test.ts:6:7 › passes › outer 1.0 › inner 1.1',
    '0 :      a.test.ts:6:7 › passes › outer 1.0',
    '0 :      a.test.ts:6:7 › passes',
    '0 :      a.test.ts:6:7 › passes › outer 2.0',
    '0 :      a.test.ts:6:7 › passes › outer 2.0 › inner 2.1',
    '0 :      a.test.ts:6:7 › passes › outer 2.0',
    '0 :      a.test.ts:6:7 › passes › outer 2.0 › inner 2.1',
    '0 :      a.test.ts:6:7 › passes › outer 2.0',
    '0 :      a.test.ts:6:7 › passes',
  ]);
});

test('should truncate long test names', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'foo' },
      ] };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('failure in very long name', async ({}) => {
        expect(1).toBe(0);
      });
      test('passes', async ({}) => {
      });
      test('passes 2 long name', async () => {
      });
      test.skip('skipped very long name', async () => {
      });
    `,
  }, { reporter: 'list', retries: 0 }, {
    PLAYWRIGHT_LIVE_TERMINAL: '1',
    FORCE_COLOR: '0',
    PWTEST_TTY_WIDTH: 30,
    PW_TEST_DEBUG_REPORTERS: '1'
  });
  expect(result.exitCode).toBe(1);

  expect(trimLineEnds(result.output)).toContain(trimLineEnds(`Running 4 tests using 1 worker

<erase stats>
     …ailure in very long name
…Failed: 0  Skipped: 0  (XXms)
<erase stats>
0 :   x  …in very long name (XXms)
…Failed: 1  Skipped: 0  (XXms)
<erase stats>
     …› a.test.ts:9:7 › passes
…Failed: 1  Skipped: 0  (XXms)
<erase stats>
1 :   ok …t.ts:9:7 › passes (XXms)
…Failed: 1  Skipped: 0  (XXms)
<erase stats>
     …1:7 › passes 2 long name
…Failed: 1  Skipped: 0  (XXms)
<erase stats>
2 :   ok …asses 2 long name (XXms)
…Failed: 1  Skipped: 0  (XXms)
<erase stats>
     …› skipped very long name
…Failed: 1  Skipped: 0  (XXms)
<erase stats>
3 :   -  …› skipped very long name
…Failed: 1  Skipped: 1  (XXms)
<erase stats>`));
});
