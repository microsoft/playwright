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
import fs from 'fs';
import path from 'path';

export function listFiles(dir: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    result.push(entry.name);
    if (entry.isDirectory())
      result.push(...listFiles(path.join(dir, entry.name)).map(x => '  ' + x));
  }
  return result;
}

test('soft expects should compile', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', () => {
        test.expect.soft(1+1).toBe(3);
        test.expect.soft(1+1, 'custom error message').toBe(3);
        test.expect.soft(1+1, { message: 'custom error message' }).toBe(3);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('soft expects should work', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', () => {
        test.expect.soft(1+1).toBe(3);
        console.log('%% woof-woof');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.outputLines).toEqual(['woof-woof']);
});

test('should report a mixture of soft and non-soft errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', ({}) => {
        test.expect.soft(1+1, 'one plus one').toBe(3);
        test.expect.soft(2*2, 'two times two').toBe(5);
        test.expect(3/3, 'three div three').toBe(7);
        test.expect.soft(6-4, { message: 'six minus four' }).toBe(3);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: one plus one');
  expect(result.output).toContain('Error: two times two');
  expect(result.output).toContain('Error: three div three');
  expect(result.output).not.toContain('Error: six minus four');
});

test('testInfo should contain all soft expect errors', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', ({}, testInfo) => {
        test.expect.soft(1+1, 'one plus one').toBe(3);
        test.expect.soft(2*2, 'two times two').toBe(5);
        test.expect(testInfo.errors.length, 'must be exactly two errors').toBe(2);
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: one plus one');
  expect(result.output).toContain('Error: two times two');
  expect(result.output).not.toContain('Error: must be exactly two errors');
});

test.describe('screenshots on soft expect ', async () => {
  test('should make screenshot on soft expect failure', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
        export default {
          use: { screenshot: 'only-on-failure' }
       };
    `,
      'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({ page }) => {
        await page.goto('https://playwright.dev/');
        await expect.soft(page, { screenshotOnSoftFailure: true }).toHaveTitle(/Playwrighttt/);

        await page.getByRole('link', { name: 'Get started' }).click();
        await expect.soft(page, { screenshotOnSoftFailure: true }).toHaveURL(/.*introlololo/);
      });
    `
    });
    expect(result.exitCode).toBe(1);

    expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
      'a-should-work',
      '  test-failed-1.png',
      '  test-failed-2.png',
      '  test-failed-3.png'
    ]);
  });

  test('should not make screenshot on soft expect failure if screenshotOnSoftFailure is false', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
        export default {
          use: { screenshot: 'only-on-failure' }
       };
    `,
      'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({ page }) => {
        await page.goto('https://playwright.dev/');
        await expect.soft(page).toHaveTitle(/Playwrighttt/);

        await page.getByRole('link', { name: 'Get started' }).click();
        await expect.soft(page, { screenshotOnSoftFailure: false }).toHaveURL(/.*introlololo/);
      });
    `
    });
    expect(result.exitCode).toBe(1);

    expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
      'a-should-work',
      '  test-failed-1.png',
    ]);
  });

  test('should make screenshot on soft expect failure is enabled in config', async ({ runInlineTest }, testInfo) => {
    const result = await runInlineTest({
      'playwright.config.ts': `
        export default {
          expect: {
            soft: { screenshotOnSoftFailure: true }
          },
          use: { screenshot: 'only-on-failure' }
       };
    `,
      'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', async ({ page }) => {
        await page.goto('https://playwright.dev/');
        await expect.soft(page).toHaveTitle(/Playwrighttt/);

        await page.getByRole('link', { name: 'Get started' }).click();
        await expect.soft(page).toHaveURL(/.*introlololo/);
      });
    `
    });
    expect(result.exitCode).toBe(1);

    expect(listFiles(testInfo.outputPath('test-results'))).toEqual([
      'a-should-work',
      '  test-failed-1.png',
      '  test-failed-2.png',
      '  test-failed-3.png'
    ]);
  });
});