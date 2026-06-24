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

import { utils } from '../../packages/playwright-core/lib/coreBundle';
import { contextTest as testBase, expect } from '../config/browserTest';

const test = testBase.extend<{ crash: () => void }, { dummy: string }>({
  crash: async ({ page, toImpl, browserName }, run) => {
    await run(() => {
      if (browserName === 'chromium')
        page.goto('chrome://crash').catch(e => {});
      else if (browserName === 'webkit')
        toImpl(page).delegate._session.send('Page.crash', {}).catch(e => {});
      else if (browserName === 'firefox')
        toImpl(page).delegate._session.send('Page.crash', {}).catch(e => {});
    });
  },
  // Force a separate worker to avoid messing up with other tests.
  dummy: ['', { scope: 'worker' }],
});

test.beforeEach(({ platform, browserName, channel }) => {
  test.slow(platform === 'linux' && (browserName === 'webkit'), 'WebKit/Linux tests are consistently slower on some Linux environments. Most likely WebContent process is not getting terminated properly and is causing the slowdown.');
  test.skip(channel === 'webkit-wsl', 'WebKit on WSL is even slower than above ^^ - skipping for now');
  test.skip(browserName === 'chromium' && utils.hostPlatform.startsWith('ubuntu24.04'), 'never dispatches the crash event');
});

test('should emit crash event when page crashes', async ({ page, crash }) => {
  await page.setContent(`<div>This page should crash</div>`);
  crash();
  const crashedPage = await new Promise(f => page.on('crash', f));
  expect(crashedPage).toBe(page);
});

test('should throw on any action after page crashes', async ({ page, crash, server, browserName }) => {
  await page.setContent(`<div>This page should crash</div>`);
  crash();
  await page.waitForEvent('crash');
  const expectCrashError = (error: Error | null) => {
    expect(error, 'action should reject after crash').toBeTruthy();
    // In Firefox, crashed page is sometimes "closed".
    if (browserName === 'firefox')
      expect(error!.message.includes('has been closed') || error!.message.includes('crashed'), error!.message).toBe(true);
    else
      expect(error!.message).toContain('crashed');
  };
  expectCrashError(await page.evaluate(() => {}).then(() => null, e => e));
  expectCrashError(await page.goto(server.EMPTY_PAGE).then(() => null, e => e));
  expectCrashError(await page.reload().then(() => null, e => e));
});

test('expect should not hang when page crashed', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/31907' },
}, async ({ page, crash }) => {
  const expectPromise = expect(page.getByText('child')).toBeVisible();
  crash();
  await expect(expectPromise).rejects.toThrowError();
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

test('should be able to close context when page crashes', async ({ isAndroid, page, crash }) => {
  test.skip(isAndroid);

  await page.setContent(`<div>This page should crash</div>`);
  crash();
  await page.waitForEvent('crash');
  await page.context().close();
});

test('should be able to close page after crash', async ({ page, crash }) => {
  await page.setContent(`<div>This page should crash</div>`);
  crash();
  await page.waitForEvent('crash');
  await page.close();
  expect(page.isClosed()).toBe(true);
});

test.fixme('should reject in-flight worker.evaluate when page crashes', async ({ page, crash, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [worker] = await Promise.all([
    page.waitForEvent('worker'),
    page.evaluate(() => new Worker(URL.createObjectURL(
        new Blob(['self.onmessage = () => {}'], { type: 'application/javascript' })))),
  ]);
  const evalPromise = worker.evaluate(() => new Promise(() => {})).catch((e: Error) => e); // never resolves in-worker
  crash();
  const error = await evalPromise as Error;
  expect(error.message).toContain('crash');
});
