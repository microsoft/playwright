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

it('should work', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(url => window.location.href = url, server.PREFIX + '/grid.html');
  await page.waitForURL('**/grid.html');
});

it('should respect timeout', async ({ page, server }) => {
  const promise = page.waitForURL('**/frame.html', { timeout: 2500 }).catch(e => e);
  await page.goto(server.EMPTY_PAGE);
  const error = await promise;
  expect(error.message).toContain('page.waitForURL: Timeout 2500ms exceeded.');
});

it('should work with both domcontentloaded and load', async ({ page, server }) => {
  let response = null;
  server.setRoute('/one-style.css', (req, res) => response = res);
  const navigationPromise = page.goto(server.PREFIX + '/one-style.html');
  const domContentLoadedPromise = page.waitForURL('**/one-style.html', { waitUntil: 'domcontentloaded' });
  let bothFired = false;
  const bothFiredPromise = Promise.all([
    page.waitForURL('**/one-style.html', { waitUntil: 'load' }),
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
  await page.waitForURL('**/empty.html', { waitUntil: 'commit' });
  expect(await page.title()).toBe('Hello');
});

it('should work with commit and about:blank', async ({ page, server }) => {
  await page.waitForURL('about:blank', { waitUntil: 'commit' });
});

it('should work with clicking on anchor links', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href='#foobar'>foobar</a>`);
  await page.click('a');
  await page.waitForURL('**/*#foobar');
});

it('should work with history.pushState()', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`
    <a onclick='javascript:pushState()'>SPA</a>
    <script>
      function pushState() { history.pushState({}, '', 'wow.html') }
    </script>
  `);
  await page.click('a');
  await page.waitForURL('**/wow.html');
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
  await page.click('a');
  await page.waitForURL('**/replaced.html');
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

  await page.click('a#back');
  await page.waitForURL('**/first.html');
  expect(page.url()).toBe(server.PREFIX + '/first.html');

  await page.click('a#forward');
  await page.waitForURL('**/second.html');
  expect(page.url()).toBe(server.PREFIX + '/second.html');
});

it('should work with url match for same document navigations', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let resolved = false;
  const waitPromise = page.waitForURL(/third\.html/).then(() => resolved = true);
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

it('should work on frame', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/frames/one-frame.html');
  const frame = page.frames()[1];
  await frame.evaluate(url => window.location.href = url, server.PREFIX + '/grid.html');
  await frame.waitForURL('**/grid.html');
});
