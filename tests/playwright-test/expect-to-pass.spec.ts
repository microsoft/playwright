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
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
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

test('should work with soft', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should respect soft', async () => {
        await expect.soft(() => {
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

test('should not spin forever', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      let log;
      test('spill toPass', async () => {
        expect(() => {
          log?.push('poll');
          throw new Error('Polling');
        }).toPass().catch(() => {});
      });
      test('should not see toPass', async () => {
        log = [];
        await new Promise(f => setTimeout(f, 1000));
        expect(log.length).toBe(0);
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should show intermediate result for toPass that spills over test time', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        await expect(() => {
          expect(3).toBe(2);
        }).toPass();
      });
    `
  }, { timeout: 1000 });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Expected: 2');
  expect(result.output).toContain('Received: 3');
});

test('should respect timeout in config file when timeout parameter is not passed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `module.exports = { expect: { toPass: { timeout: 100 } } }`,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        await test.expect(() => {
          expect(1).toBe(2);
        }).toPass();
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

test('should give priority to timeout parameter over timeout in config file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `module.exports = { expect: { toPass: { timeout: 100 } } }`,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        await test.expect(() => {
          expect(1).toBe(2);
        }).toPass({ timeout: 200 });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Timeout 200ms exceeded while waiting on the predicate');
  expect(result.output).toContain('Received: 1');
  expect(result.output).toContain(`
  4 |         await test.expect(() => {
  `.trim());
});

test('should respect intervals in config file when intervals parameter is not passed', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `module.exports = { expect: { toPass: { timeout: 2000, intervals: [100, 1000] } } }`,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        let attempt = 0;
        await test.expect(() => {
          expect(++attempt).toBe(-1);
        }).toPass();
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: expect(received).toBe(expected) // Object.is equality');
  expect(result.output).toContain('Expected: -1');
  expect(result.output).toContain('Received: 3');
});

test('should give priority to intervals parameter over intervals in config file', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `module.exports = { expect: { toPass: { timeout: 2000, intervals: [100] } } }`,
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should fail', async () => {
        let attempt = 0;
        await test.expect(() => {
          expect(++attempt).toBe(-1);
        }).toPass({ intervals: [100, 1000] });
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Error: expect(received).toBe(expected) // Object.is equality');
  expect(result.output).toContain('Expected: -1');
  expect(result.output).toContain('Received: 3');
});
