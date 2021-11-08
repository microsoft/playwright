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

import { test, expect, stripAscii } from './playwright-test-fixtures';
import { ZipFileSystem } from '../../packages/playwright-core/lib/utils/vfs';
import fs from 'fs';

test('should stop tracing with trace: on-first-retry, when not retrying', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on-first-retry' } };
    `,
    'a.spec.ts': `
      const { test } = pwt;

      test.describe('shared', () => {
        let page;
        test.beforeAll(async ({ browser }) => {
          page = await browser.newPage();
        });

        test.afterAll(async () => {
          await page.close();
        });

        test('flaky', async ({}, testInfo) => {
          expect(testInfo.retry).toBe(1);
        });

        test('no tracing', async ({}, testInfo) => {
          const e = await page.context().tracing.stop({ path: 'ignored' }).catch(e => e);
          expect(e.message).toContain('Must start tracing before stopping');
        });
      });
    `,
  }, { workers: 1, retries: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.flaky).toBe(1);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'a-shared-flaky-retry1', 'trace.zip'))).toBeTruthy();
});

test('should not throw with trace: on-first-retry and two retries in the same worker', async ({ runInlineTest }, testInfo) => {
  const files = {};
  for (let i = 0; i < 6; i++) {
    files[`a${i}.spec.ts`] = `
      import { test } from './helper';
      test('flaky', async ({ myContext }, testInfo) => {
        await new Promise(f => setTimeout(f, 200 + Math.round(Math.random() * 1000)));
        expect(testInfo.retry).toBe(1);
      });
      test('passing', async ({ myContext }, testInfo) => {
        await new Promise(f => setTimeout(f, 200 + Math.round(Math.random() * 1000)));
      });
    `;
  }
  const result = await runInlineTest({
    ...files,
    'playwright.config.ts': `
      module.exports = { use: { trace: 'on-first-retry' } };
    `,
    'helper.ts': `
      const { test: base } = pwt;
      export const test = base.extend({
        myContext: [async ({ browser }, use) => {
          const c = await browser.newContext();
          await use(c);
          await c.close();
        }, { scope: 'worker' }]
      })
    `,
  }, { workers: 3, retries: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(6);
  expect(result.flaky).toBe(6);
});

test('should not throw with trace and timeouts', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { timeout: 2000, repeatEach: 10, use: { trace: 'on' } };
    `,
    'a.spec.ts': `
      const { test } = pwt;
      test('launches browser', async ({ page }) => {
      });
      test('sometimes times out', async ({ page }) => {
        test.setTimeout(1000);
        await page.setContent('<div>Hello</div>');
        await new Promise(f => setTimeout(f, 800 + Math.round(Math.random() * 200)));
      });
    `,
  }, { workers: 2 });

  expect(result.exitCode).toBe(1);
  expect(stripAscii(result.output)).not.toContain('tracing.stopChunk:');
  expect(stripAscii(result.output)).not.toContain('tracing.stop:');
});

test('should save sources when requested', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          trace: 'on',
        }
      };
    `,
    'a.spec.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await page.evaluate(2 + 2);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toEqual(0);
  const resources = await parseTrace(testInfo.outputPath('test-results', 'a-pass', 'trace.zip'));
  expect([...resources.keys()].filter(f => f.includes('src@'))).toHaveLength(1);
});

test('should not save sources when not requested', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          trace: {
            mode: 'on',
            sources: false,
          }
        }
      };
    `,
    'a.spec.ts': `
      const { test } = pwt;
      test('pass', async ({ page }) => {
        await page.evaluate(2 + 2);
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toEqual(0);
  const resources = await parseTrace(testInfo.outputPath('test-results', 'a-pass', 'trace.zip'));
  expect([...resources.keys()].filter(f => f.includes('src@'))).toHaveLength(0);
});

async function parseTrace(file: string): Promise<Map<string, Buffer>> {
  const zipFS = new ZipFileSystem(file);
  const resources = new Map<string, Buffer>();
  for (const entry of await zipFS.entries())
    resources.set(entry, await zipFS.read(entry));
  zipFS.close();
  return resources;
}
