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

it('clicking on links which do not commit navigation', async ({ page, server, httpsServer }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.setContent(`<a href='${httpsServer.EMPTY_PAGE}'>foobar</a>`);
  await page.click('a');
});

it('calling window.stop async', async ({ page, server }) => {
  server.setRoute('/empty.html', async (req, res) => {});
  await page.evaluate(url => {
    window.location.href = url;
    setTimeout(() => window.stop(), 100);
  }, server.EMPTY_PAGE);
});

it('calling window.stop sync', async ({ page, server, browserName }) => {
  await page.evaluate(url => {
    window.location.href = url;
    window.stop();
  }, server.EMPTY_PAGE);
});

it('assigning location to about:blank', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(`window.location.href = "about:blank";`);
});

it('assigning location to about:blank after non-about:blank', async ({ page, server }) => {
  server.setRoute('/empty.html', async (req, res) => {});
  await page.evaluate(`
      window.location.href = "${server.EMPTY_PAGE}";
      window.location.href = "about:blank";`);
});

it('calling window.open and window.close', async function({ page, server }) {
  await page.goto(server.EMPTY_PAGE);
  await page.evaluate(() => {
    const popup = window.open(window.location.href);
    popup.close();
  });
});

it('opening a popup', async function({ page, server }) {
  await page.goto(server.EMPTY_PAGE);
  await Promise.all([
    page.waitForEvent('popup'),
    page.evaluate(() => window.open(window.location.href) && 1),
  ]);
});

it('clicking in the middle of navigation that aborts', async ({ page, server }) => {
  let abortCallback;
  const abortPromise = new Promise(f => abortCallback = f);

  let stallCallback;
  const stallPromise = new Promise(f => stallCallback = f);

  server.setRoute('/stall.html', async (req, res) => {
    stallCallback();
    await abortPromise;
    req.socket.destroy();
  });

  await page.goto(server.PREFIX + '/one-style.html');
  page.goto(server.PREFIX + '/stall.html').catch(() => {});
  await stallPromise;

  const clickPromise = page.click('body');
  await page.waitForTimeout(1000);
  abortCallback();

  await clickPromise;
});

it('clicking in the middle of navigation that commits', async ({ page, server }) => {
  let commitCallback;
  const abortPromise = new Promise(f => commitCallback = f);

  let stallCallback;
  const stallPromise = new Promise(f => stallCallback = f);

  server.setRoute('/stall.html', async (req, res) => {
    stallCallback();
    await abortPromise;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('hello world');
  });

  await page.goto(server.PREFIX + '/one-style.html');
  page.goto(server.PREFIX + '/stall.html').catch(() => {});
  await stallPromise;

  const clickPromise = page.click('body');
  await page.waitForTimeout(1000);
  commitCallback();

  await clickPromise;
  await expect(page.locator('body')).toContainText('hello world');
});

it('goBack in the middle of navigation that commits', async ({ page, server }) => {
  let commitCallback;
  const abortPromise = new Promise(f => commitCallback = f);

  let stallCallback;
  const stallPromise = new Promise(f => stallCallback = f);

  server.setRoute('/stall.html', async (req, res) => {
    stallCallback();
    await abortPromise;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('hello world');
  });

  await page.goto(server.PREFIX + '/one-style.html');
  page.goto(server.PREFIX + '/stall.html').catch(() => {});
  await stallPromise;

  const goBackPromise = page.goBack().catch(() => {});
  await page.waitForTimeout(1000);
  commitCallback();

  await goBackPromise;
});
