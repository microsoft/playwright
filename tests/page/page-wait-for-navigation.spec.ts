/**
 * Copyright 2018 Google Inc. All rights reserved.
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

import { test as it, expect } from './pageTest';
import type { Frame } from 'playwright-core';
import { expectedSSLError } from '../config/utils';

it('should work', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.evaluate(url => window.location.href = url, server.PREFIX + '/grid.html')
  ]);
  expect(response.ok()).toBe(true);
  expect(response.url()).toContain('grid.html');
});

it('should respect timeout', async ({ page, server }) => {
  const promise = page.waitForNavigation({ url: '**/frame.html', timeout: 5000 });
  await page.goto(server.EMPTY_PAGE);
  const error = await promise.catch(e => e);
  expect(error.message).toContain('page.waitForNavigation: Timeout 5000ms exceeded.');
  expect(error.message).toContain('waiting for navigation to "**/frame.html" until "load"');
  expect(error.message).toContain(`navigated to "${server.EMPTY_PAGE}"`);
});

it('should work with both domcontentloaded and load', async ({ page, server }) => {
  let response = null;
  server.setRoute('/one-style.css', (req, res) => response = res);
  const navigationPromise = page.goto(server.PREFIX + '/one-style.html');
  const domContentLoadedPromise = page.waitForNavigation({
    waitUntil: 'domcontentloaded'
  });

  let bothFired = false;
  const bothFiredPromise = Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    domContentLoadedPromise
  ]).then(() => bothFired = true);

  await server.waitForRequest('/one-style.css');
  await domContentLoadedPromise;
  expect(bothFired).toBe(false);
  response.end();
  await bothFiredPromise;
  await navigationPromise;
});

it('should work with commit', async ({ page, server }) => {
  server.setRoute('/script.js', (req, res) => {});
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end('<title>Hello</title><script src="script.js"></script>');
  });
  page.goto(server.EMPTY_PAGE).catch(e => {});
  await page.waitForNavigation({ waitUntil: 'commit' });
  expect(await page.title()).toBe('Hello');
});

it('should work with clicking on anchor links', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href='#foobar'>foobar</a>`);
  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.click('a'),
  ]);
  expect(response).toBe(null);
  expect(page.url()).toBe(server.EMPTY_PAGE + '#foobar');
});

it('should work with clicking on links which do not commit navigation', async ({ page, server, httpsServer, browserName, platform }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href='${httpsServer.EMPTY_PAGE}'>foobar</a>`);
  const [error] = await Promise.all([
    page.waitForNavigation().catch(e => e),
    page.click('a'),
  ]);
  expect(error.message).toMatch(expectedSSLError(browserName, platform));
});

it('should work with history.pushState()', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <a onclick='javascript:pushState()'>SPA</a>
    <script>
      function pushState() { history.pushState({}, '', 'wow.html') }
    </script>
  `);
  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.click('a'),
  ]);
  expect(response).toBe(null);
  expect(page.url()).toBe(server.PREFIX + '/wow.html');
});

it('should work with history.replaceState()', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <a onclick='javascript:replaceState()'>SPA</a>
    <script>
      function replaceState() { history.replaceState({}, '', '/replaced.html') }
    </script>
  `);
  const [response] = await Promise.all([
    page.waitForNavigation(),
    page.click('a'),
  ]);
  expect(response).toBe(null);
  expect(page.url()).toBe(server.PREFIX + '/replaced.html');
});

it('should work with DOM history.back()/history.forward()', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <a id=back onclick='javascript:goBack()'>back</a>
    <a id=forward onclick='javascript:goForward()'>forward</a>
    <script>
      function goBack() { history.back(); }
      function goForward() { history.forward(); }
      history.pushState({}, '', '/first.html');
      history.pushState({}, '', '/second.html');
    </script>
  `);
  expect(page.url()).toBe(server.PREFIX + '/second.html');
  const [backResponse] = await Promise.all([
    page.waitForNavigation(),
    page.click('a#back'),
  ]);
  expect(backResponse).toBe(null);
  expect(page.url()).toBe(server.PREFIX + '/first.html');
  const [forwardResponse] = await Promise.all([
    page.waitForNavigation(),
    page.click('a#forward'),
  ]);
  expect(forwardResponse).toBe(null);
  expect(page.url()).toBe(server.PREFIX + '/second.html');
});

it('should work when subframe issues window.stop()', async ({ browserName, page, server }) => {
  it.fixme(browserName === 'webkit', 'WebKit issues load event in some cases, but not always');

  server.setRoute('/frames/style.css', (req, res) => {});
  let done = false;
  page.goto(server.PREFIX + '/frames/one-frame.html').then(() => done = true).catch(() => {});
  const frame = await new Promise<Frame>(f => page.once('frameattached', f));
  await new Promise<void>(fulfill => page.on('framenavigated', f => {
    if (f === frame)
      fulfill();
  }));
  await frame.evaluate(() => window.stop());
  expect(done).toBe(true);
});

it('should work with url match', async ({ page, server }) => {
  let response1 = null;
  const response1Promise = page.waitForNavigation({ url: /one-style\.html/ }).then(response => response1 = response);
  let response2 = null;
  const response2Promise = page.waitForNavigation({ url: /\/frame.html/ }).then(response => response2 = response);
  let response3 = null;
  const response3Promise = page.waitForNavigation({ url: url => url.searchParams.get('foo') === 'bar' }).then(response => response3 = response);
  expect(response1).toBe(null);
  expect(response2).toBe(null);
  expect(response3).toBe(null);
  await page.goto(server.EMPTY_PAGE);
  expect(response1).toBe(null);
  expect(response2).toBe(null);
  expect(response3).toBe(null);
  await page.goto(server.PREFIX + '/frame.html');
  expect(response1).toBe(null);
  await response2Promise;
  expect(response2).not.toBe(null);
  expect(response3).toBe(null);
  await page.goto(server.PREFIX + '/one-style.html');
  await response1Promise;
  expect(response1).not.toBe(null);
  expect(response2).not.toBe(null);
  expect(response3).toBe(null);
  await page.goto(server.PREFIX + '/frame.html?foo=bar');
  await response3Promise;
  expect(response1).not.toBe(null);
  expect(response2).not.toBe(null);
  expect(response3).not.toBe(null);
  await page.goto(server.PREFIX + '/empty.html');
  expect(response1.url()).toBe(server.PREFIX + '/one-style.html');
  expect(response2.url()).toBe(server.PREFIX + '/frame.html');
  expect(response3.url()).toBe(server.PREFIX + '/frame.html?foo=bar');
});

it('should work with url match for same document navigations', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let resolved = false;
  const waitPromise = page.waitForNavigation({ url: /third\.html/ }).then(() => resolved = true);
  expect(resolved).toBe(false);
  await page.evaluate(() => {
    history.pushState({}, '', '/first.html');
  });
  expect(resolved).toBe(false);
  await page.evaluate(() => {
    history.pushState({}, '', '/second.html');
  });
  expect(resolved).toBe(false);
  await page.evaluate(() => {
    history.pushState({}, '', '/third.html');
  });
  await waitPromise;
  expect(resolved).toBe(true);
});

it('should work for cross-process navigations', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  const waitPromise = page.waitForNavigation({ waitUntil: 'domcontentloaded' });
  const url = server.CROSS_PROCESS_PREFIX + '/empty.html';
  const gotoPromise = page.goto(url);
  const response = await waitPromise;
  expect(response.url()).toBe(url);
  expect(page.url()).toBe(url);
  expect(await page.evaluate('document.location.href')).toBe(url);
  await gotoPromise;
});

it('should work on frame', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const frame = page.frames()[1];
  const [response] = await Promise.all([
    frame.waitForNavigation(),
    frame.evaluate(url => window.location.href = url, server.PREFIX + '/grid.html')
  ]);
  expect(response.ok()).toBe(true);
  expect(response.url()).toContain('grid.html');
  expect(response.frame()).toBe(frame);
  expect(page.url()).toContain('/frames/one-frame.html');
});

it('should fail when frame detaches', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const frame = page.frames()[1];
  server.setRoute('/empty.html', () => {});
  server.setRoute('/one-style.css', () => {});
  const [error] = await Promise.all([
    frame.waitForNavigation().catch(e => e),
    page.$eval('iframe', frame => { frame.contentWindow.location.href = '/one-style.html'; }),
    // Make sure policy checks pass and navigation actually begins before removing the frame to avoid other errors
    server.waitForRequest('/one-style.css').then(() => page.$eval('iframe', frame => window.builtins.setTimeout(() => frame.remove(), 0)))
  ]);
  expect(error.message).toContain('waiting for navigation until "load"');
  expect(error.message).toContain('frame was detached');
});
