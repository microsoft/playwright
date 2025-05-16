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

it('should work @smoke', async ({ browser, httpsServer }) => {
  let error = null;
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const response = await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
  expect(error).toBe(null);
  expect(response.ok()).toBe(true);
  await context.close();
});

it('should isolate contexts', async ({ browser, httpsServer }) => {
  {
    let error = null;
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const response = await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
    expect(error).toBe(null);
    expect(response.ok()).toBe(true);
    await context.close();
  }
  {
    let error = null;
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
    expect(error).not.toBe(null);
    await context.close();
  }
});

it('should isolated contexts that share network process', {
  annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/35870' }
}, async ({ browser, httpsServer, browserName, isLinux }) => {
  it.fixme(browserName === 'webkit' && isLinux, 'See https://bugs.webkit.org/show_bug.cgi?id=293148');
  {
    const context = await browser.newContext({ ignoreHTTPSErrors: true });
    const page = await context.newPage();
    const response = await page.goto(httpsServer.EMPTY_PAGE);
    expect(response.ok()).toBe(true);
    // Closing the context will remove WebsiteDataStore and stop the network process
    // which will make the test pass.
    // await context.close();
  }
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    let error = null;
    await page.goto(httpsServer.EMPTY_PAGE).catch(e => error = e);
    expect(error, 'A TLS error expected, but the request succeeded.').not.toBe(null);
    await context.close();
  }
});

it('should work with mixed content', async ({ browser, server, httpsServer }) => {
  httpsServer.setRoute('/mixedcontent.html', (req, res) => {
    res.end(`<iframe src=${server.EMPTY_PAGE}></iframe>`);
  });
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await page.goto(httpsServer.PREFIX + '/mixedcontent.html', { waitUntil: 'load' });
  expect(page.frames().length).toBe(2);
  // Make sure blocked iframe has functional execution context
  // @see https://github.com/GoogleChrome/puppeteer/issues/2709
  expect(await page.frames()[0].evaluate('1 + 2')).toBe(3);
  expect(await page.frames()[1].evaluate('2 + 3')).toBe(5);
  await context.close();
});

it('should work with WebSocket', async ({ browser, httpsServer }) => {
  httpsServer.sendOnWebSocketConnection('incoming');
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  const value = await page.evaluate(endpoint => {
    let cb;
    const result = new Promise(f => cb = f);
    const ws = new WebSocket(endpoint);
    ws.addEventListener('message', data => { ws.close(); cb(data.data); });
    ws.addEventListener('error', error => cb('Error'));
    return result;
  }, httpsServer.PREFIX.replace(/https/, 'wss') + '/ws');
  expect(value).toBe('incoming');
  await context.close();
});

it('should fail with WebSocket if not ignored', async ({ browser, httpsServer }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const value = await page.evaluate(endpoint => {
    let cb;
    const result = new Promise(f => cb = f);
    const ws = new WebSocket(endpoint);
    ws.addEventListener('message', data => { ws.close(); cb(data.data); });
    ws.addEventListener('error', error => cb('Error'));
    return result;
  }, httpsServer.PREFIX.replace(/https/, 'wss') + '/ws');
  expect(value).toBe('Error');
  await context.close();
});

it('serviceWorker should intercept document request', async ({ browser, httpsServer, browserName }) => {
  it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/27768' });
  it.fixme(browserName === 'chromium');
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  await context.route('**/*', route => route.continue());
  httpsServer.setRoute('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(`
      self.addEventListener('fetch', event => {
        event.respondWith(new Response('intercepted'));
      });
      self.addEventListener('activate', event => {
        event.waitUntil(clients.claim());
      });
    `);
  });
  await page.goto(httpsServer.EMPTY_PAGE);
  await page.evaluate(async () => {
    const waitForControllerChange = new Promise(resolve => navigator.serviceWorker.oncontrollerchange = resolve);
    await navigator.serviceWorker.register('/sw.js');
    await waitForControllerChange;
  });
  await page.reload();
  expect(await page.textContent('body')).toBe('intercepted');
  await context.close();
});
