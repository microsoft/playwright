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

test('should reuse context', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/reuse.test.ts': `
      const { test } = pwt;
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

test('should not reuse context with video', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        use: { video: 'on' },
      };
    `,
    'src/reuse.test.ts': `
      const { test } = pwt;
      let lastContext;

      test('one', async ({ context }) => {
        lastContext = context;
      });

      test('two', async ({ context }) => {
        expect(context).not.toBe(lastContext);
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should not reuse context with trace', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      export default {
        use: { trace: 'on' },
      };
    `,
    'src/reuse.test.ts': `
      const { test } = pwt;
      let lastContext;

      test('one', async ({ context }) => {
        lastContext = context;
      });

      test('two', async ({ context }) => {
        expect(context).not.toBe(lastContext);
      });
    `,
  }, { workers: 1 }, { PW_TEST_REUSE_CONTEXT: '1' });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should work with manually closed pages', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'src/button.test.ts': `
      const { test } = pwt;

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
      const { test } = pwt;
      let lastContextGuid;

      test.beforeEach(async ({ page }) => {
        await page.route('**/*', route => route.fulfill('<html></html>'));
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
      const { test } = pwt;
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
        await page.route('**/*', route => route.fulfill('<html></html>'));
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
      const { test } = pwt;
      let lastContextGuid;

      test.beforeEach(async ({ page }) => {
        await page.route('**/*', route => route.fulfill('<html></html>'));
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
      const { test } = pwt;
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
        await page.route('**/*', route => route.fulfill('<html></html>'));
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
      const { test } = pwt;
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
