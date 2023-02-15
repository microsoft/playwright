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

test('should retry predicate', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should toPass sync predicate', async () => {
        let i = 0;
        await test.expect(() => {
          expect(++i).toBe(3);
        }).toPass();
        expect(i).toBe(3);
      });
      test('should toPass async predicate', async () => {
        let i = 0;
        await test.expect(async () => {
          await new Promise(x => setTimeout(x, 50));
          expect(++i).toBe(3);
        }).toPass();
        expect(i).toBe(3);
      });
      test('should retry expect.soft assertions', async () => {
        let i = 0;
        await test.expect(() => {
          expect.soft(++i).toBe(3);
        }).toPass();
        expect(i).toBe(3);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should respect timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        await test.expect(() => {
          expect(1).toBe(2);
        }).toPass({ timeout: 100 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Timeout 100ms exceeded while waiting on the predicate');
  expect(result.output).toContain('Received: 1');
  expect(result.output).toContain(`
  4 |         await test.expect(() => {
  `.trim());
});

test('should not fail when used with web-first assertion', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async ({ page }) => {
        let i = 0;
        await test.expect(async () => {
          if (++i < 3)
            await expect(page.locator('body')).toHaveText('foo', { timeout: 1 });
        }).toPass();
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should support .not predicate', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should pass', async ({ page }) => {
        let i = 0;
        await test.expect(() => {
          expect(++i).toBeLessThan(3);
        }).not.toPass();
        expect(i).toBe(3);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect interval', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        let probes = 0;
        const startTime = Date.now();
        await test.expect(() => {
          ++probes;
          expect(1).toBe(2);
        }).toPass({ timeout: 1000, intervals: [0, 10000] }).catch(() => {});
        // Probe at 0 and epsilon.
        expect(probes).toBe(2);
        expect(Date.now() - startTime).toBeLessThan(5000);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should compile', async ({ runTSC }) => {
  const result = await runTSC({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should poll sync predicate', async ({ page }) => {
        let i = 0;
        test.expect(() => ++i).toPass();
        test.expect(() => ++i, 'message').toPass();
        test.expect(() => ++i, { message: 'message' }).toPass();
        test.expect(() => ++i).toPass({ timeout: 100 });
        test.expect(() => ++i, { message: 'message' }).toPass({ timeout: 100 });
        test.expect(async () => {
          await new Promise(x => setTimeout(x, 50));
          return ++i;
        }).toPass();
        test.expect(() => Promise.resolve(++i)).toPass();
      });
    `
  });
  expect(result.exitCode).toBe(0);
});

test('should use custom message', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail with custom message', async () => {
        await test.expect(() => {
          expect(1).toBe(3);
        }, 'Custom message').toPass({ timeout: 1 });
      });
    `
  });
  expect(result.output).toContain('Error: Custom message');
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('should swallow all soft errors inside toPass matcher, if successful', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20437' });

  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should respect soft', async () => {
        expect.soft('before-toPass').toBe('zzzz');
        let i = 0;
        await test.expect(() => {
          ++i;
          expect.soft('inside-toPass-' + i).toBe('inside-toPass-2');
        }).toPass({ timeout: 1000 });
        expect.soft('after-toPass').toBe('zzzz');
      });
    `
  });
  expect(result.output).toContain('Received: "before-toPass"');
  expect(result.output).toContain('Received: "after-toPass"');
  expect(result.output).not.toContain('Received: "inside-toPass-1"');
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('should work with no.toPass and failing soft assertion', async ({ runInlineTest }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/20518' });

  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should work', async () => {
        await test.expect(() => {
          expect.soft(1).toBe(2);
        }).not.toPass({ timeout: 1000 });
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.failed).toBe(0);
  expect(result.passed).toBe(1);
});

test('should show only soft errors on last toPass pass', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should respect soft', async () => {
        let i = 0;
        await test.expect(() => {
          ++i;
          expect.soft('inside-toPass-' + i).toBe('0');
        }).toPass({ timeout: 1000, intervals: [100, 100, 100000] });
      });
    `
  });
  expect(result.output).not.toContain('Received: "inside-toPass-1"');
  expect(result.output).not.toContain('Received: "inside-toPass-2"');
  expect(result.output).toContain('Received: "inside-toPass-3"');
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('should work with soft', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should respect soft', async () => {
        await test.expect.soft(() => {
          expect(1).toBe(3);
        }).toPass({ timeout: 1000 });
        expect.soft(2).toBe(3);
      });
    `
  });
  expect(result.output).toContain('Received: 1');
  expect(result.output).toContain('Received: 2');
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('should not accept TimeoutError', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        await test.expect(() => {}).not.toPass({ timeout: 1 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});
