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

import { browserTest as it, expect } from './config/browserTest';

it('should construct a new URL when a path in browser.newContext is passed to page.goto', async function({browser, server}) {
  const context = await browser.newContext({
    baseURL: server.PREFIX,
  });
  const page = await context.newPage();
  expect((await page.goto('/empty.html')).url()).toBe(server.EMPTY_PAGE);
  await context.close();
});

it('should construct a new URL when a path in browser.newPage is passed to page.goto', async function({browser, server}) {
  const page = await browser.newPage({
    baseURL: server.PREFIX,
  });
  expect((await page.goto('/empty.html')).url()).toBe(server.EMPTY_PAGE);
  await page.close();
});

it('should construct a new URL when a relative path in browser.newPage is passed to page.goto', async function({browser, server}) {
  const page = await browser.newPage({
    baseURL: server.PREFIX + '/url-construction',
  });
  expect((await page.goto('mypage.html')).url()).toBe(server.PREFIX + '/url-construction/mypage.html');
  expect((await page.goto('./mypage.html')).url()).toBe(server.PREFIX + '/url-construction/mypage.html');
  await page.close();
});

it('should construct a new URL when a relative path in browser.newPage is passed to page.goto', async function({browser, server}) {
  const page = await browser.newPage({
    baseURL: server.PREFIX + '/url-construction/',
  });
  expect((await page.goto('mypage.html')).url()).toBe(server.PREFIX + '/url-construction/mypage.html');
  expect((await page.goto('./mypage.html')).url()).toBe(server.PREFIX + '/url-construction/mypage.html');
  await page.close();
});

it('should navigate to the base URL if / or empty string is passed', async function({browser, server}) {
  const page = await browser.newPage({
    baseURL: server.PREFIX + '/url-construction',
  });
  expect((await page.goto('')).url()).toBe(server.PREFIX + '/url-construction');
  expect((await page.goto('/')).url()).toBe(server.PREFIX + '/url-construction/');
  await page.close();
});

it('should not construct a new URL when the given URL is valid', async function({browser, server}) {
  const page = await browser.newPage({
    baseURL: 'http://microsoft.com',
  });
  expect((await page.goto(server.EMPTY_PAGE)).url()).toBe(server.EMPTY_PAGE);
  await page.close();
});

it('should not construct a new URL when no valid HTTP URLs are passed', async function({browser, server}) {
  const page = await browser.newPage({
    baseURL: 'http://microsoft.com',
  });
  await page.goto('data:text/html,Hello world');
  expect(await page.evaluate(() => window.location.href)).toBe('data:text/html,Hello world');

  await page.goto('about:blank');
  expect(await page.evaluate(() => window.location.href)).toBe('about:blank');
  await page.close();
});
