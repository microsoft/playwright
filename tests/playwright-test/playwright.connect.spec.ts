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
        use: {
          connectOptions: {
            wsEndpoint: process.env.CONNECT_WS_ENDPOINT,
          },
        },
      };
    `,
    'global-setup.ts': `
      import { chromium } from '@playwright/test';
      module.exports = async () => {
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
  expect(result.output).toContain('browserType.launch:');
  expect(result.output).toContain('does-not-exist-bad-domain');
});

test('should respect connectOptions.timeout', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.js': `
      module.exports = {
        use: {
          connectOptions: {
            wsEndpoint: 'wss://locahost:5678',
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
  expect(result.output).toContain('browserType.launch: Timeout 1ms exceeded.');
});
