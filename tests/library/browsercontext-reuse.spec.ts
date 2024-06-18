/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

import { browserTest, expect } from '../config/browserTest';
import type { BrowserContext } from '@playwright/test';

const test = browserTest.extend<{ reusedContext: () => Promise<BrowserContext> }>({
  reusedContext: async ({ browserType, browser }, use) => {
    await use(async () => {
      const defaultContextOptions = (browserType as any)._defaultContextOptions;
      const context = await (browser as any)._newContextForReuse(defaultContextOptions);
      return context;
    });
  },
});

test('should re-add binding after reset', async ({ reusedContext }) => {
  let context = await reusedContext();

  await context.exposeFunction('add', function(a, b) {
    return Promise.resolve(a - b);
  });
  let page = await context.newPage();
  expect(await page.evaluate('add(7, 6)')).toBe(1);

  context = await reusedContext();
  await context.exposeFunction('add', function(a, b) {
    return Promise.resolve(a + b);
  });

  page = context.pages()[0];
  expect(await page.evaluate('add(5, 6)')).toBe(11);
  await page.reload();
  expect(await page.evaluate('add(5, 6)')).toBe(11);
});

test('should reset serviceworker', async ({ reusedContext, server }) => {
  server.setRoute('/page.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`
      <title>Page Title</title>
      <script>
        navigator.serviceWorker.register('sw.js');
      </script>
    `);
  });
  server.setRoute('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(`
      self.addEventListener('fetch', event => {
        const blob = new Blob(['<title>Wrong Title</title>'], { type : 'text/html' });
        const response = new Response(blob, { status: 200 , statusText: 'OK' });
        event.respondWith(response);
      });

      self.addEventListener('activate', event => {
        event.waitUntil(clients.claim());
      });
    `);
  });

  let context = await reusedContext();
  let page = await context.newPage();
  await page.goto(server.PREFIX + '/page.html');
  await expect(page).toHaveTitle('Page Title');

  context = await reusedContext();
  page = context.pages()[0];
  await page.goto(server.PREFIX + '/page.html');
  await expect(page).toHaveTitle('Page Title');
});

test('should reset serviceworker that hangs in importScripts', async ({ reusedContext, server }) => {
  server.setRoute('/page.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`
      <title>Page Title</title>
      <script>
        navigator.serviceWorker.register('sw.js');
      </script>
    `);
  });
  server.setRoute('/sw.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.end(`
      importScripts('helper.js');

      self.addEventListener('fetch', event => {
        const blob = new Blob(['<title>Wrong Title</title>'], { type : 'text/html' });
        const response = new Response(blob, { status: 200 , statusText: 'OK' });
        event.respondWith(response);
      });

      self.addEventListener('activate', event => {
        event.waitUntil(clients.claim());
      });
    `);
  });
  server.setRoute('/helper.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    // Sending excessive content length makes importScripts hang for
    // 5 seconds in Chromium, 6 seconds in Firefox and long time in WebKit.
    res.setHeader('Content-Length', 1000);
    res.end(`1`);
  });

  let context = await reusedContext();
  let page = await context.newPage();
  await page.goto(server.PREFIX + '/page.html');
  await expect(page).toHaveTitle('Page Title');

  context = await reusedContext();
  page = context.pages()[0];
  await page.goto(server.PREFIX + '/page.html');
  await expect(page).toHaveTitle('Page Title');
});

test('should not cache resources', async ({ reusedContext, server }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/19926' });
  const requestCountMap = new Map<string, number>();
  server.setRoute('/page.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.setHeader(`Cache-Control`, `max-age=3600`);
    const requestCount = requestCountMap.get(req.url) || 0;
    res.end(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <title>Count: ${requestCount}</title>
        <link rel="stylesheet" href="style.css">
        <script>
          fetch('simple.json').then(() => {});
        </script>
      </head>
    </html>
    `);
    requestCountMap.set(req.url, requestCount + 1);
  });
  server.setRoute('/style.css', (req, res) => {
    res.setHeader('Content-Type', 'text/css');
    res.setHeader(`Cache-Control`, `max-age=3600`);
    res.end(`body { background-color: red; }`);
    requestCountMap.set(req.url, (requestCountMap.get(req.url) || 0) + 1);
  });
  server.setRoute('/simple.json', (req, res) => {
    res.setHeader(`Cache-Control`, `max-age=3600`);
    res.setHeader('Content-Type', 'application/json');
    res.end(`{ "foo": "bar" }`);
    requestCountMap.set(req.url, (requestCountMap.get(req.url) || 0) + 1);
  });

  {
    const context = await reusedContext();
    const page = await context.newPage();
    await page.goto(server.PREFIX + '/page.html');
    await expect(page).toHaveTitle('Count: 0');
    expect(requestCountMap.get('/page.html')).toBe(1);
    expect(requestCountMap.get('/style.css')).toBe(1);
    expect(requestCountMap.get('/simple.json')).toBe(1);
  }
  {
    const context = await reusedContext();
    const page = context.pages()[0];
    await page.goto(server.PREFIX + '/page.html');
    await expect(page).toHaveTitle('Count: 1');
    expect(requestCountMap.get('/page.html')).toBe(2);
    expect(requestCountMap.get('/style.css')).toBe(2);
    expect(requestCountMap.get('/simple.json')).toBe(2);
  }
});

test('should ignore binding from beforeunload', async ({ reusedContext }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22803' });

  let context = await reusedContext();

  let called = false;
  await context.exposeFunction('binding', () => called = true);

  let page = await context.newPage();
  await page.evaluate(() => {
    window.addEventListener('beforeunload', () => window['binding']());
  });

  context = await reusedContext();
  page = context.pages()[0];
  await page.setContent('hello');

  expect(called).toBe(false);
});

test('should reset mouse position', async ({ reusedContext, browserName, platform }) => {
  // Note: this test only reproduces the issue locally when run with --repeat-each=20.
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22432' });
  test.fixme(browserName === 'chromium' && platform !== 'darwin', 'chromium keeps hover on linux/win');

  const pageContent = `
    <style>
      div { height: 30px; background: blue; }
      div:hover { background: red; }
      html, body { margin: 0; padding: 0; }
    </style>
    <div id=one>one</div>
    <div id=two>two</div>
  `;

  let context = await reusedContext();
  let page = await context.newPage();
  await page.setContent(pageContent);
  await expect(page.locator('#one')).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  await expect(page.locator('#two')).toHaveCSS('background-color', 'rgb(0, 0, 255)');

  await page.mouse.move(10, 45);
  await expect(page.locator('#one')).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  await expect(page.locator('#two')).toHaveCSS('background-color', 'rgb(255, 0, 0)');

  context = await reusedContext();
  page = context.pages()[0];
  await page.setContent(pageContent);
  await expect(page.locator('#one')).toHaveCSS('background-color', 'rgb(0, 0, 255)');
  await expect(page.locator('#two')).toHaveCSS('background-color', 'rgb(0, 0, 255)');
});

test('should reset tracing', async ({ reusedContext, trace }, testInfo) => {
  test.skip(trace === 'on');

  let context = await reusedContext();
  await context.tracing.start();

  let page = await context.newPage();
  await page.evaluate('1 + 1');

  context = await reusedContext();
  page = context.pages()[0];
  await page.evaluate('2 + 2');

  const error = await context.tracing.stopChunk({ path: testInfo.outputPath('trace.zip') }).catch(e => e);
  expect(error.message).toContain('Must start tracing before stopping');
});

test('should work with clock emulation', async ({ reusedContext, trace }, testInfo) => {
  let context = await reusedContext();

  let page = await context.newPage();
  await page.clock.setFixedTime(new Date('2020-01-01T00:00:00.000Z'));
  expect(await page.evaluate('new Date().toISOString()')).toBe('2020-01-01T00:00:00.000Z');

  context = await reusedContext();
  page = context.pages()[0];
  await page.clock.setFixedTime(new Date('2020-01-01T00:00:00Z'));
  expect(await page.evaluate('new Date().toISOString()')).toBe('2020-01-01T00:00:00.000Z');
});

test('should continue issuing events after closing the reused page', async ({ reusedContext, server }) => {
  test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/24574' });

  {
    const context = await reusedContext();
    const page = await context.newPage();
    await Promise.all([
      page.waitForRequest(server.PREFIX + '/one-style.css'),
      page.goto(server.PREFIX + '/one-style.html'),
    ]);
    await page.close();
  }
  {
    const context = await reusedContext();
    const page = context.pages()[0];
    await Promise.all([
      page.waitForRequest(server.PREFIX + '/one-style.css', { timeout: 10000 }),
      page.goto(server.PREFIX + '/one-style.html'),
    ]);
  }
});
