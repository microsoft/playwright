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
    'playwright/index.html': `<script type="module" src="/playwright/index.ts"></script>`,
    'playwright/index.ts': `
      //@no-header
    `,

    'src/reuse.test.tsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
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
  }, { workers: 1 });

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
    'playwright/index.html': `<script type="module" src="/playwright/index.ts"></script>`,
    'playwright/index.ts': `
      //@no-header
    `,

    'src/reuse.test.tsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      let lastContext;

      test('one', async ({ context }) => {
        lastContext = context;
      });

      test('two', async ({ context }) => {
        expect(context).not.toBe(lastContext);
      });
    `,
  }, { workers: 1 });

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
    'playwright/index.html': `<script type="module" src="/playwright/index.ts"></script>`,
    'playwright/index.ts': `
      //@no-header
    `,

    'src/reuse.test.tsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      let lastContext;

      test('one', async ({ context }) => {
        lastContext = context;
      });

      test('two', async ({ context }) => {
        expect(context).not.toBe(lastContext);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should work with manually closed pages', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.ts"></script>`,
    'playwright/index.ts': `
      //@no-header
    `,

    'src/button.test.tsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';

      test('closes page', async ({ mount, page }) => {
        let hadEvent = false;
        const component = await mount(<button onClick={e => hadEvent = true}>Submit</button>);
        await expect(component).toHaveText('Submit');
        await component.click();
        expect(hadEvent).toBe(true);
        await page.close();
      });

      test('creates a new page', async ({ mount, page, context }) => {
        let hadEvent = false;
        const component = await mount(<button onClick={e => hadEvent = true}>Submit</button>);
        await expect(component).toHaveText('Submit');
        await component.click();
        expect(hadEvent).toBe(true);
        await page.close();
        await context.newPage();
      });

      test('still works', async ({ mount }) => {
        let hadEvent = false;
        const component = await mount(<button onClick={e => hadEvent = true}>Submit</button>);
        await expect(component).toHaveText('Submit');
        await component.click();
        expect(hadEvent).toBe(true);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(3);
});

test('should clean storage', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.ts"></script>`,
    'playwright/index.ts': `
      //@no-header
    `,

    'src/reuse.test.tsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      let lastContextGuid;

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
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});

test('should clean db', async ({ runInlineTest }) => {
  test.slow();
  const result = await runInlineTest({
    'playwright/index.html': `<script type="module" src="/playwright/index.ts"></script>`,
    'playwright/index.ts': `
      //@no-header
    `,

    'src/reuse.test.tsx': `
      //@no-header
      import { test, expect } from '@playwright/experimental-ct-react';
      let lastContextGuid;

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
  }, { workers: 1 });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});
