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

test('should work with connectOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        globalSetup: './global-setup',
        // outputDir is relative to the config file. Customers can have special characters in the path:
        // See: https://github.com/microsoft/playwright/issues/24157
        outputDir: 'Привет',
        use: {
          connectOptions: {
            wsEndpoint: process.env.CONNECT_WS_ENDPOINT,
          },
          launchOptions: {
            env: {
              // Customers can have special characters: https://github.com/microsoft/playwright/issues/24157
              RANDOM_TEST_SPECIAL: 'Привет',
            }
          }
        },
      };
    `,
    'global-setup.ts': `
      import { chromium } from '@playwright/test';
      module.exports = async () => {
        process.env.DEBUG = 'pw:browser';
        process.env.PWTEST_SERVER_WS_HEADERS =
          'x-playwright-debug-log: a-debug-log-string\\r\\n' +
          'x-playwright-attachment: attachment-a=value-a\\r\\n' +
          'x-playwright-debug-log: b-debug-log-string\\r\\n' +
          'x-playwright-attachment: attachment-b=value-b';
        const server = await chromium.launchServer();
        process.env.CONNECT_WS_ENDPOINT = server.wsEndpoint();
        return () => server.close();
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test.use({ locale: 'fr-CH' });
      test('pass', async ({ page }) => {
        await page.setContent('<div>PASS</div>');
        await expect(page.locator('div')).toHaveText('PASS');
        expect(await page.evaluate(() => navigator.language)).toBe('fr-CH');
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
  expect(result.output).toContain('a-debug-log-string');
  expect(result.output).toContain('b-debug-log-string');
  expect(result.results[0].attachments).toEqual([
    {
      name: 'attachment-a',
      contentType: 'text/plain',
      body: 'dmFsdWUtYQ=='
    },
    {
      name: 'attachment-b',
      contentType: 'text/plain',
      body: 'dmFsdWUtYg=='
    }
  ]);
});

test('should throw with bad connectOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: {
          connectOptions: {
            wsEndpoint: 'http://does-not-exist-bad-domain.oh-no-should-not-work',
          },
        },
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        await page.setContent('<div>PASS</div>');
        await expect(page.locator('div')).toHaveText('PASS');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('browserType.connect:');
  expect(result.output).toContain('does-not-exist-bad-domain');
});

test('should respect connectOptions.timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: {
          connectOptions: {
            wsEndpoint: 'wss://localhost:5678',
            timeout: 1,
          },
        },
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.passed).toBe(0);
  expect(result.output).toContain('browserType.connect: Timeout 1ms exceeded.');
});

test('should print debug log when failed to connect', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        globalSetup: './global-setup',
        use: {
          connectOptions: {
            wsEndpoint: process.env.CONNECT_WS_ENDPOINT,
          },
        },
      };
    `,
    'global-setup.ts': `
      import { chromium } from '@playwright/test';
      import ws from 'ws';
      import http from 'http';
      module.exports = async () => {
        const server = http.createServer(() => {});
        server.on('upgrade', async (request, socket, head) => {
          socket.write('HTTP/1.1 401 Unauthorized\\r\\nx-playwright-debug-log: b-debug-log-string\\r\\n\\r\\nUnauthorized body');
          socket.destroy();
        });
        server.listen(0);
        await new Promise(f => server.once('listening', f));
        process.env.CONNECT_WS_ENDPOINT = 'ws://localhost:' + server.address().port;
        return () => new Promise(f => server.close(f));
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('fail', async ({ page }) => {
        await page.setContent('<div>FAIL</div>');
      });
    `,
  });
  expect(result.exitCode).toBe(1);
  expect(result.failed).toBe(1);
  expect(result.output).toContain('b-debug-log-string');
  expect(result.results[0].attachments).toEqual([]);
});
