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

import { browserTest as it, expect } from '../config/browserTest';

it('should construct a new URL when a baseURL in browser.newContext is passed to page.goto @smoke', async function({ browser, server }) {
  const context = await browser.newContext({
    baseURL: server.PREFIX,
  });
  const page = await context.newPage();
  expect((await page.goto('/empty.html'))!.url()).toBe(server.EMPTY_PAGE);
  await context.close();
});

it('should construct a new URL when a baseURL in browser.newPage is passed to page.goto', async function({ browser, server }) {
  const page = await browser.newPage({
    baseURL: server.PREFIX,
  });
  expect((await page.goto('/empty.html'))!.url()).toBe(server.EMPTY_PAGE);
  await page.close();
});

it('should construct a new URL when a baseURL in browserType.launchPersistentContext is passed to page.goto', async function({ browserType, server, createUserDataDir }) {
  const userDataDir = await createUserDataDir();
  const context = await browserType.launchPersistentContext(userDataDir, {
    baseURL: server.PREFIX,
  });
  const page = await context.newPage();
  expect((await page.goto('/empty.html'))!.url()).toBe(server.EMPTY_PAGE);
  await context.close();
});

it('should construct the URLs correctly when a baseURL without a trailing slash in browser.newPage is passed to page.goto', async function({ browser, server }) {
  const page = await browser.newPage({
    baseURL: server.PREFIX + '/url-construction',
  });
  expect((await page.goto('mypage.html'))!.url()).toBe(server.PREFIX + '/mypage.html');
  expect((await page.goto('./mypage.html'))!.url()).toBe(server.PREFIX + '/mypage.html');
  expect((await page.goto('/mypage.html'))!.url()).toBe(server.PREFIX + '/mypage.html');
  await page.close();
});

it('should construct the URLs correctly when a baseURL with a trailing slash in browser.newPage is passed to page.goto', async function({ browser, server }) {
  const page = await browser.newPage({
    baseURL: server.PREFIX + '/url-construction/',
  });
  expect((await page.goto('mypage.html'))!.url()).toBe(server.PREFIX + '/url-construction/mypage.html');
  expect((await page.goto('./mypage.html'))!.url()).toBe(server.PREFIX + '/url-construction/mypage.html');
  expect((await page.goto('/mypage.html'))!.url()).toBe(server.PREFIX + '/mypage.html');
  expect((await page.goto('.'))!.url()).toBe(server.PREFIX + '/url-construction/');
  expect((await page.goto('/'))!.url()).toBe(server.PREFIX + '/');
  await page.close();
});

it('should not construct a new URL when valid URLs are passed', async function({ browser, server }) {
  const page = await browser.newPage({
    baseURL: 'http://microsoft.com',
  });
  expect((await page.goto(server.EMPTY_PAGE))!.url()).toBe(server.EMPTY_PAGE);

  await page.goto('data:text/html,Hello world');
  expect(await page.evaluate(() => window.location.href)).toBe('data:text/html,Hello world');

  await page.goto('about:blank');
  expect(await page.evaluate(() => window.location.href)).toBe('about:blank');
  await page.close();
});

it('should be able to match a URL relative to its given URL with urlMatcher', async function({ browser, server }) {
  const page = await browser.newPage({
    baseURL: server.PREFIX + '/foobar/',
  });
  await page.goto('/kek/index.html');
  await page.waitForURL('/kek/index.html');
  expect(page.url()).toBe(server.PREFIX + '/kek/index.html');

  await page.route('./kek/index.html', route => route.fulfill({
    body: 'base-url-matched-route',
  }));
  const [request, response] = await Promise.all([
    page.waitForRequest('./kek/index.html'),
    page.waitForResponse('./kek/index.html'),
    page.goto('./kek/index.html'),
  ]);
  expect(request.url()).toBe(server.PREFIX + '/foobar/kek/index.html');
  expect(response.url()).toBe(server.PREFIX + '/foobar/kek/index.html');
  expect((await response.body()).toString()).toBe('base-url-matched-route');
  await page.close();
});

it('should not construct a new URL with baseURL when a glob was used', async function({ browser, server }) {
  const page = await browser.newPage({
    baseURL: server.PREFIX + '/foobar/',
  });
  await page.goto('./kek/index.html');
  await page.waitForURL('**/foobar/kek/index.html');
  await page.close();
});
