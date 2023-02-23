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
import url from 'url';

it('page.goBack should work @smoke', async ({ page, server }) => {
  expect(await page.goBack()).toBe(null);

  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.PREFIX + '/grid.html');

  let response = await page.goBack();
  expect(response.ok()).toBe(true);
  expect(response.url()).toContain(server.EMPTY_PAGE);

  response = await page.goForward();
  expect(response.ok()).toBe(true);
  expect(response.url()).toContain('/grid.html');

  response = await page.goForward();
  expect(response).toBe(null);
});

it('page.goBack should work with HistoryAPI', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => {
    history.pushState({}, '', '/first.html');
    history.pushState({}, '', '/second.html');
  });
  expect(page.url()).toBe(server.PREFIX + '/second.html');

  await page.goBack();
  expect(page.url()).toBe(server.PREFIX + '/first.html');
  await page.goBack();
  expect(page.url()).toBe(server.EMPTY_PAGE);
  await page.goForward();
  expect(page.url()).toBe(server.PREFIX + '/first.html');
});

it('page.goBack should work for file urls', async ({ page, server, asset, browserName, platform, isAndroid }) => {
  it.fail(browserName === 'webkit' && platform === 'darwin', 'WebKit embedder fails to go back/forward to the file url.');
  it.skip(isAndroid, 'No files on Android');

  const url1 = url.pathToFileURL(asset('consolelog.html')).href;
  const url2 = server.PREFIX + '/consolelog.html';
  await Promise.all([
    page.waitForEvent('console', message => message.text() === 'here:' + url1),
    page.goto(url1),
  ]);
  await page.setContent(`<a href='${url2}'>url2</a>`);
  expect(page.url().toLowerCase()).toBe(url1.toLowerCase());

  await Promise.all([
    page.waitForEvent('console', message => message.text() === 'here:' + url2),
    page.click('a'),
  ]);
  expect(page.url()).toBe(url2);

  await Promise.all([
    page.waitForEvent('console', message => message.text() === 'here:' + url1),
    page.goBack(),
  ]);
  expect(page.url().toLowerCase()).toBe(url1.toLowerCase());
  // Should be able to evaluate in the new context, and
  // not reach for the old cross-process one.
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  // Should be able to screenshot.
  await page.screenshot();

  await Promise.all([
    page.waitForEvent('console', message => message.text() === 'here:' + url2),
    page.goForward(),
  ]);
  expect(page.url()).toBe(url2);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await page.screenshot();
});

it('goBack/goForward should work with bfcache-able pages', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/cached/one-style.html');
  await page.setContent(`<a href=${JSON.stringify(server.PREFIX + '/cached/one-style.html?foo')}>click me</a>`);
  await page.click('a');

  let response = await page.goBack();
  expect(response.url()).toBe(server.PREFIX + '/cached/one-style.html');

  response = await page.goForward();
  expect(response.url()).toBe(server.PREFIX + '/cached/one-style.html?foo');
});

it('page.reload should work', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => window['_foo'] = 10);
  await page.reload();
  expect(await page.evaluate(() => window['_foo'])).toBe(undefined);
});

it('page.reload should work with data url', async ({ page, server }) => {
  await page.goto('data:text/html,hello');
  expect(await page.content()).toContain('hello');
  expect(await page.reload()).toBe(null);
  expect(await page.content()).toContain('hello');
});

it('page.reload during renderer-initiated navigation', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/one-style.html');
  await page.setContent(`<form method='POST' action='/post'>Form is here<input type='submit'></form>`);
  server.setRoute('/post', (req, res) => {});

  let callback;
  const reloadFailedPromise = new Promise(f => callback = f);
  page.once('request', async () => {
    await page.reload().catch(e => {});
    callback();
  });
  const clickPromise = page.click('input[type=submit]').catch(e => {});
  await reloadFailedPromise;
  await clickPromise;

  // Form submit should be canceled, and reload should eventually arrive
  // to the original one-style.html.
  await page.waitForSelector('text=hello');
});

it('page.reload should not resolve with same-document navigation', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  // 1. Make sure execution contexts are ready for fast evaluate.
  await page.evaluate('1');

  // 2. Stall the reload request.
  let response;
  server.setRoute('/empty.html', (req, res) => { response = res; });
  const requestPromise = server.waitForRequest('/empty.html');

  // 3. Trigger push state that could resolve the reload.
  page.evaluate(() => {
    window.history.pushState({}, '');
  }).catch(() => {});

  // 4. Trigger the reload, it should not resolve.
  const reloadPromise = page.reload();

  // 5. Trigger push state again, for the good measure :)
  page.evaluate(() => {
    window.history.pushState({}, '');
  }).catch(() => {});

  // 5. Serve the request, it should resolve the reload.
  await requestPromise;
  response.end('hello');

  // 6. Check the reload response.
  const gotResponse = await reloadPromise;
  expect(await gotResponse.text()).toBe('hello');
});

it('page.reload should work with same origin redirect', async ({ page, server }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16147' });
  await page.goto(server.EMPTY_PAGE);
  server.setRedirect('/empty.html', server.PREFIX + '/title.html');
  await page.reload();
  await expect(page).toHaveURL(server.PREFIX + '/title.html');
});

it('page.reload should work with cross-origin redirect', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/16147' });
  await page.goto(server.EMPTY_PAGE);
  server.setRedirect('/empty.html', server.CROSS_PROCESS_PREFIX + '/title.html');
  await page.reload();
  await expect(page).toHaveURL(server.CROSS_PROCESS_PREFIX + '/title.html');
});

it('page.reload should work on a page with a hash', async ({ page, server, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/21145' });
  it.fixme(browserName === 'firefox');
  await page.goto(server.EMPTY_PAGE + '#hash');
  await page.reload();
  await expect(page).toHaveURL(server.EMPTY_PAGE + '#hash');
});

it('page.goBack during renderer-initiated navigation', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/one-style.html');
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<form method='POST' action='/post'>Form is here<input type='submit'></form>`);
  server.setRoute('/post', (req, res) => {});

  let callback;
  const reloadFailedPromise = new Promise(f => callback = f);
  page.once('request', async () => {
    await page.goBack().catch(e => {});
    callback();
  });
  const clickPromise = page.click('input[type=submit]').catch(e => {});
  await reloadFailedPromise;
  await clickPromise;

  // Form submit should be canceled, and goBack should eventually arrive
  // to the original one-style.html.
  await page.waitForSelector('text=hello');
});

it('page.goForward during renderer-initiated navigation', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.goto(server.PREFIX + '/one-style.html');
  await page.goBack();

  await page.setContent(`<form method='POST' action='/post'>Form is here<input type='submit'></form>`);
  server.setRoute('/post', (req, res) => {});

  let callback;
  const reloadFailedPromise = new Promise(f => callback = f);
  page.once('request', async () => {
    await page.goForward().catch(e => {});
    callback();
  });
  const clickPromise = page.click('input[type=submit]').catch(e => {});
  await reloadFailedPromise;
  await clickPromise;

  // Form submit should be canceled, and goForward should eventually arrive
  // to the original one-style.html.
  await page.waitForSelector('text=hello');
});
