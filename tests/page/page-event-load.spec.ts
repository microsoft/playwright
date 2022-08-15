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

import { test as it, expect } from './pageTest';


it('should fire once', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15086' });
  it.fixme(browserName === 'firefox', 'Firefox sometimes double fires.');

  let count = 0;
  page.on('load', () => count++);
  await page.goto(server.PREFIX + '/one-style.html');
  await page.waitForTimeout(1000);
  expect(count).toBe(1);
});

it('should fire once with iframe navigation', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/15086' });
  it.fixme(browserName === 'firefox', 'Firefox sometimes double fires.');

  let requestCount = 0;
  server.setRoute('/tracker', (_, res) => {
    res.write(`request count: ${++requestCount}`);
    res.end();
  });
  server.setRoute('/home', (_, res) => {
    res.write(`
      <!DOCTYPE html>
      <html>
        <head>
        </head>
        <body>
          <script>
            window.eventLog = [];
            window.addEventListener('load', () => {
              window.eventLog.push('load');
            });
          </script>
          <form id="trackerForm" action="/tracker" method="post" target="tracker">
            <input type="submit">
          </form>
          <iframe name="tracker" src="/tracker">
        </body>
      </html>
    `);
    res.end();
  });
  let count = 0;
  page.on('load', () => count++);
  await page.goto(server.PREFIX + '/home');
  const trackingFrame = page.frameLocator('[name=tracker]');
  await expect(trackingFrame.locator(':scope')).toContainText('request count: 1');
  const loadFired = Promise.race([
    page.waitForEvent('load').then(() => 'loadfired'),
    page.waitForTimeout(1000).then(() => 'timeout'),
  ]);
  await page.locator('input[type=submit]').click();
  await expect.soft(loadFired).resolves.toBe('timeout');
  expect.soft(count).toBe(1);
  expect(await page.evaluate(() => window['eventLog'])).toEqual(['load']);
});
