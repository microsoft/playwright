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
import { attachFrame } from '../config/utils';

it('should fire for navigation requests', async ({ page, server }) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  expect(requests.length).toBe(1);
});

it('should fire for iframes', async ({ page, server }) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  await attachFrame(page, 'frame1', server.EMPTY_PAGE);
  expect(requests.length).toBe(2);
});

it('should fire for fetches', async ({ page, server }) => {
  const requests = [];
  page.on('request', request => requests.push(request));
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => fetch('/empty.html'));
  expect(requests.length).toBe(2);
});

it('should report requests and responses handled by service worker', async ({ page, server, isAndroid, isElectron }) => {
  it.fixme(isAndroid);
  it.fixme(isElectron);

  await page.goto(server.PREFIX + '/serviceworkers/fetchdummy/sw.html');
  await page.evaluate(() => window['activationPromise']);
  const [swResponse, request] = await Promise.all([
    page.evaluate(() => window['fetchDummy']('foo')),
    page.waitForEvent('request'),
  ]);
  expect(swResponse).toBe('responseFromServiceWorker:foo');
  expect(request.url()).toBe(server.PREFIX + '/serviceworkers/fetchdummy/foo');
  const response = await request.response();
  expect(response.url()).toBe(server.PREFIX + '/serviceworkers/fetchdummy/foo');
  expect(await response.text()).toBe('responseFromServiceWorker:foo');
});

it('should return response body when Cross-Origin-Opener-Policy is set', async ({ page, server, browserName }) => {
  server.setRoute('/empty.html', (req, res) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.end('Hello there!');
  });
  const response = await page.goto(server.EMPTY_PAGE);
  expect(page.url()).toBe(server.EMPTY_PAGE);
  await response.finished();
  expect(response.request().failure()).toBeNull();
  expect(await response.text()).toBe('Hello there!');
});

it('should fire requestfailed when intercepting race', async ({ page, server, browserName }) => {
  it.skip(browserName !== 'chromium', 'This test is specifically testing Chromium race');

  const promsie = new Promise<void>(resolve => {
    let counter = 0;
    const failures = new Set();
    const alive = new Set();
    page.on('request', request => {
      expect(alive.has(request)).toBe(false);
      expect(failures.has(request)).toBe(false);
      alive.add(request);
    });
    page.on('requestfailed', request => {
      expect(failures.has(request)).toBe(false);
      expect(alive.has(request)).toBe(true);
      alive.delete(request);
      failures.add(request);
      if (++counter === 10)
        resolve();
    });
  });

  // Stall requests to make sure we don't get requestfinished.
  await page.route('**', route => {});

  await page.setContent(`
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <iframe src="${server.EMPTY_PAGE}"></iframe>
    <script>
      function abortAll() {
        const frames = document.querySelectorAll("iframe");
        for (const frame of frames)
          frame.src = "about:blank";
      }
      abortAll();
    </script>
  `);

  await promsie;
});
