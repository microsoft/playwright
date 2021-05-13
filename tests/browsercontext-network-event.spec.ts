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

it('BrowserContext.Events.Request', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const requests = [];
  context.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
  const [page1] = await Promise.all([
    context.waitForEvent('page'),
    page.click('a'),
  ]);
  await page1.waitForLoadState();
  const urls = requests.map(r => r.url());
  expect(urls).toEqual([
    server.EMPTY_PAGE,
    `${server.PREFIX}/one-style.html`,
    `${server.PREFIX}/one-style.css`
  ]);
});

it('BrowserContext.Events.Response', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const responses = [];
  context.on('response', response => responses.push(response));
  await page.goto(server.EMPTY_PAGE);
  await page.setContent('<a target=_blank rel=noopener href="/one-style.html">yo</a>');
  const [page1] = await Promise.all([
    context.waitForEvent('page'),
    page.click('a'),
  ]);
  await page1.waitForLoadState();
  const urls = responses.map(r => r.url());
  expect(urls).toEqual([
    server.EMPTY_PAGE,
    `${server.PREFIX}/one-style.html`,
    `${server.PREFIX}/one-style.css`
  ]);
});

it('BrowserContext.Events.RequestFailed', async ({browser, server}) => {
  server.setRoute('/one-style.css', (_, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.connection.destroy();
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const failedRequests = [];
  context.on('requestfailed', request => failedRequests.push(request));
  await page.goto(server.PREFIX + '/one-style.html');
  expect(failedRequests.length).toBe(1);
  expect(failedRequests[0].url()).toContain('one-style.css');
  expect(await failedRequests[0].response()).toBe(null);
  expect(failedRequests[0].resourceType()).toBe('stylesheet');
  expect(failedRequests[0].frame()).toBeTruthy();
});


it('BrowserContext.Events.RequestFinished', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const [response] = await Promise.all([
    page.goto(server.EMPTY_PAGE),
    context.waitForEvent('requestfinished')
  ]);
  const request = response.request();
  expect(request.url()).toBe(server.EMPTY_PAGE);
  expect(await request.response()).toBeTruthy();
  expect(request.frame() === page.mainFrame()).toBe(true);
  expect(request.frame().url()).toBe(server.EMPTY_PAGE);
  expect(request.failure()).toBe(null);
});

it('should fire events in proper order', async ({browser, server}) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const events = [];
  context.on('request', () => events.push('request'));
  context.on('response', () => events.push('response'));
  context.on('requestfinished', () => events.push('requestfinished'));
  await Promise.all([
    page.goto(server.EMPTY_PAGE),
    context.waitForEvent('requestfinished')
  ]);
  expect(events).toEqual([
    'request',
    'response',
    'requestfinished',
  ]);
});
