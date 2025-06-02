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

import { contextTest as test, expect } from '../../config/browserTest';
import { playwrightTest } from '../../config/browserTest';

test('should create a worker from a service worker', async ({ page, server }) => {
  const [worker] = await Promise.all([
    page.context().waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
});

test('should create a worker from service worker with noop routing', async ({ context, page, server }) => {
  await context.route('**', route => route.continue());
  const [worker] = await Promise.all([
    page.context().waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  expect(await worker.evaluate(() => self.toString())).toBe('[object ServiceWorkerGlobalScope]');
});

test('should emit new service worker on update', async ({ context, page, server }) => {
  let version = 0;
  server.setRoute('/worker.js', (req, res) => {
    res.writeHead(200, 'OK', { 'Content-Type': 'text/javascript' });
    res.write(`self.PW_VERSION = ${version++};`);
    res.end();
  });

  server.setRoute('/home', (req, res) => {
    res.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Service Worker Update Demo</title>
        </head>
        <body>
          <button id="update" disabled>update service worker</button>
          <script>
            const updateBtn = document.getElementById('update');
            updateBtn.addEventListener('click', evt => {
              evt.preventDefault();
              registration.then(r => r.update());
            });

            const registration = new Promise(r => navigator.serviceWorker.register('/worker.js').then(r));
            registration.then(() => updateBtn.disabled = false);
          </script>
        </body>
      </html>
    `);
    res.end();
  });

  const [sw] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/home'),
  ]);

  await expect.poll(() => sw.evaluate(() => self['PW_VERSION'])).toBe(0);

  const [updatedSW] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.click('#update'),
  ]);

  await expect.poll(() => updatedSW.evaluate(() => self['PW_VERSION'])).toBe(1);
});

test.describe('http credentials', () => {
  test.use({ httpCredentials: { username: 'user',  password: 'pass' } });

  test('httpCredentials', async ({ context, page, server }) => {
    server.setAuth('/serviceworkers/fetch/sw.html', 'user', 'pass');
    server.setAuth('/empty.html', 'user', 'pass');
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
    ]);

    await page.evaluate(() => window['activationPromise']);
    expect(await worker.evaluate(() => fetch('/empty.html').then(r => r.status))).toBe(200);
  });
});

test('serviceWorkers() should return current workers', async ({ page, server }) => {
  const context = page.context();
  const [worker1] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  let workers = context.serviceWorkers();
  expect(workers.length).toBe(1);

  const [worker2] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.CROSS_PROCESS_PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  workers = context.serviceWorkers();
  expect(workers.length).toBe(2);
  expect(workers).toContain(worker1);
  expect(workers).toContain(worker2);
});

test('should not create a worker from a shared worker', async ({ page, server }) => {
  await page.goto(server.EMPTY_PAGE);
  let serviceWorkerCreated;
  page.context().once('serviceworker', () => serviceWorkerCreated = true);
  await page.evaluate(() => {
    new SharedWorker('data:text/javascript,console.log("hi")');
  });
  expect(serviceWorkerCreated).not.toBeTruthy();
});

test('Page.route should work with intervention headers', async ({ server, page }) => {
  server.setRoute('/intervention', (req, res) => res.end(`
    <script>
      document.write('<script src="${server.CROSS_PROCESS_PREFIX}/intervention.js">' + '</scr' + 'ipt>');
    </script>
  `));
  server.setRedirect('/intervention.js', '/redirect.js');
  let serverRequest = null;
  server.setRoute('/redirect.js', (req, res) => {
    serverRequest = req;
    res.end('console.log(1);');
  });

  await page.route('*', route => route.continue());
  await page.goto(server.PREFIX + '/intervention');
  // Check for feature URL substring rather than https://www.chromestatus.com to
  // make it work with Edgium.
  expect(serverRequest.headers.intervention).toContain('feature/5718547946799104');
});

playwrightTest('should close service worker together with the context', async ({ browserType, server }) => {
  const browser = await browserType.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const [worker] = await Promise.all([
    context.waitForEvent('serviceworker'),
    page.goto(server.PREFIX + '/serviceworkers/empty/sw.html')
  ]);
  const messages = [];
  context.on('close', () => messages.push('context'));
  worker.on('close', () => messages.push('worker'));
  await context.close();
  expect(messages.join('|')).toBe('worker|context');
  await browser.close();
});

playwrightTest('should pass args with spaces', async ({ browserType, createUserDataDir }, testInfo) => {
  const browser = await browserType.launchPersistentContext(await createUserDataDir(), {
    args: ['--user-agent=I am Foo']
  });
  const page = await browser.newPage();
  const userAgent = await page.evaluate(() => navigator.userAgent);
  await browser.close();
  expect(userAgent).toBe('I am Foo');
});

test.describe('PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS=1', () => {
  test.skip(({ mode }) => mode !== 'default', 'Cannot set env variables in non-default');
  test.beforeAll(() => process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS = '1');
  test.afterAll(() => delete process.env.PW_EXPERIMENTAL_SERVICE_WORKER_NETWORK_EVENTS);

  test('serviceWorker(), and fromServiceWorker() work', async ({ context, page, server }) => {
    const [worker, html, main, inWorker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      context.waitForEvent('request', r => r.url().endsWith('/sw.html')),
      context.waitForEvent('request', r => r.url().endsWith('/sw.js')),
      context.waitForEvent('request', r => r.url().endsWith('/request-from-within-worker.txt')),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
    ]);

    expect(html.frame()).toBeTruthy();
    expect(html.serviceWorker()).toBe(null);
    expect((await html.response()).fromServiceWorker()).toBe(false);

    expect(main.frame).toThrow();
    expect(main.serviceWorker()).toBe(worker);
    expect((await main.response()).fromServiceWorker()).toBe(false);

    expect(inWorker.frame).toThrow();
    expect(inWorker.serviceWorker()).toBe(worker);
    expect((await inWorker.response()).fromServiceWorker()).toBe(false);

    await page.evaluate(() => window['activationPromise']);
    const [innerSW, innerPage] = await Promise.all([
      context.waitForEvent('request', r => r.url().endsWith('/inner.txt') && !!r.serviceWorker()),
      context.waitForEvent('request', r => r.url().endsWith('/inner.txt') && !r.serviceWorker()),
      page.evaluate(() => fetch('/inner.txt')),
    ]);
    expect(innerPage.serviceWorker()).toBe(null);
    expect((await innerPage.response()).fromServiceWorker()).toBe(true);

    expect(innerSW.serviceWorker()).toBe(worker);
    expect((await innerSW.response()).fromServiceWorker()).toBe(false);
  });

  test('should intercept service worker requests (main and within)', async ({ context, page, server }) => {
    await context.route('**/request-from-within-worker', route =>
      route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: '"intercepted!"',
      })
    );

    await context.route('**/sw.js', route =>
      route.fulfill({
        contentType: 'text/javascript',
        status: 200,
        body: `
            self.contentPromise = new Promise(res => fetch('/request-from-within-worker').then(r => r.json()).then(res));
          `,
      })
    );

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      context.waitForEvent('response', r => r.url().endsWith('/request-from-within-worker')),
      context.waitForEvent('request', r => r.url().endsWith('sw.js') && !!r.serviceWorker()),
      context.waitForEvent('response', r => r.url().endsWith('sw.js') && !r.fromServiceWorker()),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);

    await expect(sw.evaluate(() => self['contentPromise'])).resolves.toBe('intercepted!');
  });

  test('should report failure (due to content-type) of main service worker request', async ({ server, page, context, browserMajorVersion }) => {
    test.skip(browserMajorVersion < 104, 'Requires http://crrev.com/1012503 or later.');
    server.setRoute('/serviceworkers/fetch/sw.js', (req, res) => {
      res.writeHead(200, 'OK', { 'Content-Type': 'text/html' });
      res.write(`console.log('hi from sw');`);
      res.end();
    });
    const [, main] = await Promise.all([
      server.waitForRequest('/serviceworkers/fetch/sw.js'),
      context.waitForEvent('request', r => r.url().endsWith('sw.js')),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html'),
    ]);
      // This will timeout today
    await main.response();
  });

  test('should report failure (due to redirect) of main service worker request', async ({ server, page, context, browserMajorVersion }) => {
    test.skip(browserMajorVersion < 104, 'Requires http://crrev.com/1012503 or later.');
    server.setRedirect('/serviceworkers/empty/sw.js', '/dev/null');
    const [, main] = await Promise.all([
      server.waitForRequest('/serviceworkers/empty/sw.js'),
      context.waitForEvent('request', r => r.url().endsWith('sw.js')),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);
      // This will timeout today
    const resp = await main.response();
    expect(resp.status()).toBe(302);
  });

  test('should intercept service worker importScripts', async ({ context, page, server }) => {
    await context.route('**/import.js', route =>
      route.fulfill({
        contentType: 'text/javascript',
        status: 200,
        body: 'self.exportedValue = 47;',
      })
    );

    await context.route('**/sw.js', route =>
      route.fulfill({
        contentType: 'text/javascript',
        status: 200,
        body: `
            importScripts('/import.js');
            self.importedValue = self.exportedValue;
          `,
      })
    );

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      context.waitForEvent('response', r => r.url().endsWith('/import.js')),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);

    await expect(sw.evaluate(() => self['importedValue'])).resolves.toBe(47);
  });

  test('should report intercepted service worker requests in HAR', async ({ pageWithHar, server }) => {
    const { context, page, getLog } = await pageWithHar();
    await context.route('**/request-from-within-worker', route =>
      route.fulfill({
        contentType: 'application/json',
        headers: {
          'x-pw-test': 'request-within-worker',
        },
        status: 200,
        body: '"intercepted!"',
      })
    );

    await context.route('**/sw.js', route =>
      route.fulfill({
        contentType: 'text/javascript',
        headers: {
          'x-pw-test': 'intercepted-main',
        },
        status: 200,
        body: `
            self.contentPromise = new Promise(res => fetch('/request-from-within-worker').then(r => r.json()).then(res));
          `,
      })
    );

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      context.waitForEvent('response', r => r.url().endsWith('/request-from-within-worker')),
      page.goto(server.PREFIX + '/serviceworkers/empty/sw.html'),
    ]);

    await expect(sw.evaluate(() => self['contentPromise'])).resolves.toBe('intercepted!');

    const log = await getLog();
    {
      const sw = log.entries.filter(e => e.request.url.endsWith('sw.js'));
      expect.soft(sw).toHaveLength(1);
      expect.soft(sw[0].response.headers.filter(v => v.name === 'x-pw-test')).toEqual([{ name: 'x-pw-test', value: 'intercepted-main' }]);
    }
    {
      const req = log.entries.filter(e => e.request.url.endsWith('request-from-within-worker'));
      expect.soft(req).toHaveLength(1);
      expect.soft(req[0].response.headers.filter(v => v.name === 'x-pw-test')).toEqual([{ name: 'x-pw-test', value: 'request-within-worker' }]);
      expect.soft(req[0].response.content.text).toBe('"intercepted!"');
    }
  });

  test('should intercept only serviceworker request, not page', async ({ context, page, server }) => {
    await context.route('**/data.json', async route => {
      if (route.request().serviceWorker()) {
        return route.fulfill({
          contentType: 'text/plain',
          status: 200,
          body: 'from sw',
        });
      } else {
        return route.continue();
      }
    });

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html'),
    ]);
    await page.evaluate(() => window['activationPromise']);
    const response = await page.evaluate(() => fetch('/data.json').then(r => r.text()));
    const [url] = await sw.evaluate(() => self['intercepted']);
    expect(url).toMatch(/\/data\.json$/);
    expect(response).toBe('from sw');
  });

  test('should produce network events, routing, and annotations for Service Worker', async ({ page, context, server }) => {
    server.setRoute('/index.html', (req, res) => {
      res.write(`
        <script>
          window.registrationPromise = navigator.serviceWorker.register('/transparent-service-worker.js');
        </script>
      `);
      res.end();
    });
    server.setRoute('/transparent-service-worker.js', (req, res) => {
      res.writeHead(200, 'OK', { 'Content-Type': 'text/javascript' });
      res.write(`
        self.addEventListener("fetch", (event) => {
          // actually make the request
          const responsePromise = fetch(event.request);
          // send it back to the page
          event.respondWith(responsePromise);
        });

        self.addEventListener("activate", (event) => {
          event.waitUntil(clients.claim());
        });
      `);
      res.end();
    });

    const routed = [];
    const formatRequest = async ([scope, r]: ['page' | 'context', any]) => `| ${(scope === 'page' ? '[`event: Page.request`]' : '[`event: BrowserContext.request`]').padEnd('[`event: BrowserContext.request`]'.length, ' ')} | ${r.serviceWorker() ? 'Service [Worker]' : '[Frame]'.padEnd('Service [Worker]'.length, ' ')} | ${r.url().split('/').pop().padEnd(30, ' ')} | ${(routed.includes(r) ? 'Yes' : '').padEnd('Routed'.length, ' ')} | ${((await r.response()).fromServiceWorker() ? 'Yes' : '').padEnd('[`method: Response.fromServiceWorker`]'.length, ' ')} |`;
    await context.route('**', async route => {
      routed.push(route.request());
      await route.continue();
    });
    await page.route('**', async route => {
      routed.push(route.request());
      await route.continue();
    });
    const requests = [];
    page.on('request', r => requests.push(['page', r]));
    context.on('request', r => requests.push(['context', r]));

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/index.html'),
    ]);

    await expect.poll(() => sw.evaluate(() => (self as any).registration.active?.state)).toBe('activated');

    await page.evaluate(() => fetch('/data.json'));

    expect([
      '| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |',
      ...await Promise.all(requests.map(formatRequest))])
        .toEqual([
          '| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |',
          '| [`event: BrowserContext.request`] | [Frame]          | index.html                     | Yes    |                                        |',
          '| [`event: Page.request`]           | [Frame]          | index.html                     | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | Service [Worker] | transparent-service-worker.js  | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | Service [Worker] | data.json                      | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | [Frame]          | data.json                      |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | data.json                      |        | Yes                                    |',
        ]);
  });

  test('should produce network events, routing, and annotations for Service Worker (advanced)', async ({ page, context, server }) => {
    server.setRoute('/index.html', (req, res) => {
      res.write(`
        <script>
          window.registrationPromise = navigator.serviceWorker.register('/complex-service-worker.js');
        </script>
      `);
      res.end();
    });
    server.setRoute('/complex-service-worker.js', (req, res) => {
      res.writeHead(200, 'OK', { 'Content-Type': 'text/javascript' });
      res.write(`
        self.addEventListener("install", function (event) {
          event.waitUntil(
            caches.open("v1").then(function (cache) {
              // 1. Pre-fetches and caches /addressbook.json
              return cache.add("/addressbook.json");
            })
          );
        });

        // Opt to handle FetchEvent's from the page
        self.addEventListener("fetch", (event) => {
          event.respondWith(
            (async () => {
              // 1. Try to first serve directly from caches
              let response = await caches.match(event.request);
              if (response) return response;

              // 2. Re-write request for /foo to /bar
              if (event.request.url.endsWith("foo")) return fetch("./bar");

              // 3. Prevent tracker.js from being retrieved, and returns a placeholder response
              if (event.request.url.endsWith("tracker.js"))
                return new Response('console.log("no trackers!")', {
                  status: 200,
                  headers: { "Content-Type": "text/javascript" },
                });

              // 4. Otherwise, fallthrough, perform the fetch and respond
              return fetch(event.request);
            })()
          );
        });

        self.addEventListener("activate", (event) => {
          event.waitUntil(clients.claim());
        });
      `);
      res.end();
    });
    server.setRoute('/addressbook.json', (req, res) => {
      res.write('{}');
      res.end();
    });

    const routed = [];
    const formatRequest = async ([scope, r]: ['page' | 'context', any]) => `| ${(scope === 'page' ? '[`event: Page.request`]' : '[`event: BrowserContext.request`]').padEnd('[`event: BrowserContext.request`]'.length, ' ')} | ${r.serviceWorker() ? 'Service [Worker]' : '[Frame]'.padEnd('Service [Worker]'.length, ' ')} | ${r.url().split('/').pop().padEnd(30, ' ')} | ${(routed.includes(r) ? 'Yes' : '').padEnd('Routed'.length, ' ')} | ${((await r.response()).fromServiceWorker() ? 'Yes' : '').padEnd('[`method: Response.fromServiceWorker`]'.length, ' ')} |`;
    await context.route('**', async route => {
      routed.push(route.request());
      await route.continue();
    });
    await page.route('**', async route => {
      routed.push(route.request());
      await route.continue();
    });
    const requests = [];
    page.on('request', r => requests.push(['page', r]));
    context.on('request', r => requests.push(['context', r]));

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/index.html'),
    ]);

    await expect.poll(() => sw.evaluate(() => (self as any).registration.active?.state)).toBe('activated');

    await page.evaluate(() => fetch('/addressbook.json'));
    await page.evaluate(() => fetch('/foo'));
    await page.evaluate(() => fetch('/tracker.js'));
    await page.evaluate(() => fetch('/fallthrough.txt'));

    expect([
      '| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |',
      ...await Promise.all(requests.map(formatRequest))])
        .toEqual([
          '| Event                             | Owner            | URL                            | Routed | [`method: Response.fromServiceWorker`] |',
          '| [`event: BrowserContext.request`] | [Frame]          | index.html                     | Yes    |                                        |',
          '| [`event: Page.request`]           | [Frame]          | index.html                     | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | Service [Worker] | complex-service-worker.js      | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | Service [Worker] | addressbook.json               | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | [Frame]          | addressbook.json               |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | addressbook.json               |        | Yes                                    |',
          '| [`event: BrowserContext.request`] | Service [Worker] | bar                            | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | [Frame]          | foo                            |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | foo                            |        | Yes                                    |',
          '| [`event: BrowserContext.request`] | [Frame]          | tracker.js                     |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | tracker.js                     |        | Yes                                    |',
          '| [`event: BrowserContext.request`] | Service [Worker] | fallthrough.txt                | Yes    |                                        |',
          '| [`event: BrowserContext.request`] | [Frame]          | fallthrough.txt                |        | Yes                                    |',
          '| [`event: Page.request`]           | [Frame]          | fallthrough.txt                |        | Yes                                    |']);
  });

  test('should intercept service worker update requests', async ({ context, page, server }) => {
    test.fixme();
    test.info().annotations.push({ type: 'issue', description: 'https://github.com/microsoft/playwright/issues/14711' });

    let version = 0;
    server.setRoute('/worker.js', (req, res) => {
      res.writeHead(200, 'OK', { 'Content-Type': 'text/javascript' });
      res.write(`self.PW_VERSION = ${version++};`);
      res.end();
    });

    server.setRoute('/home', (req, res) => {
      res.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Service Worker Update Demo</title>
          </head>
          <body>
            <button id="update" disabled>update service worker</button>
            <script>
              const updateBtn = document.getElementById('update');
              updateBtn.addEventListener('click', evt => {
                evt.preventDefault();
                registration.then(r => r.update());
              });

              const registration = new Promise(r => navigator.serviceWorker.register('/worker.js').then(r));
              registration.then(() => updateBtn.disabled = false);
            </script>
          </body>
        </html>
      `);
      res.end();
    });

    const [sw] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/home'),
    ]);

    await expect.poll(() => sw.evaluate(() => self['PW_VERSION'])).toBe(0);

    // Before triggering, let's intercept the update request
    await context.route('**/worker.js', async route => {
      await route.fulfill({
        status: 200,
        body: `self.PW_VERSION = "intercepted";`,
        contentType: 'text/javascript',
      });
    });

    const [updatedSW] = await Promise.all([
      context.waitForEvent('serviceworker'),
      // currently times out here
      context.waitForEvent('request', r => r.url().endsWith('worker.js')),
      page.click('#update'),
    ]);

    await expect.poll(() => updatedSW.evaluate(() => self['PW_VERSION'])).toBe('intercepted');
  });

  test('setOffline', async ({ context, page, server }) => {
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
    ]);

    await page.evaluate(() => window['activationPromise']);
    await context.setOffline(true);
    const [, error] = await Promise.all([
      context.waitForEvent('request', r => r.url().endsWith('/inner.txt') && !!r.serviceWorker()),
      worker.evaluate(() => fetch('/inner.txt').catch(e => `REJECTED: ${e}`)),
    ]);
    expect(error).toMatch(/REJECTED.*Failed to fetch/);
  });

  test('setExtraHTTPHeaders', async ({ context, page, server }) => {
    const [worker] = await Promise.all([
      context.waitForEvent('serviceworker'),
      page.goto(server.PREFIX + '/serviceworkers/fetch/sw.html')
    ]);

    await page.evaluate(() => window['activationPromise']);
    await context.setExtraHTTPHeaders({ 'x-custom-header': 'custom!' });
    const requestPromise = server.waitForRequest('/inner.txt');
    await worker.evaluate(() => fetch('/inner.txt'));
    const req = await requestPromise;
    expect(req.headers['x-custom-header']).toBe('custom!');
  });
});

test('should throw when connecting twice to an already running persistent context (--remote-debugging-port)', async ({ browserType, createUserDataDir, platform, isHeadlessShell }) => {
  test.skip(isHeadlessShell, 'Headless shell does not create a ProcessSingleton');
  test.fixme(platform === 'win32', 'Windows does not print something to the console when the profile is already in use by another instance of Chromium.');
  const userDataDir = await createUserDataDir();
  const browser = await browserType.launchPersistentContext(userDataDir, {
    cdpPort: 9222,
  } as any);
  try {
    const error = await browserType.launchPersistentContext(userDataDir, {
      cdpPort: 9223,
    } as any).catch(e => e);
    expect(error.message).toContain('This usually means that the profile is already in use by another instance of Chromium.');
  } finally {
    await browser.close();
  }
});

test('should throw when connecting twice to an already running persistent context (--remote-debugging-pipe)', async ({ browserType, createUserDataDir, platform, isHeadlessShell }) => {
  test.skip(isHeadlessShell, 'Headless shell does not create a ProcessSingleton');
  test.fixme(platform === 'win32', 'Windows does not print something to the console when the profile is already in use by another instance of Chromium.');
  const userDataDir = await createUserDataDir();
  const browser = await browserType.launchPersistentContext(userDataDir);
  try {
    const error = await browserType.launchPersistentContext(userDataDir).catch(e => e);
    expect(error.message).toContain('This usually means that the profile is already in use by another instance of Chromium.');
  } finally {
    await browser.close();
  }
});
