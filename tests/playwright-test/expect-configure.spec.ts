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

test('should configure timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      const fastExpect = expect.configure({ timeout: 1 });
      test('pass', async ({ page }) => {
        const time = performance.now();
        try {
          await fastExpect(page.locator('li')).toBeVisible();
        } catch (e) {
          expect(performance.now() - time).toBeLessThan(5000);
        }
      });
    `
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should configure message', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      const namedExpect = expect.configure({ message: 'x-foo must be visible' });
      test('custom expect message', async ({page}) => {
        await namedExpect(page.locator('x-foo')).toBeVisible({timeout: 1});
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('Error: x-foo must be visible');
  expect(result.output).toContain('expect(locator).toBeVisible() failed');
  expect(result.output).toContain('Timeout:  1ms');
  expect(result.output).toContain('Call log:');
});

test('should prefer local message', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      const namedExpect = expect.configure({ message: 'x-foo must be visible' });
      test('custom expect message', async ({page}) => {
        await namedExpect(page.locator('x-foo'), { message: 'overridden' }).toBeVisible({timeout: 1});
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);

  expect(result.output).toContain('Error: overridden');
  expect(result.output).toContain(`expect(locator).toBeVisible() failed`);
  expect(result.output).toContain('Timeout:  1ms');
  expect(result.output).toContain('Call log:');
});

test('should configure soft', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      const softExpect = expect.configure({ soft: true });
      test('should work', () => {
        softExpect(1+1).toBe(3);
        console.log('woof-woof');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('woof-woof');
});

test('should chain configure', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'expect-test.spec.ts': `
      import { test, expect } from '@playwright/test';
      const slowExpect = expect.configure({ timeout: 1 });
      const slowAndSoftExpect = slowExpect.configure({ soft: true });
      test('custom expect message', async ({page}) => {
        await slowAndSoftExpect(page.locator('x-foo')).toBeVisible({timeout: 1});
        console.log('%% woof-woof');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.outputLines).toEqual(['woof-woof']);
});

test('should cancel effect', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      const softExpect = expect.configure({ soft: true });
      const normalExpect = expect.configure({ soft: false });
      test('should work', () => {
        normalExpect(1+1).toBe(3);
        console.log('%% woof-woof');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.outputLines).toEqual([]);
});

test('should configure soft poll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      const softExpect = expect.configure({ soft: true });
      test('should fail', async () => {
        let probes = 0;
        const startTime = Date.now();
        await softExpect.poll(() => ++probes, { timeout: 1000, intervals: [0, 10000] }).toBe(3);
        // Probe at 0 and epsilon.
        expect(probes).toBe(2);
        expect(Date.now() - startTime).toBeLessThan(5000);
        console.log('%% woof-woof');
      });
    `
  });
  expect(result.exitCode).toBe(1);
  expect(result.outputLines).toEqual(['woof-woof']);
});

test('should configure soft after poll', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('should pass', async () => {
        await expect.poll(() => true).toBe(true);
        expect.soft(1).toBe(1);
      });
    `
  });
  expect(result.exitCode).toBe(0);
});
