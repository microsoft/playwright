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

// Given '%%begin:<name>' and '%%end:<name>' lines, returns pairs from the
// `conflicts` list that were running at the same time.
function conflictingOverlaps(lines: string[], conflicts: [string, string][]): [string, string][] {
  const running = new Set<string>();
  const overlaps: [string, string][] = [];
  for (const line of lines) {
    const [kind, name] = line.split(':');
    if (kind === 'begin') {
      for (const [x, y] of conflicts) {
        if ((name === x && running.has(y)) || (name === y && running.has(x)))
          overlaps.push([x, y]);
      }
      running.add(name);
    } else if (kind === 'end') {
      running.delete(name);
    }
  }
  return overlaps;
}

const lockedTest = (name: string, delay: number, lock?: string | string[]) => `
  test('${name}'${lock !== undefined ? `, { lock: ${JSON.stringify(lock)} }` : ''}, async () => {
    console.log('\\n%%begin:${name}');
    await new Promise(f => setTimeout(f, ${delay}));
    console.log('\\n%%end:${name}');
  });
`;

test('should not run tests with the same lock at the same time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test1', 1000, 'shared')}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test2', 1000, 'shared')}
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2']])).toEqual([]);
});

test('should run tests with different locks at the same time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'helper.ts': `
      import fs from 'fs';
      import path from 'path';
      export async function signalAndWait(signal: string, waitFor: string) {
        fs.mkdirSync(process.env.SIGNAL_DIR, { recursive: true });
        fs.writeFileSync(path.join(process.env.SIGNAL_DIR, signal), '');
        while (!fs.existsSync(path.join(process.env.SIGNAL_DIR, waitFor)))
          await new Promise(f => setTimeout(f, 100));
      }
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      import { signalAndWait } from './helper';
      test('test1', { lock: 'lock-a' }, async () => {
        // Only finishes when both tests run at the same time.
        await signalAndWait('a.txt', 'b.txt');
      });
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      import { signalAndWait } from './helper';
      test('test2', { lock: 'lock-b' }, async () => {
        await signalAndWait('b.txt', 'a.txt');
      });
    `,
  }, { workers: 2 }, { SIGNAL_DIR: test.info().outputDir });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should not run tests with the same lock from different projects at the same time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        projects: [
          { name: 'project1' },
          { name: 'project2' },
        ],
      };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('test1', { lock: 'shared' }, async ({}, testInfo) => {
        console.log('\\n%%begin:' + testInfo.project.name);
        await new Promise(f => setTimeout(f, 1000));
        console.log('\\n%%end:' + testInfo.project.name);
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['project1', 'project2']])).toEqual([]);
});

test('should support locks declared on a describe group', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.describe('locked suite', { lock: 'shared' }, () => {
        ${lockedTest('test1', 1000)}
        ${lockedTest('test2', 1000)}
      });
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2']])).toEqual([]);
});

test('should support multiple locks on a single test', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test1', 1000, ['lock-a', 'lock-b'])}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test2', 1000, 'lock-a')}
    `,
    'c.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test3', 1000, 'lock-b')}
    `,
  }, { workers: 3 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2'], ['test1', 'test3']])).toEqual([]);
});

test('should hold the lock for the whole file group in default mode', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('a1', 500, 'shared')}
      ${lockedTest('a2', 500)}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('b1', 1000, 'shared')}
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
  // The lock declared on a1 covers the whole file, including a2.
  expect(conflictingOverlaps(result.outputLines, [['a1', 'b1'], ['a2', 'b1']])).toEqual([]);
});

test('should respect locks on tests from a parallel suite with beforeAll hooks', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { fullyParallel: true };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      test.beforeAll(() => {
        console.log('\\n%%beforeAll');
      });
      test('plain1', async () => {});
      test('plain2', async () => {});
      ${lockedTest('test1', 1000, 'shared')}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test2', 1000, 'shared')}
    `,
  }, { workers: 2 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(4);
  expect(result.output).toContain('%%beforeAll');
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2']])).toEqual([]);
});

test('should not count waiting for a lock towards the test timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { timeout: 3000 };
    `,
    'a.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test1', 2000, 'shared')}
    `,
    'b.test.ts': `
      import { test } from '@playwright/test';
      ${lockedTest('test2', 2000, 'shared')}
    `,
  }, { workers: 2 });
  // Together the tests exceed the 3000ms timeout; waiting for the lock is not test time.
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(conflictingOverlaps(result.outputLines, [['test1', 'test2']])).toEqual([]);
});

test('should validate lock in test details', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test } from '@playwright/test';
      test('test1', { lock: 42 }, async () => {});
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('details.lock');
});
