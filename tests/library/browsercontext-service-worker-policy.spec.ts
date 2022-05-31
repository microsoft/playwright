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

it('should allow service workers by default', async ({ contextFactory, server }) => {
  const context = await contextFactory();
  const page = await context.newPage();
  await page.goto(server.PREFIX + '/serviceworkers/empty/sw.html');
  await expect(page.evaluate(() => window['registrationPromise'])).resolves.toBeTruthy();
  await context.close();
});


it('should fail service worker registrations', async ({ contextFactory, server, browserName }) => {
  const context = await contextFactory({
    serviceWorkerPolicy: 'disabled',
  });
  const page = await context.newPage();
  await Promise.all([
    page.waitForEvent('console', evt => evt.text() === 'Service Worker registration disabled by Playwright'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
  ]);
  const err = await page.evaluate(() => window['registrationPromise']).catch(e => `REJECTED: ${e}`);
  if (browserName === 'firefox')
    expect(err).toMatch(/^REJECTED:.*undefined/);
  else
    expect(err).toMatch(/^REJECTED:.*Service Worker registration disabled by Playwright/);
  await context.close();
});
