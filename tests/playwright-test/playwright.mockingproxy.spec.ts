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

test('inject mode', async ({ runInlineTest, server }) => {
  server.setRoute('/page', (req, res) => {
    res.end(req.headers['x-pw-proxy-port'] ?? 'no port given');
  });
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          mockingProxy: { port: 'inject' }
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', async ({ server, page, request }) => {
        await page.goto('${server.PREFIX}/page');
        expect(await page.textContent('body')).toEqual('' + server.port());

        const response = await request.get('${server.PREFIX}/page');
        expect(await response.text()).toEqual('' + server.port());
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('throws on fixed mocking proxy port and parallel workers', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          mockingProxy: { port: 1234 }
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', async ({ server }) => {
      });
    `
  }, { workers: 2 });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain('Cannot share mocking proxy between multiple workers.');
});

test('throws on missing config', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('foo', async ({ server }) => {
      });
    `
  }, { workers: 2 });

  expect(result.exitCode).toBe(1);
  expect(result.output).toContain(`The 'server' fixture is only available when 'mockingProxy' is enabled.`);
});

test('routes are reset between tests', async ({ runInlineTest, server, request }) => {
  server.setRoute('/fallback', async (req, res) => {
    res.end('fallback');
  });
  server.setRoute('/page', async (req, res) => {
    const port = req.headers['x-pw-proxy-port'];
    const proxyURL = `http://localhost:${port}/`;
    const response = await request.get(proxyURL + server.PREFIX + '/fallback');
    res.end(await response.body());
  });
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          mockingProxy: { port: 'inject' }
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('first', async ({ server, page, request }) => {
        await server.route('${server.PREFIX}/fallback', route => route.fulfill({ body: 'first' }));
        await page.goto('${server.PREFIX}/page');
        expect(await page.textContent('body')).toEqual('first');
      });
      test('second', async ({ server, page, request }) => {
        await server.route('${server.PREFIX}/fallback', route => route.fallback());
        await page.goto('${server.PREFIX}/page');
        expect(await page.textContent('body')).toEqual('fallback');
      });
    `
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(2);
});
