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

import { stripAnsi } from '../config/utils';
import { browserTest as test, expect } from '../config/browserTest';
import { kTargetClosedErrorMessage } from '../config/errors';

test('PA-039 should close page with active dialog', async ({ page }) => {
  await page.evaluate('"trigger builtins.setTimeout"');
  await page.setContent(`<button onclick="builtins.setTimeout(() => alert(1))">alert</button>`);
  void page.click('button').catch(() => {});
  await page.waitForEvent('dialog');
  await page.close();
});

test('PA-040 expect should not print timed out error message when page closes', async ({ page }) => {
  await page.setContent('<div id=node>Text content</div>');
  const [error] = await Promise.all([
    expect(page.locator('div')).toHaveText('hey', { timeout: 100000 }).catch(e => e),
    page.close(),
  ]);
  expect(stripAnsi(error.message)).toContain(`expect(locator).toHaveText(expected)`);
  expect(stripAnsi(error.message)).not.toContain('Timed out');
});

test('PA-041 addLocatorHandler should throw when page closes', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/input/handle-locator.html');

  await page.addLocatorHandler(page.getByText('This interstitial covers the button'), async () => {
    await page.close({ reason: 'custom reason' });
  });

  await page.locator('#aside').hover();
  await page.evaluate(() => {
    (window as any).clicked = 0;
    (window as any).setupAnnoyingInterstitial('mouseover', 1);
  });
  const error = await page.locator('#target').click().catch(e => e);
  expect(error.message).toContain('custom reason');
});

test('PA-042 should reject all promises when page is closed', async ({ page }) => {
  let error = null;
  await Promise.all([
    page.evaluate(() => new Promise(r => {})).catch(e => error = e),
    page.close(),
  ]);
  expect(error.message).toContain(kTargetClosedErrorMessage);
});

test('PA-043 should set the page close state', async ({ page }) => {
  expect(page.isClosed()).toBe(false);
  await page.close();
  expect(page.isClosed()).toBe(true);
});

test('PA-044 should pass page to close event', async ({ page }) => {
  const [closedPage] = await Promise.all([
    page.waitForEvent('close'),
    page.close()
  ]);
  expect(closedPage).toBe(page);
});

test('PA-045 should terminate network waiters', async ({ page, server }) => {
  const results = await Promise.all([
    page.waitForRequest(server.EMPTY_PAGE).catch(e => e),
    page.waitForResponse(server.EMPTY_PAGE).catch(e => e),
    page.close()
  ]);
  for (let i = 0; i < 2; i++) {
    const message = results[i].message;
    expect(message).toContain(kTargetClosedErrorMessage);
    expect(message).not.toContain('Timeout');
  }
});

test('PA-046 should be callable twice', async ({ page }) => {
  await Promise.all([
    page.close(),
    page.close(),
  ]);
  await page.close();
});

test('PA-047 should return null if parent page has been closed', async ({ page }) => {
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open('about:blank')),
  ]);
  await page.close();
  const opener = await popup.opener();
  expect(opener).toBe(null);
});

test('PA-048 should fail with error upon disconnect', async ({ page }) => {
  let error;
  const waitForPromise = page.waitForEvent('download').catch(e => error = e);
  await page.close();
  await waitForPromise;
  expect(error.message).toContain(kTargetClosedErrorMessage);
});

test('PA-049 page.close should work with window.close', async function({ page }) {
  const closedPromise = new Promise(x => page.on('close', x));
  await page.close();
  await closedPromise;
});

test('PA-050 should not throw UnhandledPromiseRejection when page closes', async ({ page, browserName, isWindows }) => {
  test.fixme(browserName === 'firefox' && isWindows, 'makes the next test to always timeout');

  await Promise.all([
    page.close(),
    page.mouse.click(1, 2),
  ]).catch(e => {});
});

test('PA-051 interrupt request.response() and request.allHeaders() on page.close', async ({ page, server, browserName, channel }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27227' });
  server.setRoute('/one-style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
  });
  const reqPromise = page.waitForRequest('**/one-style.css');
  await page.goto(server.PREFIX + '/one-style.html', { waitUntil: 'domcontentloaded' });
  const req = await reqPromise;
  const respPromise = req.response().catch(e => e);
  const headersPromise = req.allHeaders().catch(e => e);
  await page.close();
  expect((await respPromise).message).toContain(kTargetClosedErrorMessage);
  // All headers are the same as "provisional" headers in Firefox.
  if (browserName === 'firefox')
    expect((await headersPromise)['user-agent']).toBeTruthy();
  else
    expect((await headersPromise).message).toContain(kTargetClosedErrorMessage);
});

test('PA-052 should not treat navigations as new popups', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.click('a'),
  ]);
  let badSecondPopup = false;
  page.on('popup', () => badSecondPopup = true);
  await popup.goto(server.CROSS_PROCESS_PREFIX + '/empty.html');
  await page.close();
  expect(badSecondPopup).toBe(false);
});

test('PA-053 should not result in unhandled rejection', async ({ page }) => {
  const closedPromise = page.waitForEvent('close');
  await page.exposeFunction('foo', async () => {
    await page.close();
  });
  await page.evaluate(() => {
    window.builtins.setTimeout(() => (window as any).foo(), 0);
    return undefined;
  });
  await closedPromise;
  // Make a round-trip to be sure we did not throw immediately after closing.
  expect(await page.evaluate('1 + 1').catch(e => e)).toBeInstanceOf(Error);
});

test('PA-054 should reject response.finished if page closes', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  server.setRoute('/get', (req, res) => {
    // In Firefox, |fetch| will be hanging until it receives |Content-Type| header
    // from server.
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.write('hello ');
  });
  // send request and wait for server response
  const [pageResponse] = await Promise.all([
    page.waitForEvent('response'),
    page.evaluate(() => fetch('./get', { method: 'GET' })),
  ]);

  const finishPromise = pageResponse.finished().catch(e => e);
  await page.close();
  const error = await finishPromise;
  expect(error.message).toContain('closed');
});

test('PA-055 should not throw when continuing while page is closing', async ({ page, server }) => {
  let done;
  await page.route('**/*', async route => {
    done = Promise.all([
      void route.continue(),
      page.close(),
    ]);
  });
  await page.goto(server.EMPTY_PAGE).catch(e => e);
  await done;
});

test('PA-056 should not throw when continuing after page is closed', async ({ page, server }) => {
  let done;
  await page.route('**/*', async route => {
    await page.close();
    done = route.continue();
  });
  const error = await page.goto(server.EMPTY_PAGE).catch(e => e);
  await done;
  expect(error).toBeInstanceOf(Error);
});
