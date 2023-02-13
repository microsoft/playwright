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

test('should fall back to launchOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          launchOptions: {
            headless: false,
            channel: 'chrome',
          }
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ headless, channel }) => {
        expect.soft(headless).toBe(false);
        expect.soft(channel).toBe('chrome');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should override launchOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          headless: false,
          channel: 'chrome',
          launchOptions: {
            headless: true,
            channel: 'msedge',
          }
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ headless, channel }) => {
        expect.soft(headless).toBe(false);
        expect.soft(channel).toBe('chrome');
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect contextOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          contextOptions: {
            acceptDownloads: false,
            bypassCSP: true,
            colorScheme: 'dark',
            deviceScaleFactor: 2,
            extraHTTPHeaders: {'foo': 'bar'},
            hasTouch: true,
            ignoreHTTPSErrors: true,
            isMobile: true,
            javaScriptEnabled: true,
            locale: 'fr-FR',
            offline: true,
            permissions: ['geolocation'],
            timezoneId: 'TIMEZONE',
            userAgent: 'UA',
            viewport: null
          }
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ acceptDownloads, bypassCSP, colorScheme, deviceScaleFactor, extraHTTPHeaders, hasTouch, ignoreHTTPSErrors, isMobile, javaScriptEnabled, locale, offline, permissions, timezoneId, userAgent, viewport }) => {
        expect.soft(acceptDownloads).toBe(false);
        expect.soft(bypassCSP).toBe(true);
        expect.soft(colorScheme).toBe('dark');
        expect.soft(deviceScaleFactor).toBe(2);
        expect.soft(extraHTTPHeaders).toEqual({'foo': 'bar'});
        expect.soft(hasTouch).toBe(true);
        expect.soft(ignoreHTTPSErrors).toBe(true);
        expect.soft(isMobile).toBe(true);
        expect.soft(javaScriptEnabled).toBe(true);
        expect.soft(locale).toBe('fr-FR');
        expect.soft(offline).toBe(true);
        expect.soft(permissions).toEqual(['geolocation']);
        expect.soft(timezoneId).toBe('TIMEZONE');
        expect.soft(userAgent).toBe('UA');
        expect.soft(viewport).toBe(null);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should override contextOptions', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
        acceptDownloads: false,
        bypassCSP: true,
        colorScheme: 'dark',
        deviceScaleFactor: 2,
        extraHTTPHeaders: {'foo': 'bar'},
        hasTouch: true,
        ignoreHTTPSErrors: true,
        isMobile: true,
        javaScriptEnabled: true,
        locale: 'fr-FR',
        offline: true,
        permissions: ['geolocation'],
        timezoneId: 'TIMEZONE',
        userAgent: 'UA',
        viewport: null,
        contextOptions: {
            acceptDownloads: true,
            bypassCSP: false,
            colorScheme: 'light',
            deviceScaleFactor: 1,
            extraHTTPHeaders: {'foo': 'bar2'},
            hasTouch: false,
            ignoreHTTPSErrors: false,
            isMobile: false,
            javaScriptEnabled: false,
            locale: 'en-US',
            offline: false,
            permissions: [],
            timezoneId: 'TIMEZONE 2',
            userAgent: 'UA 2',
            viewport: { width: 500, height: 500 }
          }
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ acceptDownloads, bypassCSP, colorScheme, deviceScaleFactor, extraHTTPHeaders, hasTouch, ignoreHTTPSErrors, isMobile, javaScriptEnabled, locale, offline, permissions, timezoneId, userAgent, viewport }) => {
        expect.soft(acceptDownloads).toBe(false);
        expect.soft(bypassCSP).toBe(true);
        expect.soft(colorScheme).toBe('dark');
        expect.soft(deviceScaleFactor).toBe(2);
        expect.soft(extraHTTPHeaders).toEqual({'foo': 'bar'});
        expect.soft(hasTouch).toBe(true);
        expect.soft(ignoreHTTPSErrors).toBe(true);
        expect.soft(isMobile).toBe(true);
        expect.soft(javaScriptEnabled).toBe(true);
        expect.soft(locale).toBe('fr-FR');
        expect.soft(offline).toBe(true);
        expect.soft(permissions).toEqual(['geolocation']);
        expect.soft(timezoneId).toBe('TIMEZONE');
        expect.soft(userAgent).toBe('UA');
        expect.soft(viewport).toBe(null);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});

test('should respect testIdAttribute', async ({ runInlineTest }) => {
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = {
        use: {
          testIdAttribute: 'data-pw',
        }
      };
    `,
    'a.test.ts': `
      import { test, expect } from '@playwright/test';
      test('pass', async ({ page }) => {
        await page.setContent('<div data-pw="myid">Hi</div>');
        await expect(page.getByTestId('myid')).toHaveCount(1);
      });
    `,
  }, { workers: 1 });

  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
