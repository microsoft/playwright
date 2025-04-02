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

const description = 'Some async calls were not awaited by the end of the test. This can cause flakiness.';

test.describe.configure({ mode: 'parallel' });

test.describe('await', () => {
  test('should not care about non-API promises', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
      'a.test.ts': `
        import { test } from '@playwright/test';
        test('test', () => {
          new Promise(() => {});
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(results[0].annotations).toEqual([]);
  });

  test('should warn about missing await on expects when failing', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('custom test name', async ({ page }) => {
          expect(page.locator('div')).toHaveText('A', { timeout: 100 });
          // Timeout to make sure the expect actually gets processed
          await new Promise(f => setTimeout(f, 1000));
        });
      `
    });
    expect(exitCode).toBe(1);
    expect(results[0].annotations).toEqual([{ type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 4, column: 39 } }]);
  });

  test('should warn about missing await on expects when passing', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          expect(page.locator('div')).toHaveText('A');
          await new Promise(f => setTimeout(f, 1000));
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(results[0].annotations).toEqual([{ type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 5, column: 39 } }]);
  });

  test('should not warn when not missing await on expects when failing', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await expect(page.locator('div')).toHaveText('A', { timeout: 100 });
        });
      `
    });
    expect(exitCode).toBe(1);
    expect(results[0].annotations).toEqual([]);
  });

  test('should not warn when not missing await on expects when passing', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          await expect(page.locator('div')).toHaveText('A');
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(results[0].annotations).toEqual([]);
  });

  test('should not warn when using then on expects when passing', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          expect(page.locator('div')).toHaveText('A').then(() => {});
          await new Promise(f => setTimeout(f, 1000));
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(results[0].annotations).toEqual([]);
  });

  test('should warn about missing await on reject', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          expect(Promise.reject(new Error('foo'))).rejects.toThrow('foo');
          await new Promise(f => setTimeout(f, 1000));
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(results[0].annotations).toEqual([{ type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 4, column: 60 } }]);
  });

  test('should warn about missing await on reject.not', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          expect(Promise.reject(new Error('foo'))).rejects.not.toThrow('foo');
          await new Promise(f => setTimeout(f, 1000));
        });
      `
    });
    expect(exitCode).toBe(1);
    expect(results[0].annotations).toEqual([{ type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 4, column: 64 } }]);
  });

  test('should warn about missing await on test.step', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
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
    expect(results[0].annotations).toEqual([{ type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 5, column: 16 } }]);
  });

  test('should not warn when not missing await on test.step', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
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
    expect(results[0].annotations).toEqual([]);
  });

  test('should warn about missing await on test.step.skip', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
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
    expect(results[0].annotations).toEqual([{ type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 5, column: 21 } }]);
  });

  test('traced promise should be instanceof Promise', async ({ runInlineTest }) => {
    const { exitCode } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test('test', async ({ page }) => {
          await page.setContent('<div>A</div>');
          const expectPromise = expect(page.locator('div')).toHaveText('A');
          expect(expectPromise instanceof Promise).toBeTruthy();
          await new Promise(f => setTimeout(f, 1000));
        });
      `
    });
    expect(exitCode).toBe(0);
  });

  test('should warn about missing await in before hooks', async ({ runInlineTest }) => {
    const group = ['beforeAll', 'beforeEach'];
    for (const hook of group) {
      await test.step(hook, async () => {
        const { exitCode, results } = await runInlineTest({
          'a.test.ts': `
            import { test, expect } from '@playwright/test';
            let page;
            test.${hook}(async ({ browser }) => {
              page = await browser.newPage();
              await page.setContent('<div>A</div>');
              expect(page.locator('div')).toHaveText('A');
              await new Promise(f => setTimeout(f, 1000));
            });
            test('test ${hook}', async () => {
              await expect(page.locator('div')).toBeVisible();
            });
          `
        });

        expect(exitCode).toBe(0);
        expect(results[0].annotations).toEqual([{ type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 7, column: 43 } }]);
      });
    }
  });

  test.describe('should warn about missing await in after hooks', () => {
    const group = ['afterAll', 'afterEach'];
    for (const hook of group) {
      test(hook, async ({ runInlineTest }) => {
        const { exitCode, results } = await runInlineTest({
          'a.test.ts': `
            import { test, expect } from '@playwright/test';
            let page;
            test('test ${hook}', async ({ browser }) => {
              await expect(Promise.resolve()).resolves.toBe(undefined);
            });
            test.${hook}(async () => {
              expect(Promise.resolve()).resolves.toBe(undefined);
              await new Promise(f => setTimeout(f, 1000));
            });
          `
        });

        expect(exitCode).toBe(0);
        expect(results[0].annotations).toEqual([{ type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 8, column: 50 } }]);
      });
    }
  });

  test('should warn about missing await across hooks and test', async ({ runInlineTest }) => {
    const { exitCode, results } = await runInlineTest({
      'a.test.ts': `
        import { test, expect } from '@playwright/test';
        test.beforeAll(async () => {
          expect(Promise.resolve()).resolves.toBe(undefined);
          await new Promise(f => setTimeout(f, 1000));
        });
        test('test', async () => {
          expect(Promise.resolve()).resolves.toBe(undefined);
          await new Promise(f => setTimeout(f, 1000));
        });
        test.afterEach(async () => {
          expect(Promise.resolve()).resolves.toBe(undefined);
          await new Promise(f => setTimeout(f, 1000));
        });
      `
    });
    expect(exitCode).toBe(0);
    expect(results[0].annotations).toEqual([
      { type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 4, column: 46 } },
      { type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 8, column: 46 } },
      { type: 'warning', description, location: { file: expect.stringMatching(/a\.test\.ts$/), line: 12, column: 46 } },
    ]);
  });
});
