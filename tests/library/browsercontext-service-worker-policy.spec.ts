/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { browserTest as it, expect } from '../config/browserTest';

it('should allow service workers by default', async ({ page, server }) => {
  await page.goto(server.PREFIX + '/serviceworkers/empty/sw.html');
  await expect(page.evaluate(() => window['registrationPromise'])).resolves.toBeTruthy();
});

for (const [mode, workerResponse] of Object.entries({
  'literal': `new Response('<h1>offline</h1>', { headers: { 'Content-Type': 'text/html' } })`,
  'cache-only': `caches.match('/offline.html')`,
  'network-fallback': `fetch(event.request).catch(() => caches.match('/offline.html'))`,
  'preload-fallback': `(async () => {
    try {
      return await event.preloadResponse || await fetch(event.request);
    } catch {
      return caches.match('/offline.html');
    }
  })()`,
})) {
  it(`should allow ${mode} service worker navigation while offline`, {
    annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/42775' },
  }, async ({ context, page, server, browserName, isElectron, isFrozenWebkit }) => {
    it.skip(isElectron);
    it.skip(isFrozenWebkit, 'Requires offline emulation in the network process.');
    it.fixme(browserName === 'firefox' && (mode === 'network-fallback' || mode === 'preload-fallback'), 'Firefox does not apply offline emulation to service worker requests.');

    let networkRequests = 0;
    server.setRoute('/target.html', (request, response) => {
      ++networkRequests;
      response.setHeader('Cache-Control', 'no-store');
      response.end('online');
    });
    server.setRoute('/offline.html', (request, response) => {
      response.setHeader('Content-Type', 'text/html');
      response.end('<h1>offline</h1>');
    });
    server.setRoute('/sw.js', (request, response) => {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(`
        self.addEventListener('install', event => event.waitUntil((async () => {
          const cache = await caches.open('offline');
          await cache.add('/offline.html');
          await self.skipWaiting();
        })()));
        self.addEventListener('activate', event => event.waitUntil((async () => {
          ${mode === 'preload-fallback' ? 'await self.registration.navigationPreload.enable();' : ''}
          await self.clients.claim();
        })()));
        self.addEventListener('fetch', event => {
          if (event.request.mode === 'navigate')
            event.respondWith(${workerResponse});
        });
      `);
    });

    await page.goto(server.EMPTY_PAGE);
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);

    const response = await page.goto(server.PREFIX + '/target.html');
    expect(response.status()).toBe(200);
    expect(response.fromServiceWorker()).toBe(true);
    await expect(page.locator('h1')).toHaveText('offline');
    expect(await page.evaluate(() => navigator.onLine)).toBe(false);
    expect(networkRequests).toBe(0);

    const newPage = await context.newPage();
    const newResponse = await newPage.goto(server.PREFIX + '/target.html');
    expect(newResponse.status()).toBe(200);
    expect(newResponse.fromServiceWorker()).toBe(true);
    await expect(newPage.locator('h1')).toHaveText('offline');
    expect(await newPage.evaluate(() => navigator.onLine)).toBe(false);
    expect(networkRequests).toBe(0);

    await context.setOffline(false);
    expect(await page.evaluate(() => fetch('/target.html').then(response => response.text()))).toBe('online');
    expect(networkRequests).toBe(1);
  });
}

it.describe('block', () => {
  it.use({ serviceWorkers: 'block' });

  it('blocks service worker registration', async ({ page, server }) => {
    await Promise.all([
      page.waitForEvent('console', evt => evt.text() === 'Service Worker registration blocked by Playwright'),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);
  });

  it('should not throw error on about:blank', async ({ page }) => {
    it.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32292' });
    const errors = [];
    page.on('pageerror', error => errors.push(error));
    await page.goto('about:blank');
    expect(errors).toEqual([]);
  });
});
