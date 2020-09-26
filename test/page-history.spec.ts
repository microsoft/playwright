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

import { it, expect } from './fixtures';
import url from 'url';

it('page.goBack should work', async ({page, server}) => {
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

it('page.goBack should work with HistoryAPI', async ({page, server}) => {
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

it('page.goBack should work for file urls', (test, { browserName, platform }) => {
  test.fail(browserName === 'webkit' && platform === 'darwin');
}, async ({page, server, asset}) => {
  // WebKit embedder fails to go back/forward to the file url.
  const url1 = url.pathToFileURL(asset('empty.html')).href;
  const url2 = server.EMPTY_PAGE;
  await page.goto(url1);
  await page.setContent(`<a href='${url2}'>url2</a>`);
  expect(page.url().toLowerCase()).toBe(url1.toLowerCase());

  await page.click('a');
  expect(page.url()).toBe(url2);

  await page.goBack();
  expect(page.url().toLowerCase()).toBe(url1.toLowerCase());
  // Should be able to evaluate in the new context, and
  // not reach for the old cross-process one.
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  // Should be able to screenshot.
  await page.screenshot();

  await page.goForward();
  expect(page.url()).toBe(url2);
  expect(await page.evaluate(() => window.scrollX)).toBe(0);
  await page.screenshot();
});

it('page.reload should work', async ({page, server}) => {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => window['_foo'] = 10);
  await page.reload();
  expect(await page.evaluate(() => window['_foo'])).toBe(undefined);
});

it('page.reload should work with data url', async ({page, server}) => {
  await page.goto('data:text/html,hello');
  expect(await page.content()).toContain('hello');
  expect(await page.reload()).toBe(null);
  expect(await page.content()).toContain('hello');
});
