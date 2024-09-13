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
import { browserTest as it, expect } from '../config/browserTest';

it('should allow service workers by default', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/serviceworkers/empty/sw.html');
  await expect(page.evaluate(() => window['registrationPromise'])).resolves.toBeTruthy();
});

it.describe('block', () => {
  it.use({ serviceWorkers: 'block' });

  it('blocks service worker registration', async ({ page, server }) => {
    await Promise.all([
      page.waitForEvent('console', evt => evt.text() === 'Service Worker registration blocked by Playwright'),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);
  });

  it('should not throw error on about:blank', async ({ page }) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32292' });
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.goto('about:blank');
    expect(errors).toEqual([]);
  });
});
