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
import { verifyViewport } from '../config/utils';
import type { Browser, BrowserServer, BrowserContext, Page, BrowserContextOptions, BrowserType } from '@playwright/test';

class LaunchScenario {
  private _browserType: BrowserType;
  private _browser: Browser | undefined;
  private _context: BrowserContext | undefined;

  constructor(browserType: BrowserType) {
    this._browserType = browserType;
  }

  async browser() {
    if (!this._browser)
      this._browser = await this._browserType.launch();
    return this._browser;
  }

  async reusedContext(options?: BrowserContextOptions): Promise<BrowserContext> {
    const browser = await this.browser();
    if (this._context)
      await (browser as any)._disconnectFromReusedContext('reusedContext');
    const defaultContextOptions = (this._browserType as any)._playwright._defaultContextOptions;
    this._context = await (browser as any)._newContextForReuse({ ...defaultContextOptions, ...options });
    return this._context;
  }

  async close() {
    await this._browser?.close();
  }
}

class ConnectScenario {
  private _browserType: BrowserType;
  private _server: BrowserServer | undefined;
  private _browser: Browser | undefined;

  constructor(browserType: BrowserType) {
    this._browserType = browserType;
  }

  async server() {
    if (!this._server)
      this._server = await this._browserType.launchServer();
    return this._server;
  }

  async reusedContext(options?: BrowserContextOptions): Promise<BrowserContext> {
    const server = await this.server();
    if (this._browser)
      await this._browser.close();
    this._browser = await this._browserType.connect(server.wsEndpoint());
    const defaultContextOptions = (this._browserType as any)._playwright._defaultContextOptions;
    return await (this._browser as any)._newContextForReuse({ ...defaultContextOptions, ...options });
  }

  async close() {
    await this._browser?.close();
    await this._server?.close();
  }
}

const test = browserTest.extend<{ scenario: 'launch' | 'connect', reusedContext: (options?: BrowserContextOptions) => Promise<BrowserContext> }>({
  scenario: 'launch',
  reusedContext: async ({ scenario, browserType }, use) => {
    const instance = scenario === 'launch' ?  new LaunchScenario(browserType) : new ConnectScenario(browserType);
    await use(options => instance.reusedContext(options));
    await instance.close();
  },
});

for (const scenario of ['launch', 'connect'] as const) {
  test.describe('reuse ' + scenario, () => {
    test.skip(({ mode }) => mode !== 'default' && scenario === 'connect');
    test.use({ scenario });

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

    test('should reset mouse position', {
      annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/22432' },
    }, async ({ reusedContext, browserName, platform }) => {
      // Note: this test only reproduces the issue locally when run with --repeat-each=20.

      const pageContent = `
        <style>
          div { height: 30px; background: blue; }
          div:hover { background: red; }
          html, body { margin: 0; padding: 0; }
        </style>
        <div id=filler>one</div>
        <div id=one>one</div>
        <div id=two>two</div>
      `;

      let context = await reusedContext();
      let page = await context.newPage();
      await page.setContent(pageContent);
      await expect(page.locator('#one')).toHaveCSS('background-color', 'rgb(0, 0, 255)');
      await expect(page.locator('#two')).toHaveCSS('background-color', 'rgb(0, 0, 255)');

      await page.mouse.move(10, 75);
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

    test('should work with routeWebSocket', {
      annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/36480' },
    }, async ({ reusedContext, server }, testInfo) => {
      async function setup(page: Page, suffix: string) {
        await page.routeWebSocket(/ws1/, ws => {
          ws.onMessage(message => {
            ws.send('page-mock-' + suffix);
          });
        });
        await page.context().routeWebSocket(/.*/, ws => {
          const server = ws.connectToServer();
          ws.onMessage(message => {
            ws.send('context-mock-' + suffix);
          });
          server.onMessage(message => ws.send(message));
        });
        await page.goto('about:blank');
        await page.evaluate(host => {
          window.log = [];
          (window as any).ws1 = new WebSocket('ws://' + host + '/ws1');
          (window as any).ws1.addEventListener('message', event => window.log.push(`ws1:${event.data}`));
          (window as any).ws = new WebSocket('ws://' + host + '/ws');
          (window as any).ws.addEventListener('message', event => window.log.push(`ws:${event.data}`));
        }, server.HOST);
      }

      let context = await reusedContext();
      let page = await context.newPage();
      const wsPromise = server.waitForWebSocket();
      await setup(page, 'before');
      const ws = await wsPromise;
      await page.evaluate(() => (window as any).ws1.send('request'));
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:page-mock-before`]);
      await page.evaluate(() => (window as any).ws.send('request'));
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:page-mock-before`, `ws:context-mock-before`]);
      ws.send('hi');
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:page-mock-before`, `ws:context-mock-before`, `ws:hi`]);

      context = await reusedContext();
      page = context.pages()[0];
      const newWSPromise = server.waitForWebSocket();
      await setup(page, 'after');
      const newWS = await newWSPromise;
      await page.evaluate(() => (window as any).ws1.send('request'));
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:page-mock-after`]);
      await page.evaluate(() => (window as any).ws.send('request'));
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:page-mock-after`, `ws:context-mock-after`]);
      newWS.send('hello');
      await expect.poll(() => page.evaluate(() => window.log)).toEqual([`ws1:page-mock-after`, `ws:context-mock-after`, `ws:hello`]);
    });

    test('should update viewport and media', async ({ reusedContext }) => {
      let context = await reusedContext({ viewport: { width: 800, height: 600 }, colorScheme: 'dark' });
      let page = await context.newPage();
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches)).toBe(true);
      await verifyViewport(page, 800, 600);
      await page.close();

      context = await reusedContext({ viewport: { width: 600, height: 800 }, colorScheme: 'light' });
      page = await context.newPage();
      expect(await page.evaluate(() => matchMedia('(prefers-color-scheme: light)').matches)).toBe(true);
      await verifyViewport(page, 600, 800);
    });
  });
}
