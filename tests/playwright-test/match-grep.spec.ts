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

const files = {
  'match-grep/b.test.ts': `
    import { test, expect } from '@playwright/test';
    test('test AA', () => {
      expect(1 + 1).toBe(2);
    });

    test('test BB', () => {
      expect(1 + 1).toBe(2);
    });

    test('test CC', () => {
      expect(1 + 1).toBe(2);
    });
  `,
  'match-grep/fdir/c.test.ts': `
    import { test, expect } from '@playwright/test';
    test('test AA', () => {
      expect(1 + 1).toBe(2);
    });

    test('test BB', () => {
      expect(1 + 1).toBe(2);
    });

    test('test CC', () => {
      expect(1 + 1).toBe(2);
    });
  `,
  'match-grep/adir/a.test.ts': `
    import { test, expect } from '@playwright/test';
    test('test AA', () => {
      expect(1 + 1).toBe(2);
    });

    test('test BB', () => {
      expect(1 + 1).toBe(2);
    });

    test('test CC', () => {
      expect(1 + 1).toBe(2);
    });
  `,
};

test('should grep test name', async ({ runInlineTest }) => {
  const result = await runInlineTest(files, { 'grep': 'test [A-B]' });
  expect(result.passed).toBe(6);
  expect(result.skipped).toBe(0);
  expect(result.exitCode).toBe(0);
});

test('should grep test name with regular expression', async ({ runInlineTest }) => {
  const result = await runInlineTest(files, { 'grep': '/B$/' });
  expect(result.passed).toBe(3);
  expect(result.skipped).toBe(0);
  expect(result.exitCode).toBe(0);
});

test('should grep test name with regular expression and a space', async ({ runInlineTest }) => {
  const result = await runInlineTest(files, { 'grep': '/TesT c/i' });
  expect(result.passed).toBe(3);
  expect(result.exitCode).toBe(0);
});

test('should grep invert test name', async ({ runInlineTest }) => {
  const result = await runInlineTest(files, { 'grep-invert': 'BB' });
  expect(result.passed).toBe(6);
  expect(result.skipped).toBe(0);
  expect(result.exitCode).toBe(0);
});

test('should be case insensitive by default', async ({ runInlineTest }) => {
  const result = await runInlineTest(files, { 'grep': 'TesT Cc' });
  expect(result.passed).toBe(3);
  expect(result.skipped).toBe(0);
  expect(result.exitCode).toBe(0);
});

test('should be case sensitive by default with a regex', async ({ runInlineTest }) => {
  const result = await runInlineTest(files, { 'grep': '/TesT Cc/' });
  expect(result.passed).toBe(0);
});

test('excluded tests should not be shown in UI', async ({ runInlineTest, runTSC }) => {
  const result = await runInlineTest(files, { 'grep': 'Test AA' });
  expect(result.passed).toBe(3);
});
