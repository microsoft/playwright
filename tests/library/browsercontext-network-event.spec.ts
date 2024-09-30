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
import type { Request, Response } from '@playwright/test';

it('BrowserContext.Events.Request', async ({ context, server }) => {
  const page = await context.newPage();
  const requests: Request[] = [];
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

it('BrowserContext.Events.Response', async ({ context, server }) => {
  const page = await context.newPage();
  const responses: Response[] = [];
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

it('BrowserContext.Events.RequestFailed', async ({ context, server }) => {
  server.setRoute('/one-style.css', (_, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.connection!.destroy();
  });
  const page = await context.newPage();
  const failedRequests: Request[] = [];
  context.on('requestfailed', request => failedRequests.push(request));
  await page.goto(server.PREFIX + '/one-style.html');
  expect(failedRequests.length).toBe(1);
  expect(failedRequests[0].url()).toContain('one-style.css');
  expect(await failedRequests[0].response()).toBe(null);
  expect(failedRequests[0].resourceType()).toBe('stylesheet');
  expect(failedRequests[0].frame()).toBeTruthy();
});


it('BrowserContext.Events.RequestFinished', async ({ context, server }) => {
  const page = await context.newPage();
  const [response] = await Promise.all([
    page.goto(server.EMPTY_PAGE),
    context.waitForEvent('requestfinished')
  ]);
  const request = response!.request();
  expect(request.url()).toBe(server.EMPTY_PAGE);
  expect(await request.response()).toBeTruthy();
  expect(request.frame() === page.mainFrame()).toBe(true);
  expect(request.frame().url()).toBe(server.EMPTY_PAGE);
  expect(request.failure()).toBe(null);
});

it('should fire events in proper order', async ({ context, server }) => {
  const page = await context.newPage();
  const events: string[] = [];
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

it('should not fire events for favicon or favicon redirects', async ({ context, page, server, browserName, channel, headless }) => {
  it.skip(headless && browserName !== 'firefox', 'headless browsers, except firefox, do not request favicons');
  it.skip(!headless && browserName === 'webkit' && !channel, 'headed webkit does not have a favicon feature');
  const favicon = `/no-cache/favicon.ico`;
  const hashedFaviconUrl = `/favicon-hashed.ico`;
  const imagePath = `/fakeimage.png`;
  const pagePath = `/page.html`;
  server.setRedirect(favicon, hashedFaviconUrl);
  server.setRoute(pagePath, (_, res) => {
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <link rel="icon" type="image/svg+xml" href="${favicon}">
          <title>SVG Favicon Test</title>
        </head>
        <body>
          <img src="${imagePath}" alt="my fake image">
        </body>
      </html>
`);
  });

  const events: string[] = [];
  context.on('request', req => events.push(req.url()));
  context.on('response', res => events.push(res.url()));
  context.on('requestfinished', req => events.push(req.url()));

  await Promise.all([
    server.waitForRequest(favicon),
    server.waitForRequest(hashedFaviconUrl),
    page.goto(server.PREFIX + '/page.html'),
  ]);

  expect(events).toEqual(expect.arrayContaining([expect.stringContaining(pagePath)]));
  expect(events).toEqual(expect.arrayContaining([expect.stringContaining(imagePath)]));
  expect(events).not.toEqual(expect.arrayContaining([expect.stringContaining(favicon)]));
  expect(events).not.toEqual(expect.arrayContaining([expect.stringContaining(hashedFaviconUrl)]));
});

it('should reject response.finished if context closes', async ({ page, server }) => {
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
  await page.context().close();
  const error = await finishPromise;
  expect(error.message).toContain('closed');
});
