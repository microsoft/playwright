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

test('should expose request fixture', async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ request }) => {
        const response = await request.get('${server.PREFIX}/simple.json');
        const json = await response.json();
        expect(json).toEqual({ foo: 'bar' });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should use baseURL in request fixture', async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { baseURL: '${server.PREFIX}' } };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ request }) => {
        const response = await request.get('/simple.json');
        const json = await response.json();
        expect(json).toEqual({ foo: 'bar' });
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should stop tracing on requestContext.dispose()', async ({ runInlineTest, server }) => {
  server.setRoute('/slow', (req, resp) => {
    resp.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': '3',
    });
  });
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        reporter: [['html', { open: 'never' }]],
        use: {
          trace:'retain-on-failure'
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('hanging request', async ({ page, request }) => {
        const response = await page.goto('${server.EMPTY_PAGE}');
        expect(response.status()).toBe(200);
        await request.get('${server.PREFIX}/slow');
      });
    `,
  }, { workers: 1, timeout: 2000 });
  expect(result.output).not.toContain('ENOENT');
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
});

test('should hint unrouteAll if failed in the handler', async ({ runInlineTest, server }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('late fetch', async ({ page }) => {
        let closedCallback = () => {};
        const closedPromise = new Promise<void>(f => closedCallback = f);
        await page.route('**/empty.html', async route => {
          await route.continue();
          await closedPromise;
          await route.fetch();
        });
        await page.goto('${server.EMPTY_PAGE}');
        closedCallback();
      });

      test('second test', async ({ page }) => {
        // Wait enough for the worker to be killed.
        await new Promise(f => setTimeout(f, 1000));
      });
    `,
  }, { workers: 1 });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('Consider awaiting `await page.unrouteAll({ behavior: \'ignoreErrors\' })`');
});
