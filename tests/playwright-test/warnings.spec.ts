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

const warningSnippet = 'Some async calls were not awaited';

test.describe.configure({ mode: 'parallel' });

test.describe('await', () => {
  test('should not care about non-API promises', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test } from '@playwright/test';
        test('test', () => {
          new Promise(() => {});
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain(warningSnippet);
  });

  test('should warn about missing await on expects when failing', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('custom test name', async ({ page }) => {
          expect(page.locator('div')).toHaveText('A', { timeout: 100 });
        });
      `
    });
    expect(exitCode).toBe(1);
    expect(stdout).toContain(warningSnippet);
    expect(stdout).toContain('the test');
    expect(stdout).toContain('custom test name');
  });

  test('should warn about missing await on expects when passing', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          expect(page.locator('div')).toHaveText('A');
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain(warningSnippet);
  });

  test('should not warn when not missing await on expects when failing', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await expect(page.locator('div')).toHaveText('A', { timeout: 100 });
        });
      `
    });
    expect(exitCode).toBe(1);
    expect(stdout).not.toContain(warningSnippet);
  });

  test('should not warn when not missing await on expects when passing', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          await expect(page.locator('div')).toHaveText('A');
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain(warningSnippet);
  });

  test('should not warn when using then on expects when passing', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          expect(page.locator('div')).toHaveText('A').then(() => {});
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain(warningSnippet);
  });

  test('should warn about missing await on reject', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          expect(Promise.reject(new Error('foo'))).rejects.toThrow('foo');
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain(warningSnippet);
  });

  test('should warn about missing await on reject.not', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          expect(Promise.reject(new Error('foo'))).rejects.not.toThrow('foo');
        });
      `
    });
    expect(exitCode).toBe(1);
    expect(stdout).toContain(warningSnippet);
  });

  test('should warn about missing await on test.step', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          test.step('step', () => {});
          await expect(page.locator('div')).toHaveText('A');
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain(warningSnippet);
  });

  test('should not warn when not missing await on test.step', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          await test.step('step', () => {});
          await expect(page.locator('div')).toHaveText('A');
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(stdout).not.toContain(warningSnippet);
  });

  test('should warn about missing await on test.step.skip', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          test.step.skip('step', () => {});
          await expect(page.locator('div')).toHaveText('A');
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain(warningSnippet);
  });

  test('traced promise should be instanceof Promise', async ({ runInlineTest }) => {
    const { exitCode } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          const expectPromise = expect(page.locator('div')).toHaveText('A');
          expect(expectPromise instanceof Promise).toBeTruthy();
        });
      `
    });
    expect(exitCode).toBe(0);
  });

  test('should warn about missing await in before hooks', async ({ runInlineTest }) => {
    const group = ['beforeAll', 'beforeEach'];
    for (const hook of group) {
      await test.step(hook, async () => {
        const { exitCode, stdout } = await runInlineTest({
          'a.test.ts': `
            import { test, expect } from '@playwright/test';
            let page;
            test.${hook}(async ({ browser }) => {
              page = await browser.newPage();
              await page.setContent('<div>A</div>');
              expect(page.locator('div')).toHaveText('A');
            });
            test('test ${hook}', async () => {
              await expect(page.locator('div')).toBeVisible();
            });
          `
        });

        expect(exitCode).toBe(0);
        expect(stdout).toContain(warningSnippet);
        expect(stdout).toContain(`${group[0]}/${group[1]} hooks`);
      });
    }
  });

  test.describe('should warn about missing await in after hooks', () => {
    const group = ['afterAll', 'afterEach'];
    for (const hook of group) {
      test(hook, async ({ runInlineTest }) => {
        const { exitCode, stdout } = await runInlineTest({
          'a.test.ts': `
            import { test, expect } from '@playwright/test';
            let page;
            test('test ${hook}', async ({ browser }) => {
              await expect(Promise.resolve()).resolves.toBe(undefined);
            });
            test.${hook}(async () => {
              expect(Promise.resolve()).resolves.toBe(undefined);
            });
          `
        });

        expect(exitCode).toBe(0);
        expect(stdout).toContain(warningSnippet);
        expect(stdout).toContain(`${group[0]}/${group[1]} hooks`);
      });
    }
  });

  test('should warn about missing await across hooks and test', async ({ runInlineTest }) => {
    const { exitCode, stdout } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test.beforeAll(async () => {
          expect(Promise.resolve()).resolves.toBe(undefined);
        });
        test('test', async () => {
          expect(Promise.resolve()).resolves.toBe(undefined);
        });
        test.afterEach(async () => {
          expect(Promise.resolve()).resolves.toBe(undefined);
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(stdout).toContain(`${warningSnippet} by the end of beforeAll/beforeEach hooks.`);
    expect(stdout).toContain(`${warningSnippet} by the end of the test.`);
    expect(stdout).toContain(`${warningSnippet} by the end of afterAll/afterEach hooks.`);
  });
});
