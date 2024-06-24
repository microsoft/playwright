/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { contextTest as testBase, expect } from '../config/browserTest';

const test = testBase.extend<{ crash: () => void }, { dummy: string }>({
  crash: async ({ page, toImpl, browserName }, run) => {
    await run(() => {
      if (browserName === 'chromium')
        page.goto('chrome://crash').catch(e => {});
      else if (browserName === 'webkit')
        toImpl(page)._delegate._session.send('Page.crash', {}).catch(e => {});
      else if (browserName === 'firefox')
        toImpl(page)._delegate._session.send('Page.crash', {}).catch(e => {});
    });
  },
  // Force a separate worker to avoid messing up with other tests.
  dummy: ['', { scope: 'worker' }],
});

test('should emit crash event when page crashes', async ({ page, crash }) => {
  await page.setContent(`<div>This page should crash</div>`);
  crash();
  const crashedPage = await new Promise(f => page.on('crash', f));
  expect(crashedPage).toBe(page);
});

test('should throw on any action after page crashes', async ({ page, crash, browserName }) => {
  await page.setContent(`<div>This page should crash</div>`);
  crash();
  await page.waitForEvent('crash');
  const err = await page.evaluate(() => {}).then(() => null, e => e);
  expect(err).toBeTruthy();
  // In Firefox, crashed page is sometimes "closed".
  if (browserName === 'firefox')
    expect(err.message.includes('Target page, context or browser has been closed') || err.message.includes('Target crashed'), err.message).toBe(true);
  else
    expect(err.message).toContain('Target crashed');
});

test('should cancel waitForEvent when page crashes', async ({ page, crash }) => {
  await page.setContent(`<div>This page should crash</div>`);
  const promise = page.waitForEvent('response').catch(e => e);
  crash();
  const error = await promise;
  expect(error.message).toContain('Page crashed');
});

test('should cancel navigation when page crashes', async ({ server, page, crash }) => {
  await page.setContent(`<div>This page should crash</div>`);
  server.setRoute('/one-style.css', () => {});
  const promise = page.goto(server.PREFIX + '/one-style.html').catch(e => e);
  await page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  crash();
  const error = await promise;
  expect(error.message).toContain('page.goto: Page crashed');
});

test('should be able to close context when page crashes', async ({ isAndroid, isWebView2, page, crash }) => {
  test.skip(isAndroid);
  test.skip(isWebView2, 'Page.close() is not supported in WebView2');

  await page.setContent(`<div>This page should crash</div>`);
  crash();
  await page.waitForEvent('crash');
  await page.context().close();
});
