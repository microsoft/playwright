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
