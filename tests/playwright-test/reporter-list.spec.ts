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

import { test, expect, stripAnsi } from './playwright-test-fixtures';

const DOES_NOT_SUPPORT_UTF8_IN_TERMINAL = process.platform === 'win32' && process.env.TERM_PROGRAM !== 'vscode' && !process.env.WT_SESSION;
const POSITIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'ok' : '✓ ';
const NEGATIVE_STATUS_MARK = DOES_NOT_SUPPORT_UTF8_IN_TERMINAL ? 'x ' : '✘ ';

test('render each test with project name', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { projects: [
        { name: 'foo' },
        { name: 'bar' },
      ] };
    `,
    'a.test.ts': `
      const { test } = pwt;
      test('fails', async ({}) => {
        expect(1).toBe(0);
      });
      test('passes', async ({}) => {
        expect(0).toBe(0);
      });
      test.skip('skipped', async () => {
      });
    `,
  }, { reporter: 'list' });
  const text = stripAnsi(result.output);

  expect(text).toContain(`${NEGATIVE_STATUS_MARK} [foo] › a.test.ts:6:7 › fails`);
  expect(text).toContain(`${NEGATIVE_STATUS_MARK} [bar] › a.test.ts:6:7 › fails`);
  expect(text).toContain(`${POSITIVE_STATUS_MARK} [foo] › a.test.ts:9:7 › passes`);
  expect(text).toContain(`${POSITIVE_STATUS_MARK} [bar] › a.test.ts:9:7 › passes`);
  expect(text).toContain(`-  [foo] › a.test.ts:12:12 › skipped`);
  expect(text).toContain(`-  [bar] › a.test.ts:12:12 › skipped`);
  expect(result.exitCode).toBe(1);
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
  }, { reporter: 'list' }, { PW_TEST_DEBUG_REPORTERS: '1', PWTEST_TTY_WIDTH: '80' });
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

test('render retries', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      const { test } = pwt;
      test('flaky', async ({}, testInfo) => {
        expect(testInfo.retry).toBe(1);
      });
    `,
  }, { reporter: 'list', retries: '1' }, { PW_TEST_DEBUG_REPORTERS: '1', PWTEST_TTY_WIDTH: '80' });
  const text = stripAnsi(result.output);
  const lines = text.split('\n').filter(l => l.startsWith('0 :') || l.startsWith('1 :')).map(l => l.replace(/[\dm]+s/, 'XXms'));

  expect(lines).toEqual([
    `0 :   ${NEGATIVE_STATUS_MARK} a.test.ts:6:7 › flaky (XXms)`,
    `1 :   ${POSITIVE_STATUS_MARK} a.test.ts:6:7 › flaky (retry #1) (XXms)`,
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
      test('fails very long name', async ({}) => {
        expect(1).toBe(0);
      });
      test('passes', async ({}) => {
      });
      test('passes 2 long name', async () => {
      });
      test.skip('skipped very long name', async () => {
      });
    `,
  }, { reporter: 'list', retries: 0 }, { PWTEST_TTY_WIDTH: 50 });
  const text = stripAnsi(result.output);

  expect(text).toContain(`${NEGATIVE_STATUS_MARK} [foo] › a.test.ts:6:7 › fails very`);
  expect(text).not.toContain(`${NEGATIVE_STATUS_MARK} [foo] › a.test.ts:6:7 › fails very long name (`);
  expect(text).toContain(`${POSITIVE_STATUS_MARK} [foo] › a.test.ts:9:7 › passes (`);
  expect(text).toContain(`${POSITIVE_STATUS_MARK} [foo] › a.test.ts:11:7 › passes 2 long`);
  expect(text).not.toContain(`${POSITIVE_STATUS_MARK} [foo] › a.test.ts:11:7 › passes 2 long name (`);
  expect(text).toContain(`-  [foo] › a.test.ts:13:12 › skipped very long n`);
  expect(text).not.toContain(`-  [foo] › a.test.ts:13:12 › skipped very long na`);
  expect(result.exitCode).toBe(1);
});
