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
import { parseTrace } from '../config/utils';
import fs from 'fs';

test('should reuse context', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/reuse.test.ts': `
      import { test, expect } from '@playwright/test';
      let lastContextGuid;
      test('one', async ({ context }) => {
        lastContextGuid = context._guid;
      });

      test('two', async ({ context }) => {
        expect(context._guid).toBe(lastContextGuid);
      });

      test.describe(() => {
        test.use({ colorScheme: 'dark' });
        test('dark', async ({ context }) => {
          expect(context._guid).toBe(lastContextGuid);
        });
      });

      test.describe(() => {
        test.use({ userAgent: 'UA' });
        test('UA', async ({ context }) => {
          expect(context._guid).toBe(lastContextGuid);
        });
      });

      test.describe(() => {
        test.use({ timezoneId: 'Europe/Berlin' });
        test('tz', async ({ context }) => {
          expect(context._guid).not.toBe(lastContextGuid);
        });
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(5);
});

test('should not reuse context with video if mode=when-possible', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        use: { video: 'on' },
      };
    `,
    'src/reuse.test.ts': `
      import { test, expect } from '@playwright/test';
      let lastContextGuid;

      test('one', async ({ context }) => {
        lastContextGuid = context._guid;
      });

      test('two', async ({ context }) => {
        expect(context._guid).not.toBe(lastContextGuid);
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: 'when-possible' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'reuse-one', 'video.webm'))).toBeFalsy();
  expect(fs.existsSync(testInfo.outputPath('test-results', 'reuse-two', 'video.webm'))).toBeFalsy();
});

test('should reuse context with trace if mode=when-possible', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        use: { trace: 'on' },
      };
    `,
    'reuse.spec.ts': `
      import { test, expect } from '@playwright/test';
      let lastContextGuid;

      test.beforeAll(async () => {
        console.log('fromBeforeAll');
      });

      test.afterAll(async () => {
        console.log('fromAfterAll');
      });

      test('one', async ({ context, page }) => {
        lastContextGuid = context._guid;
        await page.setContent('<button>Click</button>');
        await page.click('button');
      });

      test('two', async ({ context, page }) => {
        expect(context._guid).toBe(lastContextGuid);
        await page.setContent('<input>');
        await page.fill('input', 'value');
        await page.locator('input').click();
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: 'when-possible' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
  expect(result.output).toContain('fromBeforeAll');
  expect(result.output).toContain('fromAfterAll');

  const trace1 = await parseTrace(testInfo.outputPath('test-results', 'reuse-one', 'trace.zip'));
  expect(trace1.actionTree).toEqual([
    'Before Hooks',
    '  beforeAll hook',
    '  Fixture "browser"',
    '    Launch browser',
    '  Fixture "context"',
    '  Fixture "page"',
    '    Create page',
    'Set content',
    'Click',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
  ]);
  expect(trace1.traceModel.storage().snapshotsForTest().length).toBeGreaterThan(0);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'reuse-one', 'trace-1.zip'))).toBe(false);

  const trace2 = await parseTrace(testInfo.outputPath('test-results', 'reuse-two', 'trace.zip'));
  expect(trace2.actionTree).toEqual([
    'Before Hooks',
    '  Fixture "context"',
    '  Fixture "page"',
    'Expect "toBe"',
    'Set content',
    'Fill "value"',
    'Click',
    'After Hooks',
    '  Fixture "page"',
    '  Fixture "context"',
    '  afterAll hook',
  ]);
  expect(trace2.traceModel.storage().snapshotsForTest().length).toBeGreaterThan(0);
});

test('should work with manually closed pages', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/button.test.ts': `
      import { test, expect } from '@playwright/test';

      test('closes page', async ({ page }) => {
        await page.close();
      });

      test('creates a new page', async ({ page, context }) => {
        await page.setContent('<button>Submit</button>');
        await expect(page.locator('button')).toHaveText('Submit');
        await page.locator('button').click();
        await page.close();
        await context.newPage();
      });

      test('still works', async ({ page }) => {
        await page.setContent('<button>Submit</button>');
        await expect(page.locator('button')).toHaveText('Submit');
        await page.locator('button').click();
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should clean storage', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/reuse.test.ts': `
      import { test, expect } from '@playwright/test';
      let lastContextGuid;

      test.beforeEach(async ({ page }) => {
        await page.route('**/*', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://example.com');
      });

      test('one', async ({ context, page }) => {
        lastContextGuid = context._guid;

        // Spam local storage.
        page.evaluate(async () => {
          while (true) {
            localStorage.foo = 'bar';
            sessionStorage.foo = 'bar';
            await new Promise(f => setTimeout(f, 0));
          }
        }).catch(() => {});

        const local = await page.evaluate('localStorage.foo');
        const session = await page.evaluate('sessionStorage.foo');
        expect(local).toBe('bar');
        expect(session).toBe('bar');
      });

      test('two', async ({ context, page }) => {
        expect(context._guid).toBe(lastContextGuid);
        const local = await page.evaluate('localStorage.foo');
        const session = await page.evaluate('sessionStorage.foo');

        expect(local).toBeFalsy();
        expect(session).toBeFalsy();
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should restore localStorage', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/reuse.test.ts': `
      import { test, expect } from '@playwright/test';
      let lastContextGuid;

      test.use({
        storageState: {
          origins: [{
            origin: 'http://example.com',
            localStorage: [{
              name: 'foo',
              value: 'fooValue'
            }]
          }, {
            origin: 'http://another.com',
            localStorage: [{
              name: 'foo',
              value: 'anotherValue'
            }]
          }]
        }
      });

      test.beforeEach(async ({ page }) => {
        await page.route('**/*', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://example.com');
      });

      test('one', async ({ context, page }) => {
        lastContextGuid = context._guid;

        {
          const local = await page.evaluate('localStorage.foo');
          const session = await page.evaluate('sessionStorage.foo');
          expect(local).toBe('fooValue');
          expect(session).toBeFalsy();
        }

        // Overwrite localStorage.
        await page.evaluate(() => {
          localStorage.foo = 'bar';
          sessionStorage.foo = 'bar';
        });

        {
          const local = await page.evaluate('localStorage.foo');
          const session = await page.evaluate('sessionStorage.foo');
          expect(local).toBe('bar');
          expect(session).toBe('bar');
        }
      });

      test('two', async ({ context, page }) => {
        expect(context._guid).toBe(lastContextGuid);
        const local = await page.evaluate('localStorage.foo');
        const session = await page.evaluate('sessionStorage.foo');

        expect(local).toBe('fooValue');
        expect(session).toBeFalsy();
      });

      test('three', async ({ context, page }) => {
        await page.goto('http://another.com');
        expect(context._guid).toBe(lastContextGuid);
        const local = await page.evaluate('localStorage.foo');
        expect(local).toBe('anotherValue');
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should clean db', async ({ runInlineTest }) => {
  test.slow();
  const result = await runInlineTest({
    'src/reuse.test.ts': `
      import { test, expect } from '@playwright/test';
      let lastContextGuid;

      test.beforeEach(async ({ page }) => {
        await page.route('**/*', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://example.com');
      });

      test('one', async ({ context, page }) => {
        lastContextGuid = context._guid;
        await page.evaluate(async () => {
          const dbRequest = indexedDB.open('db', 1);
          await new Promise(f => dbRequest.onsuccess = f);
        });
        const dbnames = await page.evaluate(async () => {
          const dbs = await indexedDB.databases();
          return dbs.map(db => db.name);
        });
        expect(dbnames).toEqual(['db']);
      });

      test('two', async ({ context, page }) => {
        expect(context._guid).toBe(lastContextGuid);
        const dbnames = await page.evaluate(async () => {
          const dbs = await indexedDB.databases();
          return dbs.map(db => db.name);
        });

        expect(dbnames).toEqual([]);
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should restore cookies', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/reuse.test.ts': `
      import { test, expect } from '@playwright/test';
      let lastContextGuid;

      test.use({
        storageState: {
          cookies: [{
            name: 'name',
            value: 'value',
            domain: 'example.com',
            path: '/',
          }]
        }
      });

      test.beforeEach(async ({ page }) => {
        await page.route('**/*', route => route.fulfill({ body: '<html></html>', contentType: 'text/html' }));
        await page.goto('http://example.com');
      });

      test('one', async ({ context, page }) => {
        lastContextGuid = context._guid;

        {
          const cookie = await page.evaluate('document.cookie');
          expect(cookie).toBe('name=value');
        }

        // Overwrite cookie.
        await page.evaluate(async () => {
          document.cookie = 'name=value2';
        });

        {
          const cookie = await page.evaluate('document.cookie');
          expect(cookie).toBe('name=value2');
        }
      });

      test('two', async ({ context, page }) => {
        expect(context._guid).toBe(lastContextGuid);
        const cookie = await page.evaluate('document.cookie');
        expect(cookie).toBe('name=value');
      });

      test('three', async ({ context, page }) => {
        await page.goto('http://another.com');
        const cookie = await page.evaluate('document.cookie');
        expect(cookie).toBe('');
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should reuse context with beforeunload', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/reuse.test.ts': `
      import { test, expect } from '@playwright/test';
      let lastContextGuid;
      test('one', async ({ page, context }) => {
        lastContextGuid = context._guid;
        await page.evaluate(() => {
          window.addEventListener('beforeunload', event => {
            event.preventDefault();
            return event.returnValue = "Are you sure you want to exit?";
          });
        });
      });

      test('two', async ({ context }) => {
        expect(context._guid).toBe(lastContextGuid);
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should cancel pending operations upon reuse', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/reuse.test.ts': `
      import { test, expect } from '@playwright/test';
      test('one', async ({ page }) => {
        await Promise.race([
          page.getByText('click me').click().catch(e => {}),
          page.waitForTimeout(2000),
        ]);
      });

      test('two', async ({ page }) => {
        await page.setContent('<button onclick="window._clicked=true">click me</button>');
        // Give it time to erroneously click.
        await page.waitForTimeout(2000);
        expect(await page.evaluate('window._clicked')).toBe(undefined);
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should reset tracing', async ({ runInlineTest }, testInfo) => {
  const traceFile1 = testInfo.outputPath('trace1.zip');
  const traceFile2 = testInfo.outputPath('trace2.zip');
  const result = await runInlineTest({
    'reuse.spec.ts': `
      import { test, expect } from '@playwright/test';
      test('one', async ({ page }) => {
        await page.context().tracing.start({ snapshots: true });
        await page.setContent('<button>Click</button>');
        await page.click('button');
        await page.context().tracing.stopChunk({ path: ${JSON.stringify(traceFile1)} });
      });
      test('two', async ({ page }) => {
        await page.context().tracing.start({ snapshots: true });
        await page.setContent('<input>');
        await page.fill('input', 'value');
        await page.locator('input').click();
        await page.context().tracing.stopChunk({ path: ${JSON.stringify(traceFile2)} });
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);

  const trace1 = await parseTrace(traceFile1);
  expect(trace1.titles).toEqual([
    'Set content',
    'Click',
  ]);
  expect(trace1.traceModel.storage().snapshotsForTest().length).toBeGreaterThan(0);

  const trace2 = await parseTrace(traceFile2);
  expect(trace2.titles).toEqual([
    'Set content',
    'Fill "value"',
    'Click',
  ]);
  expect(trace1.traceModel.storage().snapshotsForTest().length).toBeGreaterThan(0);
});

test('should not delete others contexts', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/reuse.test.ts': `
      import { test as base, expect } from '@playwright/test';
      const test = base.extend<{ loggedInPage: Page }>({
        loggedInPage: async ({ browser }, use) => {
          const page = await browser.newPage();
          await use(page);
          await page.close();
        },
      });
      test("passes", async ({ loggedInPage, page }) => {
        await loggedInPage.goto('data:text/plain,Hello world');
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should survive serial mode with tracing and reuse', async ({ runInlineTest }, testInfo) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      import { defineConfig } from '@playwright/test';
      export default defineConfig({ use: { trace: 'on' } });
    `,
    'reuse.spec.ts': `
      import { test, expect } from '@playwright/test';
      let page;

      test.describe.configure({ mode: 'serial' });

      test.beforeAll(async ({ browser }) => {
        page = await browser.newPage();
      });

      test('one', async ({}) => {
        await page.setContent('<button>Click</button>');
        await page.click('button');
      });

      test('two', async ({}) => {
        await page.setContent('<input>');
        await page.fill('input', 'value');
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);

  expect(fs.existsSync(testInfo.outputPath('test-results', 'reuse-one', 'trace.zip'))).toBe(true);
  expect(fs.existsSync(testInfo.outputPath('test-results', 'reuse-two', 'trace.zip'))).toBe(true);
});
